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
  onDelete: (video: Video) => void
}

export function VideoLibrary({ videos, onSelect, onDelete }: VideoLibraryProps) {
  const [expandedError, setExpandedError] = useState<number | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState<number | null>(null)

  if (videos.length === 0) {
    return <p className="px-1 text-sm text-gray-400">No videos yet — upload one above.</p>
  }

  return (
    <div className="flex flex-col gap-1.5">
      {videos.map((video) => (
        <div key={video.video_id}>
          <div
            className={
              "group flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2 text-sm shadow-sm ring-1 ring-gray-100 " +
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
              <button
                type="button"
                title="Delete video"
                onClick={(e) => {
                  e.stopPropagation()
                  setConfirmingDelete(video.video_id)
                }}
                className="rounded p-1 text-gray-300 opacity-0 hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
              >
                <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5">
                  <path d="M5 7h14M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2m1 0v13a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V7h10Z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </span>
          </div>

          {video.status === "failed" && expandedError === video.video_id && (
            <p className="mt-1 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
              {video.error ?? "Ingestion failed for an unknown reason."}
            </p>
          )}

          {confirmingDelete === video.video_id && (
            <div className="mt-1 flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
              <span className="flex-1">Delete "{video.original_name}"? This can't be undone.</span>
              <button
                type="button"
                onClick={() => {
                  setConfirmingDelete(null)
                  onDelete(video)
                }}
                className="flex-shrink-0 rounded-md bg-red-600 px-2 py-1 font-medium text-white hover:bg-red-700"
              >
                Delete
              </button>
              <button
                type="button"
                onClick={() => setConfirmingDelete(null)}
                className="flex-shrink-0 rounded-md border border-red-200 px-2 py-1 font-medium text-red-700 hover:bg-red-100"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
