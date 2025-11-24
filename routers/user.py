from fastapi import APIRouter
router = APIRouter(prefix="/user", tags=["users"])

@router.get("/")
async def get_users():
    return {"status" : "ok"}

