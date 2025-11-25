from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

router = APIRouter(prefix="/flashcard", tags=["Flashcard"])

@router.get("/")
async def flashcard_get():
    return {"status" : "ok"}