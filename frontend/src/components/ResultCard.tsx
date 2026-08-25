import type { SearchResult } from "../api/client"

function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, "0")}`
}

interface ResultCardProps {
  result: SearchResult
}

export function ResultCard({ result }: ResultCardProps) {
  const { video_title, timestamp, match_type, score, snippet, thumbnail_url } = result

  return (
    <div className="flex gap-3 rounded-lg border border-gray-200 p-3 hover:border-purple-300">
      <div className="h-20 w-32 flex-shrink-0 overflow-hidden rounded bg-gray-100">
        {thumbnail_url ? (
          <img src={thumbnail_url} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-gray-400">no thumbnail</div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span className="truncate font-medium text-gray-900">{video_title}</span>
          <span>·</span>
          <span>{formatTimestamp(timestamp)}</span>
          <span
            className={
              "rounded px-1.5 py-0.5 text-xs font-medium " +
              (match_type === "frame" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700")
            }
          >
            {match_type === "frame" ? "seen" : "said"}
          </span>
          <span className="ml-auto text-xs text-gray-400">score {score.toFixed(2)}</span>
        </div>

        {snippet && <p className="mt-1 truncate text-sm text-gray-600">"{snippet}"</p>}
      </div>
    </div>
  )
}
