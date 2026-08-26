import { useEffect, useRef, useState } from "react"
import { playerColor } from "../playerColors"

interface VideoPlayerProps {
  videoTitle: string
  videoUrl: string
  seekTo: number
  stopAt: number
  trigger: number // bumped on every open/re-open, even for the same seekTo/stopAt, to force a re-seek
  colorIndex: number // ties this player visually to the result card that opened it
  onClose: () => void
}

export function VideoPlayer({ videoTitle, videoUrl, seekTo, stopAt, trigger, colorIndex, onClose }: VideoPlayerProps) {
  const color = playerColor(colorIndex)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [ready, setReady] = useState(false)

  // Seeks once metadata has loaded (readyState is high enough for
  // currentTime to actually stick) and whenever a new chunk is requested.
  useEffect(() => {
    const video = videoRef.current
    if (video && ready) {
      video.currentTime = seekTo
      video.play().catch(() => {
        // Autoplay can be blocked by the browser; that's fine, the video
        // is still seeked to the right spot for the user to press play.
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seekTo, stopAt, trigger, ready])

  // Pauses once playback reaches the end of the matched chunk, instead of
  // continuing to play through the rest of the video - a search result
  // should show just the moment that matched, not force a full rewatch.
  function handleTimeUpdate() {
    const video = videoRef.current
    if (video && video.currentTime >= stopAt) {
      video.pause()
    }
  }

  return (
    <div className={`rounded-xl border-l-4 bg-white p-3 shadow-sm ring-1 ring-gray-100 ${color.border}`}>
      <div className="mb-2 flex items-center justify-between gap-2 px-0.5">
        <p className="flex min-w-0 items-center gap-2 truncate text-sm font-medium text-gray-900">
          <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${color.dot}`} />
          <span className="truncate">{videoTitle}</span>
        </p>
        <button
          type="button"
          onClick={onClose}
          title="Close"
          className="flex-shrink-0 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
        >
          <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
            <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <video
        ref={videoRef}
        src={videoUrl}
        controls
        onLoadedMetadata={() => setReady(true)}
        onTimeUpdate={handleTimeUpdate}
        className="w-full rounded-lg bg-black"
      />
    </div>
  )
}
