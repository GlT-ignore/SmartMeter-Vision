# SmartMeter Vision - Knowledge Transfer Documentation

## Table of Contents
1. [Project Overview](#project-overview)
2. [System Architecture](#system-architecture)
3. [User Roles & Authentication](#user-roles--authentication)
4. [Database Structure](#database-structure)
5. [Features & Functionality](#features--functionality)
6. [Editable Fields & Configuration](#editable-fields--configuration)
7. [Key Workflows](#key-workflows)
8. [Technical Stack](#technical-stack)
9. [Setup & Configuration](#setup--configuration)
10. [Common Operations](#common-operations)
11. [Troubleshooting](#troubleshooting)

---

## Project Overview

**SmartMeter Vision** is a web application for managing gas meter readings in a multi-tenant building/apartment complex. The system allows tenants to upload meter photos, admins to review and approve readings, and generates bills/receipts automatically.

### Key Capabilities
- 📸 **Image Upload**: Tenants upload meter photos via mobile/web
- 🔍 **Manual Review**: Admins manually enter readings from photos (OCR available but not primary)
- ✅ **Approval Workflow**: Admin approves/rejects readings with corrections
- 💰 **Automatic Billing**: Calculates units consumed and bill amounts
- 🧾 **Receipt Generation**: PDF receipts for approved readings
- 📊 **Monthly Summaries**: Admin can view/download monthly billing summaries
- 🔐 **Multi-User Support**: Separate admin and tenant accounts
- 🚨 **Emergency Access**: Super user feature for admin password reset

---

## System Architecture

### Frontend
- **Framework**: React 19.2 with TypeScript
- **Build Tool**: Vite
- **Routing**: React Router DOM
- **State Management**: React hooks (useState, useEffect)
- **Styling**: CSS (responsive design)

### Backend/Database
- **Database**: Firebase Firestore (NoSQL)
- **Authentication**: Custom username/password (stored in Firestore)
- **Image Storage**: Base64 data URLs stored in Firestore (no Cloud Storage needed)
- **Real-time Updates**: Firestore real-time listeners

### Key Libraries
- `tesseract.js`: OCR (optional, not primary workflow)
- `jspdf`: PDF generation for receipts
- `html2canvas`: Converting HTML to images for PDFs
- `firebase`: Firebase SDK for Firestore

---

## User Roles & Authentication

### User Types

#### 1. **Tenant**
- **Purpose**: Upload meter readings and view their own bills
- **Access**: 
  - Upload meter photos
  - View their own reading history
  - Download receipts for approved readings
- **Login**: Username + Password

#### 2. **Admin**
- **Purpose**: Manage the entire system
- **Access**:
  - Review and approve/reject readings
  - Create/manage tenants and flats
  - Manage user accounts (usernames, passwords)
  - Configure global settings (tariff, unit factor, minimum price)
  - View all readings across all flats
  - Generate monthly summaries
  - Download receipts for any tenant
- **Login**: Username + Password

#### 3. **Super User** (Emergency Access)
- **Purpose**: Emergency admin password reset when admin is locked out
- **Access**: 
  - ONLY reset admin passwords
  - Cannot access regular admin features
- **Login**: Google OAuth (Gmail) - only authorized email can access
- **Configuration**: Set via `VITE_SUPER_USER_EMAIL` environment variable

### Authentication Flow

1. **Regular Users (Tenant/Admin)**:
   - Enter username and password on login page
   - System looks up user in Firestore `users` collection
   - Password is hashed (SHA-256) and compared
   - User data stored in `localStorage` (without password hash)
   - Redirected to appropriate dashboard based on role

2. **Super User**:
   - Navigate to `/superuser/login`
   - Click "Sign in with Google"
   - System verifies email matches `VITE_SUPER_USER_EMAIL`
   - If authorized, access super user dashboard
   - Can reset admin passwords only

### Password Security
- Passwords are hashed using SHA-256 before storage
- Password hashes are stored in Firestore `users` collection
- Plain passwords are never stored or transmitted
- Password hashes are never exposed to UI components

---

## Database Structure

### Firestore Collections

#### 1. **`users` Collection**
Stores all user accounts (tenants and admins).

**Document Structure:**
```typescript
{
  id: string                    // Firestore document ID (auto-generated)
  username: string              // Unique username for login
  passwordHash: string          // SHA-256 hash of password
  role: 'tenant' | 'admin'      // User role
  flatId: string | null         // For tenants: links to flat document
  createdAt: number             // Timestamp (milliseconds)
}
```

**Key Fields:**
- `username`: Must be unique, used for login
- `passwordHash`: SHA-256 hash, never exposed to UI
- `role`: Determines access level
- `flatId`: Optional, links tenant to their flat

**Indexes**: None required (queries use simple equality)

---

#### 2. **`flats` Collection**
Stores flat/apartment information.

**Document Structure:**
```typescript
{
  id: string                    // Firestore document ID (usually same as flatId)
  flatId: string                // Display ID (e.g., "A-101", "F4")
  tenantName?: string           // Optional tenant name for display
  tariffPerUnit: number         // Cost per unit/KG (can be overridden by global tariff)
  userId: string                // References users collection document ID
  initialReading?: number | null // Starting meter reading (for first bill calculation)
}
```

**Key Fields:**
- `flatId`: Unique identifier (e.g., "A-101", "F4")
- `tariffPerUnit`: Per-flat tariff (can differ from global tariff)
- `userId`: Links to tenant user account
- `initialReading`: Used when calculating first approved reading

**Document ID**: Usually set to `flatId` for easy lookup

---

#### 3. **`readings` Collection**
Stores all meter reading submissions.

**Document Structure:**
```typescript
{
  id: string                    // Firestore document ID (auto-generated)
  flatId: string                // Which flat this reading belongs to
  imageUrl: string              // Base64 data URL of meter photo
  
  // Reading values
  ocrReading: number | null     // OCR-extracted reading (optional, not primary)
  correctedReading: number | null // Admin-entered corrected reading
  previousReading: number | null   // Previous approved reading value
  
  // Calculated values (set on approval)
  unitsUsed: number | null      // Difference: correctedReading - previousReading
  amount: number | null         // Calculated bill amount
  
  // Status & metadata
  status: 'pending' | 'approved' | 'rejected'
  createdAt: number            // Submission timestamp
  approvedAt?: number           // Approval timestamp (if approved)
  yearMonth?: string            // Format: "YYYY-MM" (e.g., "2025-03")
  
  // Frozen values (preserved at approval time)
  tariffAtApproval?: number | null     // Tariff used when approved
  unitFactorAtApproval?: number | null // Unit conversion factor at approval
  
  // Rejection/reopen metadata
  ocrConfidence?: number        // OCR confidence score (if OCR was used)
  rejectionReason?: string     // Admin-provided rejection reason
  reopenReason?: string         // Reason for re-opening approved reading
}
```

**Key Fields:**
- `status`: Controls workflow state
- `yearMonth`: Enforces one reading per month per flat
- `tariffAtApproval`: Preserves tariff used, prevents historical changes
- `unitFactorAtApproval`: Preserves conversion factor used

**Indexes**: 
- Composite index on `flatId` + `status` (if filtering by both)
- Simple index on `status` (for pending readings query)

---

#### 4. **`settings` Collection**
Stores global system configuration.

**Document Structure:**
```typescript
{
  id: "globalTariff"            // Fixed document ID
  tariffPerUnit: number         // Global cost per unit/KG
  minimumPrice?: number         // Minimum bill amount (default: 250)
  unitFactor?: number           // Unit conversion factor (default: 2.3)
}
```

**Key Fields:**
- `tariffPerUnit`: Applied to all new approvals (unless flat has its own)
- `minimumPrice`: Minimum charge added to all bills (default: ₹25)
- `unitFactor`: Conversion factor (e.g., 2.3 for "convicto Kg")

**Document ID**: Always `"globalTariff"` (single document)

---

## Features & Functionality

### Tenant Features

#### 1. **Upload Meter Reading**
- **Location**: Tenant Dashboard (`/tenant`)
- **Process**:
  1. Click "Upload meter photo"
  2. Select image file (or use mobile camera)
  3. Image is compressed and stored as base64 in Firestore
  4. Reading created with status `pending`
  5. Admin is notified (via real-time listener)

**Limitations**:
- One upload per calendar month per flat
- If pending/approved reading exists for current month, upload is blocked
- Rejected readings don't count toward limit

#### 2. **View Reading History**
- **Location**: Tenant Dashboard (`/tenant`)
- **Shows**:
  - All readings (pending, approved, rejected)
  - Current reading value
  - Units consumed
  - Bill amount
  - Status badges
  - Submission and approval dates
  - Rejection reasons (if rejected)

#### 3. **View Previous Photo**
- Tenants can compare current reading photo with previous approved reading photo
- Helps verify meter progression

#### 4. **Download Receipt**
- **Available**: Only for approved readings
- **Format**: PDF (80mm × 120mm slip format)
- **Contains**:
  - Tenant name
  - Flat number
  - Reading date and due date
  - Previous and current readings
  - Units consumed
  - Bill breakdown
  - Grand total

---

### Admin Features

#### 1. **Review Pending Readings**
- **Location**: Admin Dashboard (`/admin`)
- **Process**:
  1. View all pending readings
  2. See current photo and previous approved photo side-by-side
  3. Enter corrected reading manually
  4. Optionally enter rejection reason
  5. Click "Approve" or "Reject"

**Approval Calculation**:
- `unitsUsed` = `correctedReading` - `previousReading`
- `amount` = `unitsUsed × tariffPerUnit`
- If `amount < minimumPrice`, set `amount = minimumPrice`
- Freeze `tariffAtApproval` and `unitFactorAtApproval`

**Previous Reading Logic**:
1. Find most recent approved reading for same flat
2. If none exists, use `flat.initialReading`
3. If still none, default to 0

#### 2. **View History**
- **Tabs**: Approved / Rejected
- **Filter**: By flat ID
- **Shows**:
  - All readings with details
  - Previous/current readings
  - Units and amounts
  - Approval/rejection dates
  - Images
  - Receipts

#### 3. **Re-open Approved Reading**
- **Purpose**: Correct mistakes or handle disputes
- **Process**:
  1. Find approved reading in history
  2. Click "Re-open"
  3. Enter reason
  4. Reading status changes to `pending`
  5. Calculated values cleared
  6. Can be re-approved with new values

#### 4. **Manage Flats & Tenants**
- **Location**: `/admin/flats`
- **Process**:
  1. Enter flat ID (e.g., "A-101")
  2. Enter tenant name (optional)
  3. Enter initial reading (optional)
  4. Enter tariff per unit
  5. Enter username and password for tenant account
  6. Click "Create tenant & flat"

**Creates**:
- User document in `users` collection
- Flat document in `flats` collection
- Links them together

#### 5. **Manage Users**
- **Location**: `/admin/users`
- **Features**:
  - View all users (tenants and admins)
  - Search by username
  - Edit username
  - Reset password
  - See user roles

#### 6. **Configure Global Settings**
- **Location**: Admin Dashboard (`/admin`)
- **Settings**:
  - **Global Tariff**: Cost per unit/KG (applied to all new approvals)
  - **Unit Factor**: Conversion factor (e.g., 2.3 for "convicto Kg")
  - **Minimum Price**: Minimum bill amount (default: ₹25)

**Note**: Changes only affect future approvals. Historical readings preserve their `tariffAtApproval` values.

#### 7. **Set Initial Readings**
- **Location**: Admin Dashboard (`/admin`)
- **Purpose**: Set starting meter reading for flats without any approved readings
- **Shows**: Only flats that need initial reading configured
- **Process**: Enter value and save

#### 8. **Monthly Summary**
- **Location**: Admin Dashboard → "View Summary" button
- **Features**:
  - Select month from dropdown
  - View all approved readings for that month
  - See flat numbers, tenant names, readings, bill amounts
  - Download as PDF (A4 format, multi-page if needed)
  - Total bill amount for the month

**Flat Ordering**: Custom order defined in code (S1, A1, B1, C1, D1, Guest House, H1, A2-B2-C2-D2-E2-F2-G2-H2, A3-H3, A4-H4, P1-P2)

#### 9. **View Receipts**
- Admins can view/download receipts for any approved reading
- Same receipt format as tenants see

---

### Super User Features

#### 1. **Reset Admin Password**
- **Location**: `/superuser`
- **Process**:
  1. Select admin user from list
  2. Enter new password (min 6 characters)
  3. Confirm password
  4. Click "Reset Password"
  5. Admin password updated immediately

**Restrictions**:
- Can only reset admin passwords
- Cannot access regular admin features
- Requires Google OAuth authentication

---

## Editable Fields & Configuration

### Tenant-Editable Fields
**None** - Tenants can only upload photos and view their data.

---

### Admin-Editable Fields

#### 1. **Reading Fields** (during approval)
- `correctedReading`: Manual entry from photo
- `rejectionReason`: Optional reason for rejection

#### 2. **Flat Fields** (`/admin/flats`)
- `flatId`: Flat identifier
- `tenantName`: Display name
- `tariffPerUnit`: Per-flat tariff
- `initialReading`: Starting meter reading
- `username`: Tenant login username
- `password`: Tenant login password

#### 3. **User Fields** (`/admin/users`)
- `username`: Any user's username
- `password`: Any user's password (reset)

#### 4. **Global Settings** (Admin Dashboard)
- `tariffPerUnit`: Global tariff
- `unitFactor`: Unit conversion factor
- `minimumPrice`: Minimum bill amount

#### 5. **Reading Status** (Admin Dashboard)
- `status`: Can change from `pending` → `approved` or `rejected`
- Can re-open approved readings (back to `pending`)

---

### System-Generated Fields (Not Editable)

#### Reading Fields (auto-calculated on approval):
- `unitsUsed`: `correctedReading - previousReading`
- `amount`: Calculated from units and tariff
- `previousReading`: From previous approved reading or initial reading
- `tariffAtApproval`: Frozen at approval time
- `unitFactorAtApproval`: Frozen at approval time
- `approvedAt`: Timestamp when approved
- `yearMonth`: Calculated from `createdAt` (format: "YYYY-MM")

#### Receipt Fields (calculated on display):
- `kgConsumed`: Same as `unitsUsed`
- `totalKg`: `unitsUsed × unitFactorAtApproval`
- `energyAmount`: `totalKg × tariffAtApproval`
- `grandTotal`: `energyAmount + minimumCharge` (₹25)
- `dueDate`: `approvedAt + 5 days`

---

## Key Workflows

### Workflow 1: Tenant Uploads Reading

1. **Tenant logs in** → Redirected to `/tenant`
2. **Clicks "Upload meter photo"**
3. **Selects image file** → Image compressed to base64
4. **System checks**: Is there a pending/approved reading this month?
   - If YES → Error: "Upload limit reached"
   - If NO → Continue
5. **Reading created**:
   - `status`: `pending`
   - `imageUrl`: Base64 data URL
   - `yearMonth`: Current month (e.g., "2025-03")
   - `createdAt`: Current timestamp
6. **Admin sees reading** in pending list (real-time update)

---

### Workflow 2: Admin Approves Reading

1. **Admin logs in** → Redirected to `/admin`
2. **Views pending readings** → Sees photo and previous photo
3. **Enters corrected reading** manually
4. **Clicks "Approve"**
5. **System calculates**:
   - Finds previous approved reading for same flat
   - If none, uses `flat.initialReading`
   - If still none, uses 0
   - `unitsUsed` = `correctedReading - previousReading`
   - `amount` = `unitsUsed × globalTariff`
   - If `amount < minimumPrice`, set `amount = minimumPrice`
6. **Reading updated**:
   - `status`: `approved`
   - `correctedReading`: Admin-entered value
   - `previousReading`: Calculated previous value
   - `unitsUsed`: Calculated
   - `amount`: Calculated
   - `tariffAtApproval`: Current global tariff
   - `unitFactorAtApproval`: Current unit factor
   - `approvedAt`: Current timestamp
7. **Tenant sees approved reading** (real-time update)
8. **Tenant can download receipt**

---

### Workflow 3: Admin Rejects Reading

1. **Admin views pending reading**
2. **Enters rejection reason**
3. **Clicks "Reject"**
4. **Reading updated**:
   - `status`: `rejected`
   - `rejectionReason`: Admin-entered reason
5. **Tenant sees rejection** with reason
6. **Tenant can upload again** (rejected readings don't count toward monthly limit)

---

### Workflow 4: Admin Creates New Tenant

1. **Admin navigates to `/admin/flats`**
2. **Fills form**:
   - Flat ID: "A-101"
   - Tenant Name: "John Doe" (optional)
   - Initial Reading: 21091.10 (optional)
   - Tariff per Unit: 7.5
   - Username: "flat_a101"
   - Password: "password123"
3. **Clicks "Create tenant & flat"**
4. **System creates**:
   - User document in `users`:
     - `username`: "flat_a101"
     - `passwordHash`: SHA-256 hash of "password123"
     - `role`: "tenant"
     - `flatId`: "A-101"
   - Flat document in `flats`:
     - `flatId`: "A-101"
     - `tenantName`: "John Doe"
     - `tariffPerUnit`: 7.5
     - `userId`: Reference to user document ID
     - `initialReading`: 21091.10
5. **Tenant can now log in** with username/password

---

### Workflow 5: Receipt Generation

1. **User clicks "Download receipt"** (tenant or admin)
2. **System calculates**:
   - `kgConsumed` = `unitsUsed`
   - `totalKg` = `unitsUsed × unitFactorAtApproval`
   - `energyAmount` = `totalKg × tariffAtApproval`
   - `grandTotal` = `energyAmount + 25` (minimum charge)
   - `dueDate` = `approvedAt + 5 days`
3. **Receipt HTML rendered** with all values
4. **HTML converted to image** (html2canvas)
5. **Image added to PDF** (jsPDF, 80mm × 120mm format)
6. **PDF downloaded** with filename: `receipt-{flatId}-{yearMonth}.pdf`

---

### Workflow 6: Monthly Summary Generation

1. **Admin clicks "View Summary"** in dashboard
2. **Selects month** from dropdown
3. **System filters** approved readings for that month
4. **Groups by flat** and sorts by custom order
5. **Calculates totals**:
   - Bill amount per flat
   - Grand total for the month
6. **Admin clicks "Download PDF"**
7. **HTML table converted to image**
8. **Multi-page PDF generated** (A4 format)
9. **PDF downloaded** with filename: `summary-{yearMonth}.pdf`

---

## Technical Stack

### Dependencies

```json
{
  "react": "^19.2.0",
  "react-dom": "^19.2.0",
  "react-router-dom": "^7.10.1",
  "firebase": "^12.6.0",
  "tesseract.js": "^6.0.1",
  "jspdf": "^2.5.2",
  "classnames": "^2.5.1"
}
```

### Development Tools

```json
{
  "vite": "^7.2.4",
  "typescript": "~5.9.3",
  "eslint": "^9.39.1"
}
```

### Project Structure

```
smartmeter-vision/
├── src/
│   ├── components/          # Reusable UI components
│   │   ├── Layout.tsx
│   │   ├── MeterUploadForm.tsx
│   │   ├── ReadingCard.tsx
│   │   ├── ReceiptModal.tsx
│   │   ├── SummaryModal.tsx
│   │   ├── ImageViewerModal.tsx
│   │   ├── ProtectedRoute.tsx
│   │   └── SuperUserProtectedRoute.tsx
│   ├── pages/               # Page components
│   │   ├── LoginPage.tsx
│   │   ├── TenantDashboard.tsx
│   │   ├── AdminDashboard.tsx
│   │   ├── AdminFlatsPage.tsx
│   │   ├── AdminUsersPage.tsx
│   │   ├── SuperUserLoginPage.tsx
│   │   └── SuperUserDashboard.tsx
│   ├── services/            # Business logic & API calls
│   │   ├── firebase.ts      # Firebase initialization
│   │   ├── auth.ts          # Regular user authentication
│   │   ├── superUserAuth.ts # Super user authentication
│   │   ├── users.ts         # User CRUD operations
│   │   ├── flats.ts         # Flat CRUD operations
│   │   ├── readings.ts      # Reading CRUD operations
│   │   ├── ocr.ts           # OCR extraction (optional)
│   │   ├── settings.ts      # Global settings
│   │   └── security.ts      # Password hashing
│   ├── types/
│   │   └── models.ts        # TypeScript type definitions
│   ├── router/
│   │   └── Router.tsx       # Route configuration
│   ├── App.tsx
│   └── main.tsx
├── public/                  # Static assets
├── dist/                    # Build output
├── package.json
├── vite.config.ts
├── tsconfig.json
└── .env                     # Environment variables (not in repo)
```

---

## Setup & Configuration

### Prerequisites

1. **Node.js** (v18 or higher)
2. **npm** or **yarn**
3. **Firebase Project** with Firestore enabled
4. **Google Account** (for super user, if using)

### Step 1: Clone & Install

```bash
# Clone repository
git clone https://github.com/GlT-ignore/SmartMeter-Vision.git

# Install dependencies
npm install
```

### Step 2: Firebase Setup

1. **Create Firebase Project**:
   - Go to [Firebase Console](https://console.firebase.google.com/)
   - Create new project
   - Enable Firestore Database (start in test mode)

2. **Get Firebase Config**:
   - Go to Project Settings → General
   - Scroll to "Your apps"
   - Add web app if not exists
   - Copy config values

3. **Enable Google Sign-In** (for super user):
   - Go to Authentication → Sign-in method
   - Enable Google provider
   - Add authorized domains (localhost for dev, your domain for prod)

### Step 3: Environment Variables

Create `.env` file in project root:

```env
# Firebase Configuration
VITE_FIREBASE_API_KEY=your_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id

# Super User Email (for emergency admin password reset)
VITE_SUPER_USER_EMAIL=your-super-user@gmail.com
```

**Important**: Never commit `.env` file to version control!

### Step 4: Create Initial Admin User

Since authentication is custom, you need to manually create the first admin user in Firestore:

1. **Open Firestore Console**
2. **Create collection**: `users`
3. **Add document** with these fields:
   ```
   username: "admin"
   passwordHash: "8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918"
   role: "admin"
   flatId: null
   createdAt: <current timestamp in milliseconds>
   ```

**Note**: The password hash above is for password `"admin"`. Change it after first login!

**To generate your own password hash**, run this in browser console:
```javascript
async function hashPassword(password) {
  const encoder = new TextEncoder()
  const data = encoder.encode(password)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}
hashPassword('your-password').then(console.log)
```

### Step 5: Run Development Server

```bash
npm run dev
```

Application will be available at `http://localhost:5173`

### Step 6: Build for Production

```bash
npm run build
```

Output will be in `dist/` folder. Deploy to Vercel, Netlify, or any static hosting.

---

## Common Operations

### Creating a New Tenant

1. Login as admin
2. Go to `/admin/flats`
3. Fill form:
   - Flat ID: e.g., "A-102"
   - Tenant Name: e.g., "Jane Smith"
   - Initial Reading: e.g., 21500.50 (optional)
   - Tariff per Unit: e.g., 7.5
   - Username: e.g., "flat_a102"
   - Password: e.g., "secure123"
4. Click "Create tenant & flat"
5. Tenant can now login with username/password

### Changing a User's Password

**As Admin**:
1. Go to `/admin/users`
2. Find user in list
3. Click "Edit"
4. Enter new password
5. Click "Reset password"

**As Super User** (emergency):
1. Go to `/superuser/login`
2. Sign in with Google (authorized email only)
3. Select admin user
4. Enter new password
5. Confirm password
6. Click "Reset Password"

### Updating Global Tariff

1. Login as admin
2. Go to `/admin`
3. Scroll to "Tariff" section
4. Enter new "Global tariff" value
5. Click "Save tariff"
6. **Note**: Only affects future approvals, not historical readings

### Approving a Reading

1. Login as admin
2. View pending readings
3. Click "Current photo" to view meter image
4. Click "Previous photo" to compare (if available)
5. Enter "Corrected reading" manually
6. Optionally enter "Rejection reason" (if rejecting)
7. Click "Approve" or "Reject"

### Re-opening an Approved Reading

1. Login as admin
2. Go to "History" → "Approved" tab
3. Find the reading
4. Click "Re-open"
5. Enter reason (required)
6. Reading becomes `pending` again
7. Can be re-approved with new values

### Generating Monthly Summary

1. Login as admin
2. Click "View Summary" button
3. Select month from dropdown
4. Review summary table
5. Click "Download PDF" to save

### Viewing/Downloading Receipt

**As Tenant**:
1. Go to `/tenant`
2. Find approved reading
3. Click "Download receipt"
4. PDF downloads automatically

**As Admin**:
1. Go to `/admin` → "History" → "Approved"
2. Find reading
3. Click "View receipt"
4. Review and click "Download PDF"

---

## Troubleshooting

### Can't Login

**Symptoms**: Login fails with "Invalid username or password"

**Solutions**:
1. Verify user exists in Firestore `users` collection
2. Check `username` field matches exactly (case-sensitive)
3. Verify `passwordHash` is correct SHA-256 hash
4. Check browser console for errors
5. Verify Firestore rules allow read access

**To reset password**:
- Use super user feature (if admin)
- Or manually update `passwordHash` in Firestore

---

### Tenant Dashboard Shows "No flat linked"

**Symptoms**: Tenant sees "We could not find a flat for your account"

**Solutions**:
1. Check `users` document has correct `flatId` field
2. Verify `flats` collection has document with matching `flatId`
3. Check `flats` document has correct `userId` field (should match user document ID)
4. Verify user's `role` is `"tenant"` (not `"admin"`)

---

### Upload Fails: "Upload limit reached"

**Symptoms**: Tenant can't upload, sees "Upload limit reached"

**Solutions**:
1. Check if there's a pending or approved reading for current month
2. If reading is rejected, it doesn't count toward limit
3. If reading is pending, admin should approve or reject it
4. If reading is approved but wrong, admin can re-open it

**To allow upload**:
- Admin rejects the existing reading, OR
- Admin re-opens approved reading and rejects it, OR
- Wait until next calendar month

---

### Receipt Not Showing Tenant Name

**Symptoms**: Receipt shows "—" for tenant name

**Solutions**:
1. Verify `flats` document has `tenantName` field
2. Check `flatId` in reading matches `flatId` in flats collection
3. Refresh admin dashboard to reload flats data

---

### Super User Can't Login

**Symptoms**: "Access denied" or "Super user email not configured"

**Solutions**:
1. Verify `VITE_SUPER_USER_EMAIL` is set in `.env`
2. Restart dev server after changing `.env`
3. Verify Google Sign-In is enabled in Firebase Console
4. Check authorized domains include your domain
5. Verify email matches exactly (case-insensitive but must match)

---

### Images Not Loading

**Symptoms**: Meter photos don't display

**Solutions**:
1. Check `imageUrl` field in reading document (should be base64 data URL)
2. Verify image was compressed correctly (max 1200px width)
3. Check browser console for errors
4. Verify Firestore document size is under 1MB (Firestore limit)

---

### PDF Download Fails

**Symptoms**: Receipt or summary PDF doesn't download

**Solutions**:
1. Check browser console for errors
2. Verify `jspdf` and `html2canvas` are installed
3. Try different browser (Chrome recommended)
4. Check if popup blocker is blocking download

---

### Real-time Updates Not Working

**Symptoms**: Changes don't appear immediately

**Solutions**:
1. Verify Firestore real-time listeners are set up
2. Check Firestore rules allow read access
3. Verify network connection
4. Check browser console for Firestore errors

---

### Bill Calculation Seems Wrong

**Symptoms**: Amount doesn't match expected calculation

**Check**:
1. Verify `tariffAtApproval` value (frozen at approval time)
2. Check `unitFactorAtApproval` value
3. Verify `unitsUsed` = `correctedReading - previousReading`
4. Check if `amount` is less than `minimumPrice` (will be set to minimum)
5. Formula: `grandTotal = (unitsUsed × unitFactor × tariff) + minimumCharge`

---

## Important Notes

### Data Integrity

1. **Historical Readings**: Once approved, `tariffAtApproval` and `unitFactorAtApproval` are frozen. Changing global settings won't affect them.

2. **Monthly Limit**: One reading per calendar month per flat. Rejected readings don't count.

3. **Previous Reading**: Calculated from most recent approved reading, or `initialReading`, or 0.

4. **Minimum Price**: Always added to bills (default ₹25). Even if units consumed is 0, minimum charge applies.

### Security Considerations

1. **Password Hashing**: Uses SHA-256 (client-side). For production, consider server-side hashing with bcrypt/argon2.

2. **Image Storage**: Images stored as base64 in Firestore. For large scale, consider Cloud Storage.

3. **Authentication**: Custom implementation. Consider adding rate limiting and password strength requirements.

4. **Super User**: Only authorized email can access. Keep email secure and don't commit to version control.

### Performance

1. **Image Compression**: Images compressed to max 1200px width, ~85% quality to stay under Firestore 1MB limit.

2. **Real-time Listeners**: Used for pending/approved/rejected readings. Unsubscribe on component unmount.

3. **Client-side Sorting**: Readings sorted on client to avoid Firestore composite indexes.

### Future Enhancements

Consider adding:
- Email notifications for approvals/rejections
- SMS alerts
- Payment tracking
- Multi-currency support
- Advanced reporting/analytics
- Mobile app (React Native)
- Offline support (PWA)
- Bulk operations
- Export to Excel/CSV

---

## Contact & Support

For questions or issues:
1. Check this documentation first
2. Review code comments in source files
3. Check Firebase Console for data issues
4. Review browser console for errors

---

**Document Version**: 1.0  
**Last Updated**: 2025  
**Project**: SmartMeter Vision

