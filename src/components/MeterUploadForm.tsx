import type { FormEvent } from 'react'
import { useState } from 'react'
import { createReadingFromImage, uploadMeterImage } from '../services/readings'

interface Props {
  flatId: string
  onComplete?: () => void
}

const MeterUploadForm = ({ flatId, onComplete }: Props) => {
  const [file, setFile] = useState<File | null>(null)
  const [tenantReading, setTenantReading] = useState<string>('')
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!file) {
      setError('Please choose a meter photo.')
      return
    }

    // Validate tenant reading (required)
    const readingValue = tenantReading.trim()
    if (!readingValue) {
      setError('Please enter the meter reading value.')
      return
    }

    const parsedReading = Number(readingValue)
    if (Number.isNaN(parsedReading)) {
      setError('Please enter a valid meter reading number.')
      return
    }

    setError(null)
    setMessage(null)
    setUploading(true)
    try {
      const imageUrl = await uploadMeterImage(flatId, file)
      await createReadingFromImage(flatId, imageUrl, parsedReading)
      setMessage('Image uploaded successfully. Your reading will be reviewed by an admin.')
      setFile(null)
      setTenantReading('')
      if (onComplete) onComplete()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <form className="stack" onSubmit={handleSubmit}>
      <div>
        <label className="label" htmlFor="file">
          Meter photo
        </label>
        <input
          id="file"
          className="input"
          type="file"
          accept="image/*"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <p className="small">Tip: Take a clear, well-lit photo. Mobile camera or gallery upload is supported.</p>
        <p className="small muted">Limit: one upload per calendar month.</p>
      </div>
      <div>
        <label className="label" htmlFor="tenant-reading">
          Meter reading <span style={{ color: 'var(--color-error, #d32f2f)' }}>*</span>
        </label>
        <input
          id="tenant-reading"
          className="input"
          type="number"
          step="0.001"
          placeholder="Enter the meter reading value (e.g., 21091.981)"
          value={tenantReading}
          onChange={(e) => setTenantReading(e.target.value)}
          required
        />
        <p className="small muted">Enter the meter reading value shown in the photo. Admin will cross-verify.</p>
      </div>
      <button className="btn btn-primary" type="submit" disabled={uploading}>
        {uploading ? 'Uploading…' : 'Upload meter photo'}
      </button>
      {message ? <div className="status approved">{message}</div> : null}
      {error ? <div className="status rejected">{error}</div> : null}
    </form>
  )
}

export default MeterUploadForm

