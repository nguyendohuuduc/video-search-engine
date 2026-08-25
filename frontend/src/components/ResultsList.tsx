import type { SearchResult } from "../api/client"
import { ResultCard } from "./ResultCard"

interface ResultsListProps {
  results: SearchResult[]
  hasSearched: boolean
  onSelect: (result: SearchResult) => void
}

export function ResultsList({ results, hasSearched, onSelect }: ResultsListProps) {
  if (!hasSearched) {
    return null
  }

  if (results.length === 0) {
    return <p className="px-1 text-sm text-gray-400">No results.</p>
  }

  return (
    <div className="flex flex-col gap-2">
      {results.map((result, i) => (
        <ResultCard
          key={`${result.video_id}-${result.match_type}-${result.timestamp}-${i}`}
          result={result}
          onSelect={onSelect}
        />
      ))}
    </div>
  )
}
