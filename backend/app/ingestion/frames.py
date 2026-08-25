import subprocess
from dataclasses import dataclass
from pathlib import Path

import imageio_ffmpeg

from app.config import FRAME_SAMPLE_INTERVAL_SEC


@dataclass
class ExtractedFrame:
    path: Path
    timestamp: float


def extract_frames(video_path: Path, out_dir: Path, interval_sec: float = FRAME_SAMPLE_INTERVAL_SEC) -> list[ExtractedFrame]:
    out_dir.mkdir(parents=True, exist_ok=True)
    ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()

    pattern = out_dir / "frame_%06d.jpg"
    cmd = [
        ffmpeg_exe,
        "-y",
        "-i", str(video_path),
        "-vf", f"fps=1/{interval_sec}",
        "-q:v", "3",
        str(pattern),
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"ffmpeg frame extraction failed: {result.stderr[-2000:]}")

    frames = []
    for i, frame_path in enumerate(sorted(out_dir.glob("frame_*.jpg"))):
        frames.append(ExtractedFrame(path=frame_path, timestamp=i * interval_sec))
    return frames


def get_video_duration(video_path: Path) -> float:
    ffprobe_exe = imageio_ffmpeg.get_ffmpeg_exe()
    cmd = [
        ffprobe_exe,
        "-i", str(video_path),
        "-hide_banner",
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    for line in result.stderr.splitlines():
        line = line.strip()
        if line.startswith("Duration:"):
            duration_str = line.split(",")[0].replace("Duration:", "").strip()
            h, m, s = duration_str.split(":")
            return int(h) * 3600 + int(m) * 60 + float(s)
    raise RuntimeError(f"Could not determine video duration from ffmpeg output: {result.stderr[-500:]}")
