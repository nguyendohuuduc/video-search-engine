from fastapi import APIRouter
from pydantic import BaseModel

from app.search.retrieval import search as run_search

router = APIRouter(prefix="/search", tags=["search"])


class SearchRequest(BaseModel):
    query: str
    top_k: int = 20


@router.post("")
def search(req: SearchRequest):
    return run_search(req.query, req.top_k)
