import { useEffect, useRef, useState } from "react"
import { deleteVideo, listVideos, searchVideos, type SearchResult, type Video } from "./api/client"
import { ResultsList } from "./components/ResultsList"
import { SearchBar } from "./components/SearchBar"
import { UploadPanel } from "./components/UploadPanel"
import { VideoLibrary } from "./components/VideoLibrary"
import { VideoPlayer } from "./components/VideoPlayer"

interface Selection {
  key: string // stable per distinct (video, chunk) - lets a repeat click re-trigger the same player instead of adding a duplicate
  trigger: number // bumped on every click, even a repeat one, so the player re-seeks even if timestamp/stopAt didn't change
  colorIndex: number // ties this player visually to the result card that opened it
  videoTitle: string
  videoUrl: string
  timestamp: number
  stopAt: number
}

function resultKey(result: SearchResult): string {
  return `${result.video_id}-${result.match_type}-${result.timestamp}`
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
  const [selections, setSelections] = useState<Selection[]>([])
  const [videos, setVideos] = useState<Video[]>([])
  const searchRequestId = useRef(0)
  const selectionCounter = useRef(0)
  // Assigns each distinct chunk key a color once and remembers it for the
  // rest of the session (even after closing/reopening) - a player's color
  // should never shift around just because other players opened or closed.
  const colorAssignments = useRef(new Map<string, number>())
  const nextColorIndex = useRef(0)

  function colorIndexFor(key: string): number {
    if (!colorAssignments.current.has(key)) {
      colorAssignments.current.set(key, nextColorIndex.current++)
    }
    return colorAssignments.current.get(key)!
  }

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
    setSelections([]) // a new search replaces whatever was playing, not just the results list
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

  // Opens a new player for this (key), or - if one's already open for the
  // exact same chunk - just re-triggers it in place rather than stacking a
  // duplicate.
  function openPlayer(entry: Omit<Selection, "trigger" | "colorIndex">) {
    setSelections((prev) => {
      const next: Selection = { ...entry, trigger: ++selectionCounter.current, colorIndex: colorIndexFor(entry.key) }
      const existingIndex = prev.findIndex((s) => s.key === entry.key)
      if (existingIndex === -1) return [...prev, next]
      const copy = [...prev]
      copy[existingIndex] = next
      return copy
    })
  }

  function handleSelectResult(result: SearchResult) {
    const { start, stop } = getPlaybackWindow(result)
    openPlayer({
      key: resultKey(result),
      videoTitle: result.video_title,
      videoUrl: result.video_url,
      timestamp: start,
      stopAt: stop,
    })
  }

  function getOpenColorIndex(result: SearchResult): number | undefined {
    return selections.find((s) => s.key === resultKey(result))?.colorIndex
  }

  function handleSelectVideo(video: Video) {
    openPlayer({
      key: `${video.video_id}-full`,
      videoTitle: video.original_name,
      videoUrl: video.video_url,
      timestamp: 0,
      stopAt: Infinity, // browsing the library plays the whole video, not a clipped chunk
    })
  }

  function handleClosePlayer(key: string) {
    setSelections((prev) => prev.filter((s) => s.key !== key))
  }

  async function handleDeleteVideo(video: Video) {
    try {
      await deleteVideo(video.video_id)
      refreshVideos()
      setResults((prev) => prev.filter((r) => r.video_id !== video.video_id))
      setSelections((prev) => prev.filter((s) => !s.key.startsWith(`${video.video_id}-`)))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed")
    }
  }

  return (
    <div className="min-h-screen bg-[#f7f7f8]">
      <div className={"mx-auto px-4 py-12 " + (selections.length > 0 ? "max-w-6xl" : "max-w-2xl")}>
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
        </div>

        {/* Two-column split starts here, at the search bar, so the player
            column lines up with the thing that's producing the results -
            not with the upload/library section above it. Breakpoint is
            md: (768px) rather than lg: (1024px) so this actually kicks in
            on more real window sizes instead of silently staying stacked. */}
        <div className="mt-6 flex flex-col gap-6 md:flex-row md:items-start">
          <div className="flex min-w-0 flex-1 flex-col gap-4">
            <SearchBar onSearch={handleSearch} loading={loading} />

            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
            )}

            <ResultsList
              results={results}
              hasSearched={hasSearched}
              onSelect={handleSelectResult}
              getOpenColorIndex={getOpenColorIndex}
            />
          </div>

          {selections.length > 0 && (
            <div className="flex flex-col gap-4 md:sticky md:top-12 md:w-[360px] md:flex-shrink-0">
              {selections.map((s) => (
                <VideoPlayer
                  key={s.key}
                  videoTitle={s.videoTitle}
                  videoUrl={s.videoUrl}
                  seekTo={s.timestamp}
                  stopAt={s.stopAt}
                  trigger={s.trigger}
                  colorIndex={s.colorIndex}
                  onClose={() => handleClosePlayer(s.key)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default App
