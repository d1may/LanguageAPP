import csv
import random

with open("germany_words.csv", encoding="utf-8") as f:
    words = list(csv.DictReader(f))

min_rank = 1
max_rank = len(words)

running = True

while running:
    # Берем случайное слово в ранговом диапазоне
    rank = random.randint(min_rank, max_rank)
    word = words[rank - 1]

    print(f"\nСлово: {word['word']} (rank {rank})")

    answer = input("easy / hard / q: ")

    if answer == "easy":
        # если легко → сложнее: берем более редкие слова
        min_rank = min(rank + 50, max_rank)
        max_rank += 50
        print(f">>> Увеличиваем сложность: min_rank = {min_rank}")

    elif answer == "hard":
        # если тяжело → проще: берем частотные слова
        max_rank = max(rank - 50, 1)
        min_rank -= 50
        print(f">>> Упрощаем: max_rank = {max_rank}")

    elif answer == "q":
        running = False
