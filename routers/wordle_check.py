from collections import Counter
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

router = APIRouter(prefix="/wordle", tags=["Wordle"])


class WordleGuess(BaseModel):
  guess: str = Field(..., min_length=1)
  target: str = Field(..., min_length=1)


def evaluate_guess(guess: str, target: str):
  normalized_guess = guess.strip().lower()
  normalized_target = target.strip().lower()

  if not normalized_guess.isalpha() or not normalized_target.isalpha():
    raise HTTPException(status_code=400, detail="Only letters are allowed.")

  tiles = [{"letter": letter.upper(), "status": "miss"} for letter in normalized_guess]
  unmatched_target_letters = Counter()

  for index, (g_letter, t_letter) in enumerate(zip(normalized_guess, normalized_target)):
    if g_letter == t_letter:
      tiles[index]["status"] = "correct"
    else:
      unmatched_target_letters[t_letter] += 1

  for index, (g_letter, _) in enumerate(zip(normalized_guess, normalized_target)):
    if tiles[index]["status"] == "correct":
      continue
    if unmatched_target_letters[g_letter] > 0:
      tiles[index]["status"] = "present"
      unmatched_target_letters[g_letter] -= 1

  return {
    "is_complete": normalized_guess == normalized_target,
    "tiles": tiles,
  }


@router.post("/check")
async def check_wordle_guess(payload: WordleGuess):
  result = evaluate_guess(payload.guess, payload.target)
  message = "You guessed the word!" if result["is_complete"] else "Keep trying."
  print("good")
  return {"status": "ok", "message": message, **result}
