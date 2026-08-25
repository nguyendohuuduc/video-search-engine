import { useState } from "react"
import { searchVideos, type SearchResult } from "./api/client"
import { ResultsList } from "./components/ResultsList"
import { SearchBar } from "./components/SearchBar"

function App() {
  const [results, setResults] = useState<SearchResult[]>([])
  const [hasSearched, setHasSearched] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSearch(query: string) {
    setLoading(true)
    setError(null)
    try {
      const data = await searchVideos(query)
      setResults(data)
      setHasSearched(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="mb-1 text-2xl font-semibold text-gray-900">Video Search</h1>
      <p className="mb-6 text-gray-500">Search your videos by what's said or what's on screen.</p>

      <SearchBar onSearch={handleSearch} loading={loading} />

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <div className="mt-6">
        <ResultsList results={results} hasSearched={hasSearched} />
      </div>
    </div>
  )
}

export default App
