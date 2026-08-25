import { useEffect, useState } from "react"
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
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="mb-1 text-2xl font-semibold text-gray-900">Video Search</h1>
      <p className="mb-6 text-gray-500">Search your videos by what's said or what's on screen.</p>

      <UploadPanel onUploaded={refreshVideos} />

      <div className="mt-4">
        <VideoLibrary videos={videos} onSelect={handleSelectVideo} />
      </div>

      <div className="mt-8">
        <SearchBar onSearch={handleSearch} loading={loading} />
      </div>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      {selection && (
        <div className="mt-6">
          <VideoPlayer
            videoId={selection.videoId}
            videoTitle={selection.videoTitle}
            videoUrl={selection.videoUrl}
            seekTo={selection.timestamp}
            markers={markersForSelectedVideo}
          />
        </div>
      )}

      <div className="mt-6">
        <ResultsList results={results} hasSearched={hasSearched} onSelect={handleSelectResult} />
      </div>
    </div>
  )
}

export default App
