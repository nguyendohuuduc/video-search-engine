import { useRef, useState } from "react"
import { getVideo, uploadVideo, uploadVideoFromYoutube, type VideoStatus } from "../api/client"

interface UploadPanelProps {
  onUploaded: () => void
}

export function UploadPanel({ onUploaded }: UploadPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<VideoStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [label, setLabel] = useState<string | null>(null)
  const [youtubeUrl, setYoutubeUrl] = useState("")

  async function pollUntilDone(videoId: number) {
    while (true) {
      await new Promise((resolve) => setTimeout(resolve, 2000))
      const video = await getVideo(videoId)
      setStatus(video.status)
      if (video.status === "ready") {
        onUploaded()
        return
      }
      if (video.status === "failed") {
        setError(video.error ?? "Ingestion failed")
        return
      }
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setLabel(file.name)
    setError(null)
    setStatus("pending")

    try {
      const { video_id, status: initialStatus } = await uploadVideo(file)
      setStatus(initialStatus)
      onUploaded()
      await pollUntilDone(video_id)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed")
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  async function handleYoutubeSubmit(e: React.FormEvent) {
    e.preventDefault()
    const url = youtubeUrl.trim()
    if (!url) return

    setLabel(url)
    setError(null)
    setStatus("pending")

    try {
      const { video_id, status: initialStatus } = await uploadVideoFromYoutube(url)
      setStatus(initialStatus)
      setYoutubeUrl("")
      onUploaded()
      await pollUntilDone(video_id)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed")
    }
  }

  const isBusy = status === "pending" || status === "processing"

  return (
    <div className="rounded-lg border border-dashed border-gray-300 p-4">
      <label className="flex cursor-pointer items-center justify-between gap-3">
        <span className="text-sm text-gray-600">Upload a video file</span>
        <span className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
          Choose file
        </span>
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          onChange={handleFileChange}
          disabled={isBusy}
          className="hidden"
        />
      </label>

      <form onSubmit={handleYoutubeSubmit} className="mt-3 flex items-center gap-2 border-t border-gray-200 pt-3">
        <span className="flex-shrink-0 text-sm text-gray-600">or a YouTube link</span>
        <input
          type="url"
          value={youtubeUrl}
          onChange={(e) => setYoutubeUrl(e.target.value)}
          placeholder="https://youtube.com/watch?v=..."
          disabled={isBusy}
          className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
        />
        <button
          type="submit"
          disabled={isBusy || youtubeUrl.trim().length === 0}
          className="flex-shrink-0 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          Add
        </button>
      </form>

      {status && (
        <p className="mt-2 truncate text-sm">
          <span className="text-gray-400">{label}: </span>
          {status === "pending" && <span className="text-gray-500">Waiting to process...</span>}
          {status === "processing" && <span className="text-gray-500">Processing (download, frames, transcript, embeddings)...</span>}
          {status === "ready" && <span className="text-green-600">Ready — try searching for it.</span>}
          {status === "failed" && <span className="text-red-600">Failed: {error}</span>}
        </p>
      )}
    </div>
  )
}
