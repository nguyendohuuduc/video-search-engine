import { useEffect, useRef, useState } from "react"
import { deleteVideo, listVideos, searchVideos, type SearchResult, type Video } from "./api/client"
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
  stopAt: number
}

// Frame matches are a single instant (no natural duration), so give them a
// short window of context around the match instead of a frozen moment.
// Transcript matches already have a real chunk span in the DB - use it as-is.
const FRAME_CLIP_PADDING_BEFORE_SEC = 1
const FRAME_CLIP_PADDING_AFTER_SEC = 2

function getPlaybackWindow(result: SearchResult): { start: number; stop: number } {
  if (result.match_type === "frame") {
    return {
      start: Math.max(0, result.timestamp - FRAME_CLIP_PADDING_BEFORE_SEC),
      stop: result.timestamp + FRAME_CLIP_PADDING_AFTER_SEC,
    }
  }
  return { start: result.timestamp, stop: result.end_timestamp }
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
    setSelection(null) // a new search replaces whatever was playing, not just the results list
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
    const { start, stop } = getPlaybackWindow(result)
    setSelection({
      videoId: result.video_id,
      videoTitle: result.video_title,
      videoUrl: result.video_url,
      timestamp: start,
      stopAt: stop,
    })
  }

  function handleSelectVideo(video: Video) {
    setSelection({
      videoId: video.video_id,
      videoTitle: video.original_name,
      videoUrl: video.video_url,
      timestamp: 0,
      stopAt: Infinity, // browsing the library plays the whole video, not a clipped chunk
    })
  }

  async function handleDeleteVideo(video: Video) {
    try {
      await deleteVideo(video.video_id)
      refreshVideos()
      setResults((prev) => prev.filter((r) => r.video_id !== video.video_id))
      setSelection((prev) => (prev?.videoId === video.video_id ? null : prev))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed")
    }
  }

  const markersForSelectedVideo = selection
    ? results
        .filter((r) => r.video_id === selection.videoId)
        .map((r) => {
          const { start, stop } = getPlaybackWindow(r)
          return { position: r.timestamp, seekTo: start, stopAt: stop, matchType: r.match_type }
        })
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

          <VideoLibrary videos={videos} onSelect={handleSelectVideo} onDelete={handleDeleteVideo} />

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
              stopAt={selection.stopAt}
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
