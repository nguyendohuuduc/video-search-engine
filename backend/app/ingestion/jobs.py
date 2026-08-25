import queue
import threading
from dataclasses import dataclass

from app.ingestion.pipeline import process_video, process_youtube_video


@dataclass
class UploadJob:
    video_id: int


@dataclass
class YoutubeJob:
    video_id: int
    url: str


_queue: "queue.Queue[UploadJob | YoutubeJob]" = queue.Queue()
_worker_thread: threading.Thread | None = None


def _worker_loop() -> None:
    while True:
        job = _queue.get()
        try:
            if isinstance(job, YoutubeJob):
                process_youtube_video(job.video_id, job.url)
            else:
                process_video(job.video_id)
        except Exception as e:
            # process_video/process_youtube_video already record status='failed'
            # on the video row; this catch just keeps the worker thread alive.
            print(f"[worker] video {job.video_id} failed: {e}")
        finally:
            _queue.task_done()


def start_worker() -> None:
    global _worker_thread
    if _worker_thread is not None:
        return
    _worker_thread = threading.Thread(target=_worker_loop, daemon=True)
    _worker_thread.start()


def enqueue(video_id: int) -> None:
    _queue.put(UploadJob(video_id))


def enqueue_youtube(video_id: int, url: str) -> None:
    _queue.put(YoutubeJob(video_id, url))
