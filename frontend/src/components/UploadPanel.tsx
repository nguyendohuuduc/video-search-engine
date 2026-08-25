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
        onUploaded()
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
      setStatus("failed")
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
      setStatus("failed")
      setError(err instanceof Error ? err.message : "Import failed")
    }
  }

  const isBusy = status === "pending" || status === "processing"

  return (
    <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="flex flex-1 cursor-pointer items-center justify-between gap-3 rounded-lg border border-dashed border-gray-300 px-3 py-2 hover:border-gray-400">
          <span className="flex items-center gap-2 text-sm text-gray-600">
            <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 flex-shrink-0 text-gray-400">
              <path d="M12 16V4m0 0 4 4m-4-4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            Upload a video file
          </span>
          <span className="flex-shrink-0 rounded-md bg-gray-900 px-3 py-1.5 text-xs font-medium text-white">
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
      </div>

      <form onSubmit={handleYoutubeSubmit} className="mt-3 flex items-center gap-2">
        <span className="flex-shrink-0 text-sm text-gray-400">or paste a link</span>
        <input
          type="url"
          value={youtubeUrl}
          onChange={(e) => setYoutubeUrl(e.target.value)}
          placeholder="https://youtube.com/watch?v=..."
          disabled={isBusy}
          className="min-w-0 flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-gray-900 focus:outline-none"
        />
        <button
          type="submit"
          disabled={isBusy || youtubeUrl.trim().length === 0}
          className="flex-shrink-0 rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Add
        </button>
      </form>

      {status && (
        <div className="mt-3 flex items-center gap-2 border-t border-gray-100 pt-3 text-sm">
          {isBusy && (
            <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5 flex-shrink-0 animate-spin text-gray-400">
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" strokeOpacity="0.25" />
              <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          )}
          {status === "ready" && (
            <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5 flex-shrink-0 text-green-600">
              <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
          {status === "failed" && (
            <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5 flex-shrink-0 text-red-600">
              <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          )}
          <span className="truncate text-gray-400">{label}</span>
          <span className="flex-shrink-0">
            {status === "pending" && <span className="text-gray-500">waiting to process...</span>}
            {status === "processing" && <span className="text-gray-500">processing...</span>}
            {status === "ready" && <span className="text-green-600">ready</span>}
            {status === "failed" && <span className="text-red-600">failed — {error}</span>}
          </span>
        </div>
      )}
    </div>
  )
}
