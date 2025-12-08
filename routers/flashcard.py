import csv
import io
import re

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Response, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from authx import TokenPayload

from core.database import get_db
from schemas.flashcard import (
    DeckCreateIn,
    DeckOut,
    DeckUpdateIn,
    FlashcardSessionOut,
    FlashcardWordCreateIn,
    FlashcardWordDifficultyIn,
    FlashcardWordOut,
    FlashcardWordUpdateIn,
)
from models.user import User
from services.flashcard_service import FlashcardService
from .auth import security
from pydantic import ValidationError

router = APIRouter(prefix="/flashcard", tags=["Flashcard"])


@router.post(
    "/decks",
    response_model=DeckOut,
    status_code=201,
)
async def create_deck(
    data: DeckCreateIn,
    payload: TokenPayload = Depends(security.access_token_required),
    db: Session = Depends(get_db),
):
    user_id = int(payload.sub)
    svc = FlashcardService(db)
    deck = svc.save_deck(
        user_id=user_id,
        title=data.title,
        description=data.description,
        category=data.category,
        lang=data.lang,
    )
    return DeckOut.model_validate(deck, from_attributes=True)


@router.get(
    "/decks",
    response_model=list[DeckOut],
)
async def list_decks(
    payload: TokenPayload = Depends(security.access_token_required),
    db: Session = Depends(get_db),
):
    user_id = int(payload.sub)
    svc = FlashcardService(db)
    decks = svc.list_decks(user_id)
    return [DeckOut.model_validate(deck, from_attributes=True) for deck in decks]


