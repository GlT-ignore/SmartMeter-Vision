import type { FormEvent } from 'react'
import { useState } from 'react'
import { createReadingFromImage, uploadMeterImage } from '../services/readings'

interface Props {
  flatId: string
  onComplete?: () => void
}

const MeterUploadForm = ({ flatId, onComplete }: Props) => {
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!file) {
      setError('Please choose a meter photo.')
      return
    }
    setError(null)
    setMessage(null)
    setUploading(true)
    try {
      const imageUrl = await uploadMeterImage(flatId, file)
      await createReadingFromImage(flatId, imageUrl)
      setMessage('Image uploaded successfully. Your reading will be reviewed by an admin.')
      setFile(null)
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
          capture="environment"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <p className="small">Tip: Take a clear, well-lit photo. Mobile camera capture is supported.</p>
        <p className="small muted">Limit: one upload per calendar month.</p>
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

