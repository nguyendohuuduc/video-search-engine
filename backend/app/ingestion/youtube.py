import imageio_ffmpeg
import yt_dlp

from app.config import VIDEOS_DIR


def fetch_title(url: str) -> str:
    """Quick metadata-only lookup (no download) so the video row can show a
    real title immediately, before the slow download happens in the background.
    """
    ydl_opts = {"quiet": True, "skip_download": True, "noplaylist": True}
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=False)
    return info.get("title") or url


def download_video(video_id: int, url: str) -> str:
    """Downloads the video into VIDEOS_DIR and returns the filename written to
    disk. Prefers H.264 video (many players/browsers don't decode AV1, which
    is otherwise YouTube's common default for higher resolutions) and merges
    via the same bundled ffmpeg binary the rest of the pipeline already uses
    (imageio_ffmpeg) - no system ffmpeg dependency.
    """
    outtmpl = str(VIDEOS_DIR / f"{video_id}_%(title).100B.%(ext)s")
    ydl_opts = {
        "format": "bv*[vcodec^=avc1][height<=720]+ba/b[height<=720]/best[height<=720]",
        "merge_output_format": "mp4",
        "outtmpl": outtmpl,
        "ffmpeg_location": imageio_ffmpeg.get_ffmpeg_exe(),
        "restrictfilenames": True,
        "noplaylist": True,
        "quiet": True,
    }
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        ydl.download([url])

    matches = list(VIDEOS_DIR.glob(f"{video_id}_*"))
    if not matches:
        raise RuntimeError("Download completed but the output file was not found")
    return matches[0].name
