import { useState } from "react"
import type { Video } from "../api/client"

function formatDuration(seconds: number | null): string {
  if (seconds == null) return "--:--"
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, "0")}`
}

const STATUS_DOT: Record<Video["status"], string> = {
  pending: "bg-gray-400",
  processing: "bg-amber-400",
  ready: "bg-green-500",
  failed: "bg-red-500",
}

interface VideoLibraryProps {
  videos: Video[]
  onSelect: (video: Video) => void
}

export function VideoLibrary({ videos, onSelect }: VideoLibraryProps) {
  const [expandedError, setExpandedError] = useState<number | null>(null)

  if (videos.length === 0) {
    return <p className="px-1 text-sm text-gray-400">No videos yet — upload one above.</p>
  }

  return (
    <div className="flex flex-col gap-1.5">
      {videos.map((video) => (
        <div key={video.video_id}>
          <div
            className={
              "flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2 text-sm shadow-sm ring-1 ring-gray-100 " +
              (video.status === "ready" ? "cursor-pointer hover:ring-gray-300" : "")
            }
            onClick={() => {
              if (video.status === "ready") onSelect(video)
              else if (video.status === "failed") setExpandedError(expandedError === video.video_id ? null : video.video_id)
            }}
          >
            <span className="flex min-w-0 items-center gap-2">
              <span className={"h-1.5 w-1.5 flex-shrink-0 rounded-full " + STATUS_DOT[video.status]} />
              <span className="truncate text-gray-900">{video.original_name}</span>
            </span>
            <span className="flex flex-shrink-0 items-center gap-2 text-xs text-gray-400">
              <span>{formatDuration(video.duration_sec)}</span>
              <span className="capitalize">{video.status}</span>
            </span>
          </div>

          {video.status === "failed" && expandedError === video.video_id && (
            <p className="mt-1 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
              {video.error ?? "Ingestion failed for an unknown reason."}
            </p>
          )}
        </div>
      ))}
    </div>
  )
}
