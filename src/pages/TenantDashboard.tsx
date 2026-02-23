import { useEffect, useMemo, useState } from 'react'

import Layout from '../components/Layout'

import MeterUploadForm from '../components/MeterUploadForm'

import ReadingCard from '../components/ReadingCard'

import { useAuthState } from '../services/auth'

import { getFlatByUserId } from '../services/flats'

import { getTenantReadings } from '../services/readings'

import type { Flat, Reading } from '../types/models'



type ReadingWithPreviousImage = {

  reading: Reading

  previousImageUrl?: string | null

}



const TenantDashboard = () => {

  const { user } = useAuthState()

  const [flat, setFlat] = useState<Flat | null>(null)

  const [readings, setReadings] = useState<ReadingWithPreviousImage[]>([])

  const [loading, setLoading] = useState(true)

  const flatId = useMemo(() => flat?.flatId ?? flat?.id ?? '', [flat])



  useEffect(() => {

    const run = async () => {

      if (!user?.id) {

        setLoading(false)

        return

      }

      const tenantFlat = await getFlatByUserId(user.id)

      setFlat(tenantFlat)

      setLoading(false)

    }

    run()

  }, [user])



  useEffect(() => {

    const loadReadings = async () => {

      if (!flatId) return

      const data = await getTenantReadings(flatId)



      // Compute the previous approved reading image per entry so tenants can

      // visually compare the last approved meter photo with the current one.

      const sortedByTimeAsc = [...data].sort(

        (a, b) => (a.approvedAt || a.createdAt || 0) - (b.approvedAt || b.createdAt || 0),

      )



      const previousImageMap: Record<string, string | null> = {}

      const lastApprovedByFlat: Record<string, Reading | null> = {}



      for (const r of sortedByTimeAsc) {

        const lastApproved = lastApprovedByFlat[r.flatId]

        previousImageMap[r.id] = lastApproved?.imageUrl ?? null



        if (r.status === 'approved') {

          lastApprovedByFlat[r.flatId] = r

        }

      }



      const withPrevious: ReadingWithPreviousImage[] = data.map((reading) => ({

        reading,

        previousImageUrl: previousImageMap[reading.id] ?? null,

      }))



      setReadings(withPrevious)

    }

    loadReadings()

  }, [flatId])



  const refreshReadings = async () => {

    if (!flatId) return

    const data = await getTenantReadings(flatId)



    const sortedByTimeAsc = [...data].sort(

      (a, b) => (a.approvedAt || a.createdAt || 0) - (b.approvedAt || b.createdAt || 0),

    )



    const previousImageMap: Record<string, string | null> = {}

    const lastApprovedByFlat: Record<string, Reading | null> = {}



    for (const r of sortedByTimeAsc) {

      const lastApproved = lastApprovedByFlat[r.flatId]

      previousImageMap[r.id] = lastApproved?.imageUrl ?? null



      if (r.status === 'approved') {

        lastApprovedByFlat[r.flatId] = r

      }

    }



    const withPrevious: ReadingWithPreviousImage[] = data.map((reading) => ({

      reading,

      previousImageUrl: previousImageMap[reading.id] ?? null,

    }))



    setReadings(withPrevious)

  }



  if (!user) {

    return null

  }



  if (loading) {

    return (

      <Layout username={user.username} role="tenant" subtitle="Loading your data..." name={flat?.ownerName || flat?.tenantName || null}>

        <div className="card">Loading...</div>

      </Layout>

    )

  }



  if (!flatId) {

    return (

      <Layout username={user.username} role="tenant" subtitle="No flat linked to this account" name={flat?.ownerName || flat?.tenantName || null}>

        <div className="card">

          <p className="muted">We could not find a flat for your account. Please contact an admin.</p>

        </div>

      </Layout>

    )

  }



  return (

    <Layout

      username={user.username}

      role="tenant"

      subtitle={`Flat ${flatId} — upload your meter photo and track status.`}

      name={flat?.ownerName || flat?.tenantName || null}

    >

      <div className="section">

        <div className="card">

          <div className="card-header">

            <div>

              <h2 className="card-title">Upload meter photo</h2>

              <p className="card-subtitle">We will auto-read using OCR; admin will verify.</p>

            </div>

          </div>

          <MeterUploadForm flatId={flatId} onComplete={refreshReadings} />

        </div>



        <div className="card">

          <div className="card-header">

            <h2 className="card-title">Recent submissions</h2>

            <span className="pill">{readings.length} entries</span>

          </div>

          <div className="stack">

            {readings.length === 0 ? (

              <p className="muted">No submissions yet. Upload your first meter photo.</p>

            ) : (

              readings.map(({ reading, previousImageUrl }) => (

                <ReadingCard

                  key={reading.id}

                  reading={reading}

                  previousImageUrl={previousImageUrl}

                  ownerName={flat?.ownerName || flat?.tenantName || null}

                />

              ))

            )}

          </div>

        </div>

      </div>

    </Layout>

  )

}



export default TenantDashboard

