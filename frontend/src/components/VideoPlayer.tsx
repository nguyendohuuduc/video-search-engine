import { useEffect, useRef, useState } from "react"

interface Marker {
  timestamp: number
  matchType: "frame" | "transcript"
}

interface VideoPlayerProps {
  videoId: number
  videoTitle: string
  videoUrl: string
  seekTo: number
  markers: Marker[]
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, "0")}`
}

export function VideoPlayer({ videoId, videoTitle, videoUrl, seekTo, markers }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [duration, setDuration] = useState(0)

  // Seek whenever the caller asks for a new timestamp (e.g. a different
  // result was clicked), but only once metadata has loaded so `duration`
  // (used for marker positioning) and seeking are both ready together.
  useEffect(() => {
    const video = videoRef.current
    if (video && duration > 0) {
      video.currentTime = seekTo
      video.play().catch(() => {
        // Autoplay can be blocked by the browser; that's fine, the video
        // is still seeked to the right spot for the user to press play.
      })
    }
  }, [seekTo, duration, videoId])

  function handleLoadedMetadata() {
    setDuration(videoRef.current?.duration ?? 0)
  }

  function handleMarkerClick(timestamp: number) {
    const video = videoRef.current
    if (video) {
      video.currentTime = timestamp
      video.play().catch(() => {})
    }
  }

  return (
    <div className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-gray-100">
      <p className="mb-2 truncate px-0.5 text-sm font-medium text-gray-900">{videoTitle}</p>

      <video
        ref={videoRef}
        src={videoUrl}
        controls
        onLoadedMetadata={handleLoadedMetadata}
        className="w-full rounded-lg bg-black"
      />

      {duration > 0 && (
        <div className="relative mt-3 h-4">
          <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-gray-100" />
          {markers.map((marker, i) => (
            <button
              key={i}
              type="button"
              title={`${formatTime(marker.timestamp)} · ${marker.matchType === "frame" ? "seen" : "said"}`}
              onClick={() => handleMarkerClick(marker.timestamp)}
              style={{ left: `${(marker.timestamp / duration) * 100}%` }}
              className={
                "absolute top-1/2 h-3 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white hover:scale-125 " +
                (marker.matchType === "frame" ? "bg-blue-500" : "bg-green-500")
              }
            />
          ))}
        </div>
      )}
    </div>
  )
}
