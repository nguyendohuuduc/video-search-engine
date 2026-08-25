export type MatchType = "frame" | "transcript"

export interface SearchResult {
  video_id: number
  video_title: string
  video_url: string
  timestamp: number
  match_type: MatchType
  score: number
  snippet: string | null
  thumbnail_url: string | null
}

export type VideoStatus = "pending" | "processing" | "ready" | "failed"

export interface Video {
  video_id: number
  original_name: string
  video_url: string
  duration_sec: number | null
  status: VideoStatus
  error: string | null
  created_at: string
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init)
  if (!res.ok) {
    throw new Error(`${init?.method ?? "GET"} ${path} failed: ${res.status} ${res.statusText}`)
  }
  return res.json() as Promise<T>
}

export function searchVideos(query: string, topK = 20): Promise<SearchResult[]> {
  return request<SearchResult[]>("/api/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, top_k: topK }),
  })
}

export function listVideos(): Promise<Video[]> {
  return request<Video[]>("/api/videos")
}

export function getVideo(videoId: number): Promise<Video> {
  return request<Video>(`/api/videos/${videoId}`)
}

export async function uploadVideo(file: File): Promise<{ video_id: number; status: VideoStatus }> {
  const formData = new FormData()
  formData.append("file", file)
  return request("/api/videos", { method: "POST", body: formData })
}
