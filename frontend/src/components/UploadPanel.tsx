import { useRef, useState } from "react"
import { getVideo, uploadVideo, type VideoStatus } from "../api/client"

interface UploadPanelProps {
  onUploaded: () => void
}

export function UploadPanel({ onUploaded }: UploadPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<VideoStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)

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

    setFileName(file.name)
    setError(null)
    setStatus("pending")

    try {
      const { video_id, status: initialStatus } = await uploadVideo(file)
      setStatus(initialStatus)
      await pollUntilDone(video_id)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed")
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  const isBusy = status === "pending" || status === "processing"

  return (
    <div className="rounded-lg border border-dashed border-gray-300 p-4">
      <label className="flex cursor-pointer items-center justify-between gap-3">
        <span className="text-sm text-gray-600">
          {fileName ? `Uploading: ${fileName}` : "Upload a video to search"}
        </span>
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

      {status && (
        <p className="mt-2 text-sm">
          {status === "pending" && <span className="text-gray-500">Uploaded, waiting to process...</span>}
          {status === "processing" && <span className="text-gray-500">Processing (frames, transcript, embeddings)...</span>}
          {status === "ready" && <span className="text-green-600">Ready — try searching for it.</span>}
          {status === "failed" && <span className="text-red-600">Failed: {error}</span>}
        </p>
      )}
    </div>
  )
}
