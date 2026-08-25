import type { Video } from "../api/client"

function formatDuration(seconds: number | null): string {
  if (seconds == null) return "--:--"
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, "0")}`
}

const STATUS_STYLES: Record<Video["status"], string> = {
  pending: "bg-gray-100 text-gray-600",
  processing: "bg-yellow-100 text-yellow-700",
  ready: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
}

interface VideoLibraryProps {
  videos: Video[]
  onSelect: (video: Video) => void
}

export function VideoLibrary({ videos, onSelect }: VideoLibraryProps) {
  if (videos.length === 0) {
    return <p className="text-sm text-gray-400">No videos yet — upload one above.</p>
  }

  return (
    <div className="flex flex-col gap-1.5">
      {videos.map((video) => (
        <button
          key={video.video_id}
          type="button"
          onClick={() => onSelect(video)}
          disabled={video.status !== "ready"}
          className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 px-3 py-2 text-left text-sm hover:border-purple-300 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span className="truncate text-gray-900">{video.original_name}</span>
          <span className="flex flex-shrink-0 items-center gap-2">
            <span className="text-gray-400">{formatDuration(video.duration_sec)}</span>
            <span className={"rounded px-1.5 py-0.5 text-xs font-medium " + STATUS_STYLES[video.status]}>
              {video.status}
            </span>
          </span>
        </button>
      ))}
    </div>
  )
}
