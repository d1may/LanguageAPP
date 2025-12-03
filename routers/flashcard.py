from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from authx import TokenPayload

from core.database import get_db
from schemas.flashcard import (
    DeckCreateIn,
    DeckOut,
    DeckUpdateIn,
    FlashcardWordCreateIn,
    FlashcardWordOut,
    FlashcardWordUpdateIn,
)
from services.flashcard_service import FlashcardService
from .auth import security

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