@router.delete(
    "/decks/{deck_id}",
    status_code=204,
)
async def delete_deck(
    deck_id: int,
    payload: TokenPayload = Depends(security.access_token_required),
    db: Session = Depends(get_db),
):
    user_id = int(payload.sub)
    svc = FlashcardService(db)
    deleted = svc.delete_deck(user_id=user_id, deck_id=deck_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Deck not found")
    return Response(status_code=204)


@router.put(
    "/decks/{deck_id}",
    response_model=DeckOut,
)
async def update_deck(
    deck_id: int,
    data: DeckUpdateIn,
    payload: TokenPayload = Depends(security.access_token_required),
    db: Session = Depends(get_db),
):
    user_id = int(payload.sub)
    svc = FlashcardService(db)
    try:
        deck = svc.update_deck(
            user_id=user_id,
            deck_id=deck_id,
            title=data.title,
            description=data.description,
            category=data.category,
            lang=data.lang,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if deck is None:
        raise HTTPException(status_code=404, detail="Deck not found")
    return DeckOut.model_validate(deck, from_attributes=True)


@router.post(
    "/decks/{deck_id}/words",
    response_model=FlashcardWordOut,
    status_code=201,
)
async def add_word_to_deck(
    deck_id: int,
    data: FlashcardWordCreateIn,
    payload: TokenPayload = Depends(security.access_token_required),
    db: Session = Depends(get_db),
):
    user_id = int(payload.sub)
    svc = FlashcardService(db)
    deck = svc.get_deck(user_id=user_id, deck_id=deck_id)
    if deck is None:
        raise HTTPException(status_code=404, detail="Deck not found")
    word = svc.save_word(
        deck_id=deck_id,
        word=data.word,
        definition=data.definition,
        example=data.example,
    )
    return FlashcardWordOut.model_validate(word, from_attributes=True)


@router.get(
    "/decks/{deck_id}/words",
    response_model=list[FlashcardWordOut],
)
async def list_words_for_deck(
    deck_id: int,
    payload: TokenPayload = Depends(security.access_token_required),
    db: Session = Depends(get_db),
):
    user_id = int(payload.sub)
    svc = FlashcardService(db)
    deck = svc.get_deck(user_id=user_id, deck_id=deck_id)
    if deck is None:
        raise HTTPException(status_code=404, detail="Deck not found")
    words = svc.list_words(deck_id=deck_id)
    print([FlashcardWordOut.model_validate(word, from_attributes=True) for word in words])
    return [FlashcardWordOut.model_validate(word, from_attributes=True) for word in words]


@router.put(
    "/decks/{deck_id}/words/{word_id}",
    response_model=FlashcardWordOut,
)
async def update_word_in_deck(
    deck_id: int,
    word_id: int,
    data: FlashcardWordUpdateIn,
    payload: TokenPayload = Depends(security.access_token_required),
    db: Session = Depends(get_db),
):
    user_id = int(payload.sub)
    svc = FlashcardService(db)
    deck = svc.get_deck(user_id=user_id, deck_id=deck_id)
    if deck is None:
        raise HTTPException(status_code=404, detail="Deck not found")
    try:
        word = svc.update_word(
            deck_id=deck_id,
            word_id=word_id,
            word=data.word,
            definition=data.definition,
            example=data.example,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if word is None:
        raise HTTPException(status_code=404, detail="Card not found")
    return FlashcardWordOut.model_validate(word, from_attributes=True)


@router.patch(
    "/decks/{deck_id}/words/{word_id}/difficulty",
    response_model=FlashcardWordOut,
)
async def update_word_difficulty(
    deck_id: int,
    word_id: int,
    data: FlashcardWordDifficultyIn,
    payload: TokenPayload = Depends(security.access_token_required),
    db: Session = Depends(get_db),
):
    user_id = int(payload.sub)
    svc = FlashcardService(db)
    deck = svc.get_deck(user_id=user_id, deck_id=deck_id)
    if deck is None:
        raise HTTPException(status_code=404, detail="Deck not found")

    word = svc.update_word_difficulty(deck_id=deck_id, word_id=word_id, difficulty=data.difficulty)
    if word is None:
        raise HTTPException(status_code=404, detail="Card not found")
    return FlashcardWordOut.model_validate(word, from_attributes=True)


@router.delete(
    "/decks/{deck_id}/words/{word_id}",
    status_code=204,
)
async def delete_word_from_deck(
    deck_id: int,
    word_id: int,
    payload: TokenPayload = Depends(security.access_token_required),
    db: Session = Depends(get_db),
):
    user_id = int(payload.sub)
    svc = FlashcardService(db)
    deck = svc.get_deck(user_id=user_id, deck_id=deck_id)
    if deck is None:
        raise HTTPException(status_code=404, detail="Deck not found")
    deleted = svc.delete_word(deck_id=deck_id, word_id=word_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Card not found")
    return Response(status_code=204)


@router.get(
    "/session",
    response_model=FlashcardSessionOut,
)
async def get_global_session_cards(
    payload: TokenPayload = Depends(security.access_token_required),
    db: Session = Depends(get_db),
):
    user_id = int(payload.sub)
    user = db.get(User, user_id)
    lang = (user.random_word_lang if user else None) or "en"
    lang = "de" if lang.lower() == "de" else "en"

    svc = FlashcardService(db)
    cards = svc.get_session_cards_for_lang(user_id=user_id, lang=lang, limit=10)
    return {
        "lang": lang,
        "cards": [FlashcardWordOut.model_validate(card, from_attributes=True) for card in cards],
    }


def _normalize_filename(title: str | None, deck_id: int) -> str:
    """Create a filesystem-friendly filename for deck exports."""
    if title:
        slug = re.sub(r"[^A-Za-z0-9]+", "-", title.lower()).strip("-")
    else:
        slug = ""
    if not slug:
        slug = f"deck-{deck_id}"
    return f"{slug}.csv"


@router.get("/export/flashcard_csv", response_class=StreamingResponse)
async def export_flashcards_to_csv(
    deck_id: int = Query(..., gt=0, description="Deck ID to export"),
    payload: TokenPayload = Depends(security.access_token_required),
    db: Session = Depends(get_db),
):
    user_id = int(payload.sub)
    svc = FlashcardService(db)
    deck = svc.get_deck(user_id=user_id, deck_id=deck_id)
    if deck is None:
        raise HTTPException(status_code=404, detail="Deck not found")

    words = svc.list_words(deck_id=deck_id)

    buffer = io.StringIO()
    fieldnames = ["word", "definition", "example", "difficulty"]
    writer = csv.DictWriter(buffer, fieldnames=fieldnames)
    writer.writeheader()
    for word in words:
        writer.writerow(
            {
                "word": word.word or "",
                "definition": word.definition or "",
                "example": word.example or "",
                "difficulty": word.difficulty or "",
            }
        )

    csv_data = buffer.getvalue().encode("utf-8")
    filename = _normalize_filename(deck.title, deck.id)
    response = StreamingResponse(iter([csv_data]), media_type="text/csv; charset=utf-8")
    response.headers["Content-Disposition"] = f'attachment; filename="{filename}"'
    return response


def _parse_import_csv(content: str) -> list[dict[str, str | None]]:
    stream = io.StringIO(content)
    reader = csv.DictReader(stream)
    if reader.fieldnames is None:
        raise HTTPException(status_code=400, detail="CSV file must include a header row.")

    normalized_headers = []
    for header in reader.fieldnames:
        normalized_headers.append((header or "").strip().lower())
    reader.fieldnames = normalized_headers

    required_columns = {"word", "definition"}
    missing = [col for col in required_columns if col not in reader.fieldnames]
    if missing:
        fallback_order = ["word", "definition", "example", "difficulty"]
        if len(reader.fieldnames) <= len(fallback_order):
            remapped = []
            for idx, _ in enumerate(reader.fieldnames):
                remapped.append(fallback_order[idx])
            reader.fieldnames = remapped
            missing = [col for col in required_columns if col not in reader.fieldnames]

    missing = [col for col in required_columns if col not in reader.fieldnames]
    if missing:
        raise HTTPException(status_code=400, detail="CSV must include Word and Definition columns.")

    entries: list[dict[str, str | None]] = []
    for row_number, row in enumerate(reader, start=2):
        word = (row.get("word") or "").strip()
        definition = (row.get("definition") or "").strip()
        example = (row.get("example") or "").strip()
        difficulty_raw = (row.get("difficulty") or "").strip().lower()

        if not any([word, definition, example, difficulty_raw]):
            continue

        if not word or not definition:
            raise HTTPException(status_code=400, detail=f"Row {row_number}: word and definition are required.")

        try:
            validated = FlashcardWordCreateIn(word=word, definition=definition, example=example or None)
        except ValidationError as exc:
            messages = "; ".join(err.get("msg", "Invalid data") for err in exc.errors())
            raise HTTPException(status_code=400, detail=f"Row {row_number}: {messages}") from exc

        normalized_difficulty = None
        if difficulty_raw:
            try:
                normalized_difficulty = FlashcardWordDifficultyIn(difficulty=difficulty_raw).difficulty
            except ValidationError as exc:
                raise HTTPException(status_code=400, detail=f"Row {row_number}: difficulty must be easy, medium, or hard") from exc

        entries.append(
            {
                "word": validated.word,
                "definition": validated.definition,
                "example": validated.example,
                "difficulty": normalized_difficulty,
            }
        )

    if not entries:
        raise HTTPException(status_code=400, detail="CSV must contain at least one valid row.")

    return entries


@router.post("/import", response_model=DeckOut, status_code=201)
async def import_flashcard_deck(
    title: str = Form(...),
    description: str = Form(...),
    category: str | None = Form(None),
    lang: str = Form("en"),
    file: UploadFile = File(...),
    payload: TokenPayload = Depends(security.access_token_required),
    db: Session = Depends(get_db),
):
    try:
        deck_data = DeckCreateIn(title=title, description=description, category=category, lang=lang)
    except ValidationError as exc:
        raise HTTPException(status_code=400, detail=exc.errors()) from exc

    filename = (file.filename or "").lower()
    if not filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files can be imported.")

    raw_bytes = await file.read()
    if not raw_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    try:
        text = raw_bytes.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise HTTPException(status_code=400, detail="CSV must be UTF-8 encoded.") from exc

    words = _parse_import_csv(text)

    user_id = int(payload.sub)
    svc = FlashcardService(db)
    deck = svc.save_deck(
        user_id=user_id,
        title=deck_data.title,
        description=deck_data.description,
        category=deck_data.category,
        lang=deck_data.lang,
    )

    for word in words:
        svc.save_word(
            deck_id=deck.id,
            word=word["word"],
            definition=word["definition"],
            example=word["example"],
            difficulty=word["difficulty"],
        )

    return DeckOut.model_validate(deck, from_attributes=True)


@router.get("/stats")
async def get_flashcard_stats(
    payload: TokenPayload = Depends(security.access_token_required),
    db: Session = Depends(get_db),
):
    user_id = int(payload.sub)
    svc = FlashcardService(db)
    due_cards = svc.count_due_cards(user_id)
    total_cards = svc.count_user_cards(user_id)
    return {"due_cards": due_cards, "total_cards": total_cards}
