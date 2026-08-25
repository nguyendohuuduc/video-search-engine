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
    <form onSubmit={handleSubmit} className="relative">
      <svg viewBox="0 0 24 24" fill="none" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400">
        <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
        <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder='Search your videos, e.g. "a dog" or "explained the pricing model"'
        className="w-full rounded-xl border-0 bg-white py-3 pl-10 pr-24 text-sm text-gray-900 placeholder:text-gray-400 shadow-sm ring-1 ring-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-900"
      />
      <button
        type="submit"
        disabled={loading || query.trim().length === 0}
        className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg bg-gray-900 px-3.5 py-1.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
      >
        {loading ? "..." : "Search"}
      </button>
    </form>
  )
}
