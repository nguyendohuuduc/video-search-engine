// Shared palette pairing an open video player with the result card that
// opened it - same color on both ends makes the relationship obvious at a
// glance, no matter how far apart they've scrolled. Tailwind needs full,
// literal class strings (not string-interpolated ones) to pick them up, so
// this is an explicit array rather than a computed template.
export const PLAYER_COLORS = [
  { ring: "ring-blue-400", border: "border-l-blue-500", dot: "bg-blue-500" },
  { ring: "ring-purple-400", border: "border-l-purple-500", dot: "bg-purple-500" },
  { ring: "ring-pink-400", border: "border-l-pink-500", dot: "bg-pink-500" },
  { ring: "ring-amber-400", border: "border-l-amber-500", dot: "bg-amber-500" },
  { ring: "ring-teal-400", border: "border-l-teal-500", dot: "bg-teal-500" },
  { ring: "ring-red-400", border: "border-l-red-500", dot: "bg-red-500" },
] as const

export function playerColor(index: number) {
  return PLAYER_COLORS[index % PLAYER_COLORS.length]
}
