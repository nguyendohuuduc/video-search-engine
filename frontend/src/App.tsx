import { useEffect, useRef, useState } from "react"
import { listVideos, searchVideos, type SearchResult, type Video } from "./api/client"
import { ResultsList } from "./components/ResultsList"
import { SearchBar } from "./components/SearchBar"
import { UploadPanel } from "./components/UploadPanel"
import { VideoLibrary } from "./components/VideoLibrary"
import { VideoPlayer } from "./components/VideoPlayer"

interface Selection {
  videoId: number
  videoTitle: string
  videoUrl: string
  timestamp: number
}

function App() {
  const [results, setResults] = useState<SearchResult[]>([])
  const [hasSearched, setHasSearched] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selection, setSelection] = useState<Selection | null>(null)
  const [videos, setVideos] = useState<Video[]>([])
  const searchRequestId = useRef(0)

  function refreshVideos() {
    listVideos()
      .then(setVideos)
      .catch(() => {
        // Library refresh failing silently is acceptable here - it's a
        // secondary view, not the primary search flow.
      })
  }

  useEffect(refreshVideos, [])

  async function handleSearch(query: string) {
    // Guards against out-of-order responses: if a newer search starts before
    // an older one's response arrives, the older one must not be allowed to
    // overwrite the newer results when it finally resolves.
    const requestId = ++searchRequestId.current
    setLoading(true)
    setError(null)
    try {
      const data = await searchVideos(query)
      if (requestId !== searchRequestId.current) return
      setResults(data)
      setHasSearched(true)
    } catch (e) {
      if (requestId !== searchRequestId.current) return
      setError(e instanceof Error ? e.message : "Search failed")
    } finally {
      if (requestId === searchRequestId.current) setLoading(false)
    }
  }

  function handleSelectResult(result: SearchResult) {
    setSelection({
      videoId: result.video_id,
      videoTitle: result.video_title,
      videoUrl: result.video_url,
      timestamp: result.timestamp,
    })
  }

  function handleSelectVideo(video: Video) {
    setSelection({
      videoId: video.video_id,
      videoTitle: video.original_name,
      videoUrl: video.video_url,
      timestamp: 0,
    })
  }

  const markersForSelectedVideo = selection
    ? results
        .filter((r) => r.video_id === selection.videoId)
        .map((r) => ({ timestamp: r.timestamp, matchType: r.match_type }))
    : []

  return (
    <div className="min-h-screen bg-[#f7f7f8]">
      <div className="mx-auto max-w-2xl px-4 py-12">
        <header className="mb-8 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-900">
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 text-white">
              <path d="M4 6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6Z" stroke="currentColor" strokeWidth="1.6" />
              <path d="m16 10 4-2v8l-4-2" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-semibold leading-tight text-gray-900">Video Search</h1>
            <p className="text-sm text-gray-500">Search by what's said or what's on screen</p>
          </div>
        </header>

        <div className="flex flex-col gap-4">
          <UploadPanel onUploaded={refreshVideos} />

          <VideoLibrary videos={videos} onSelect={handleSelectVideo} />

          <SearchBar onSearch={handleSearch} loading={loading} />

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
          )}

          {selection && (
            <VideoPlayer
              videoId={selection.videoId}
              videoTitle={selection.videoTitle}
              videoUrl={selection.videoUrl}
              seekTo={selection.timestamp}
              markers={markersForSelectedVideo}
            />
          )}

          <ResultsList results={results} hasSearched={hasSearched} onSelect={handleSelectResult} />
        </div>
      </div>
    </div>
  )
}

export default App
