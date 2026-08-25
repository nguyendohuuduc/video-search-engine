import queue
import threading

from app.ingestion.pipeline import process_video

_queue: "queue.Queue[int]" = queue.Queue()
_worker_thread: threading.Thread | None = None


def _worker_loop() -> None:
    while True:
        video_id = _queue.get()
        try:
            process_video(video_id)
        except Exception as e:
            # process_video already records status='failed' on the video row;
            # this catch just keeps the worker thread alive for the next video.
            print(f"[worker] video {video_id} failed: {e}")
        finally:
            _queue.task_done()


def start_worker() -> None:
    global _worker_thread
    if _worker_thread is not None:
        return
    _worker_thread = threading.Thread(target=_worker_loop, daemon=True)
    _worker_thread.start()


def enqueue(video_id: int) -> None:
    _queue.put(video_id)
