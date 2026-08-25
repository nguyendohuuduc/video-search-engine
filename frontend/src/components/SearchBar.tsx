import { useState } from "react"

interface SearchBarProps {
  onSearch: (query: string) => void
  loading: boolean
}

export function SearchBar({ onSearch, loading }: SearchBarProps) {
  const [query, setQuery] = useState("")

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = query.trim()
    if (trimmed) {
      onSearch(trimmed)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder='Search your videos, e.g. "a dog" or "explained the pricing model"'
        className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-base focus:outline-none focus:ring-2 focus:ring-purple-400"
      />
      <button
        type="submit"
        disabled={loading || query.trim().length === 0}
        className="rounded-lg bg-purple-600 px-5 py-2 font-medium text-white disabled:opacity-50"
      >
        {loading ? "Searching..." : "Search"}
      </button>
    </form>
  )
}
