import httpx
from fastapi import APIRouter, HTTPException, status

from core.config import settings

router = APIRouter()

@router.post("/translate")
async def translate(payload: dict):
    deepl_key = settings.DEEPL_KEY
    if not deepl_key:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="DeepL key not configured")
    async with httpx.AsyncClient() as client:
        try:
            r = await client.post(
                "https://api-free.deepl.com/v2/translate",
                headers={
                    "Authorization": f"DeepL-Auth-Key {deepl_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "text": [payload["q"]],
                    "source_lang": payload["source"].upper(),
                    "target_lang": payload["target"].upper(),
                }
            )
            r.raise_for_status()
        except httpx.HTTPError as exc:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="DeepL request failed") from exc

        data = r.json()
        translations = data.get("translations") or []
        if not translations:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Unexpected DeepL response")
        return {"translatedText": translations[0]["text"]}
