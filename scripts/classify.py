"""
Offline essay-vs-recipe classifier for heritage_kitchen_recipes.json.

The Heritage Kitchen dataset mixes real recipes with encyclopedic essays and
how-to articles from the source books (e.g. "Coffee", "Baking of Bread",
"How to Make a Pie"). These don't belong in the recipe grid; the app
surfaces them as historical context linked from related recipes.

The TypeScript runtime classifier lives at `src/lib/classify.ts` and mirrors
this file. Use this script to inspect the classification against the full
dataset when tuning the heuristic:

    python3 scripts/classify.py            # summary + full essay list
    python3 scripts/classify.py --dump     # write essay ids to stdout

Run from the repo root.
"""
from __future__ import annotations

import json
import re
import sys
from collections import Counter

DATA_PATH = "public/heritage_kitchen_recipes.json"

ESSAY_TITLE_PREFIXES = (
    "care of ", "baking of ", "cooking of ", "how to ", "about ",
    "preparation of ", "selection of ", "time table", "general directions",
    "general rules", "choice of ", "composition of ", "classification of ",
    "notes on ", "methods of ", "kinds of ", "types of ", "remarks on ",
    "table service", "table setting", "weights and measures", "to measure",
    "to carve", "carving ", "the use of ", "ways of cooking", "ways to cook",
    "healing properties", "food values", "food value", "nutritive value",
    "to cut layer", "to test ",
)

ESSAY_TITLES_EXACT = {
    "coffee", "tea", "chocolate", "cocoa", "bread", "milk", "butter",
    "cheese", "eggs", "meat", "fish", "oysters", "vegetables", "fruit",
    "salads", "soups", "sauces", "cereals", "jellies", "fuel", "fires",
    "marketing", "measuring", "yeast", "flour", "sugar", "salt", "spices",
    "herbs", "vinegar", "baking powder", "gelatine", "gelatin", "nuts",
    "raisins", "currants", "dates", "figs", "lemons", "oranges", "apples",
    "pears", "peaches", "berries", "strawberries", "cherries", "grapes",
    "bananas", "pineapples", "tomatoes", "potatoes", "onions", "carrots",
    "beets", "celery", "cabbage", "peas", "beans", "rice", "macaroni",
    "mushrooms", "vanilla", "cinnamon", "nutmeg", "pepper", "mustard",
    "garnishing", "serving", "lettuce", "okra", "truffles", "bonbons",
    "candies", "tarts", "greens", "radishes", "buttermilk", "cream",
    "spinach", "asparagus", "cauliflower", "squash", "parsnips", "turnips",
}

VERB_STEMS = [
    "take", "put", "mix", "stir", "add", "beat", "pour", "bake", "boil",
    "simmer", "cut", "chop", "slic", "heat", "cook", "serv", "remov",
    "cover", "drain", "break", "cream", "fold", "roll", "knead", "sprinkl",
    "wash", "peel", "rub", "sift", "spread", "fill", "rins", "soak", "dust",
    "drop", "press", "steam", "fry", "brown", "dissolv", "scald", "melt",
    "blend", "combin", "shap", "prepar", "follow", "choos", "select", "lay",
    "plac", "tie", "par", "cor", "ston", "lin", "butter", "greas", "whisk",
    "whip", "stuff", "grill", "roast", "wip", "scrap", "pick", "gather",
    "set", "arrang", "turn", "skim", "season", "sweeten", "garnish", "us",
    "parboil", "stew", "broil", "grate", "minc", "pound", "mash", "strain",
    "dredg", "scor", "trim", "truss", "bon", "skin", "fillet", "clean",
    "form", "make", "proceed", "reduc", "poach", "brais", "sear", "glaz",
    "ic", "frost", "flavor", "tast", "measur", "weigh", "split",
]
VERB_RE = re.compile(
    r"\b(" + "|".join(VERB_STEMS) + r")(?:e|ed|es|ing|en|s)?\b", re.IGNORECASE
)
MEASUREMENT_RE = re.compile(
    r"\b(cups?|tablespoons?|teaspoons?|tsps?|tbsps?|pounds?|lbs?|ounces?|ozs?|"
    r"pints?|quarts?|gallons?|inches?|minutes?|hours?|tablespoonfuls?|teaspoonfuls?|"
    r"cupfuls?|pinches?|dashes?|handfuls?|bunches?|cloves?|pans?|bowls?|dishes?|pots?|"
    r"skillets?|saucepans?|kettles?|ovens?|stoves?|griddles?|molds?|gills?|drams?|"
    r"grams?|degrees?)\b|\d+°",
    re.IGNORECASE,
)
DESCRIPTIVE_PHRASES = (
    "is native to", "is a genus", "belongs to the genus", "belongs to the family",
    "is a name given to", "is the name given", "is an article of",
    "may be classified", "are classified", "is obtained from",
    "grows in tropical", "are of two", "are divided into", "are classed as",
    "nutritive value of", "food value of", "constitute the",
    "are valuable for", "rich in protein", "rich in fat", "are a source of",
    "are a rich source", "contains a large", "is a member of", "is cultivated",
    "historically", "medical properties", "healing properties", "are mollusks",
    "are invertebrates", "has latterly", "so generally regarded",
)


def strip_heading(original: str) -> str:
    lines = original.split("\n", 1)
    if not lines:
        return original
    first = lines[0].strip()
    alpha = [c for c in first if c.isalpha()]
    if not alpha:
        return original
    upper = sum(1 for c in alpha if c.isupper())
    is_heading = upper >= 0.8 * len(alpha) and len(first) < 60
    return lines[1].lstrip() if is_heading and len(lines) > 1 else original


def classify(entry: dict) -> str:
    title = entry["title"].strip().lower()
    original = entry["original_recipe"]

    for p in ESSAY_TITLE_PREFIXES:
        if title.startswith(p):
            return "essay"
    if title in ESSAY_TITLES_EXACT:
        return "essay"

    body = strip_heading(original)
    head_lower = body[:500].lower()
    for ph in DESCRIPTIVE_PHRASES:
        if ph in head_lower:
            return "essay"

    chunk = body[:400]
    if len(chunk) > 100 and not VERB_RE.search(chunk) and not MEASUREMENT_RE.search(chunk):
        return "essay"

    return "recipe"


def main() -> None:
    with open(DATA_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    types = Counter(classify(r) for r in data)
    essays = sorted(
        (r for r in data if classify(r) == "essay"),
        key=lambda r: (r["category"], r["title"]),
    )

    if "--dump" in sys.argv:
        for r in essays:
            print(r["id"])
        return

    print(f"Total entries: {len(data)}")
    print(f"  recipes: {types['recipe']}")
    print(f"  essays:  {types['essay']}")
    print("\n=== Essays ===")
    for r in essays:
        print(f"  [{r['category']:25}] {r['title']}")


if __name__ == "__main__":
    main()
