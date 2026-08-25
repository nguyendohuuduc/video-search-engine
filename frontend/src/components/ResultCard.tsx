import type { SearchResult } from "../api/client"

function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, "0")}`
}

interface ResultCardProps {
  result: SearchResult
  onSelect: (result: SearchResult) => void
}

export function ResultCard({ result, onSelect }: ResultCardProps) {
  const { video_title, timestamp, match_type, score, snippet, thumbnail_url } = result

  return (
    <button
      type="button"
      onClick={() => onSelect(result)}
      className="flex w-full gap-3 rounded-xl bg-white p-2.5 text-left shadow-sm ring-1 ring-gray-100 hover:ring-gray-300"
    >
      <div className="h-16 w-28 flex-shrink-0 overflow-hidden rounded-lg bg-gray-100">
        {thumbnail_url ? (
          <img src={thumbnail_url} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-[11px] text-gray-400">no thumbnail</div>
        )}
      </div>

      <div className="min-w-0 flex-1 py-0.5">
        <div className="flex items-center gap-1.5 text-xs text-gray-400">
          <span className="truncate font-medium text-gray-900">{video_title}</span>
          <span>·</span>
          <span className="flex-shrink-0">{formatTimestamp(timestamp)}</span>
          <span
            className={
              "flex-shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide " +
              (match_type === "frame" ? "bg-blue-50 text-blue-600" : "bg-green-50 text-green-600")
            }
          >
            {match_type === "frame" ? "seen" : "said"}
          </span>
          <span className="ml-auto flex-shrink-0 tabular-nums">{Math.round(score * 100)}%</span>
        </div>

        {snippet && <p className="mt-1.5 truncate text-sm text-gray-600">"{snippet}"</p>}
      </div>
    </button>
  )
}
