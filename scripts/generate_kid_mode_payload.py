#!/usr/bin/env python3
"""
Generate a Perplexity re-processing payload for Kid Mode augmentation.

Walks the recipe and lesson libraries and emits structured inputs for
the ~300 kid-friendly recipes and ~60 fun_for_kids lessons. Perplexity
is expected to return, for each recipe:

  kid_jobs:          [str]   — what the kid can do alone
  grownup_jobs:      [str]   — what the grown-up must do
  together_jobs:     [str]   — shared tasks
  teaching_moments:  [str]   — "why does this happen?" explainers
                               appropriate to a child's reading level
  prep_ahead:        [str]   — parent pre-flight checklist, ordered

And for each lesson:

  kid_explainer:     str     — "what's happening in the pot" written
                               at roughly a 3rd-grade reading level

Output files:
  scripts/kid_mode_recipes_input.json — the payload to hand to Perplexity
  scripts/kid_mode_lessons_input.json
  scripts/kid_mode_summary.md          — human-readable scope + counts

After Perplexity returns the augmented JSON, drop it at:
  public/heritage_kitchen_kid_mode.json

Then the render step (commit 7) can overlay it on top of the
heuristic splitter.
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).parent.parent
RECIPES = ROOT / 'public' / 'heritage_kitchen_recipes.json'
LESSONS = ROOT / 'public' / 'heritage_kitchen_lessons.json'
OUT_RECIPES = ROOT / 'scripts' / 'kid_mode_recipes_input.json'
OUT_LESSONS = ROOT / 'scripts' / 'kid_mode_lessons_input.json'
OUT_SUMMARY = ROOT / 'scripts' / 'kid_mode_summary.md'

# Prompt shown to the model for each recipe. Kept in the payload so
# the re-processor has it inline for every entry.
RECIPE_PROMPT = (
    "You are helping a parent cook with a young child (ages 5-10). "
    "Read this historical American recipe and its modern adaptation, "
    "then split its instructions into three categories:\n"
    "\n"
    "  - kid_jobs: things a child this age can do safely by themselves "
    "(washing, stirring, pouring, measuring dry ingredients, pressing "
    "dough, shaping cookies, cracking eggs, buttering a pan).\n"
    "  - grownup_jobs: things that require adult hands (hot stove, "
    "sharp knives, raw meat, oven in/out, boiling liquids, broiling, "
    "frying in hot fat, reducing sauces).\n"
    "  - together_jobs: things where parent and kid work side by side "
    "(kneading dough, rolling out pastry, decorating cookies, "
    "assembling a pie, filling muffin tins).\n"
    "\n"
    "Also generate:\n"
    "  - teaching_moments: 2-4 short 'why does this happen?' "
    "explainers written for a 3rd-grade reader (e.g. 'Yeast is a "
    "tiny living thing that eats sugar and burps gas — the gas gets "
    "trapped in the dough and that's what makes bread rise').\n"
    "  - prep_ahead: a checklist of things the grown-up should do "
    "BEFORE calling the kid into the kitchen — preheating, "
    "pre-measuring, setting out the stepstool, doing any knife work "
    "alone.\n"
    "\n"
    "Keep the kid's voice: second person, warm, short sentences. "
    "Never condescend. Return strict JSON with exactly those five "
    "keys, no prose outside the JSON."
)

LESSON_PROMPT = (
    "You are helping a parent teach a young child (ages 5-10) why "
    "cooking works. Read this historical cooking lesson and rewrite "
    "its core idea as a kid_explainer: 80-200 words, 3rd-grade "
    "reading level, warm and curious, no condescension, anchored in "
    "one concrete sense the kid can check (what it looks like, "
    "smells like, feels like, sounds like). Return strict JSON with "
    "a single key kid_explainer."
)


def is_kid_friendly_recipe(r) -> bool:
    tags = [t.lower() for t in (r.get('tags') or [])]
    if 'kid-friendly' in tags or 'kids' in tags:
        return True
    if r.get('category') == 'kids-in-the-kitchen':
        return True
    # Also include the easy breakfast-and-bakes / dessert / bread
    # recipes where a child can participate meaningfully.
    if r.get('difficulty') == 'easy' and r.get('category') in (
        'breakfast-and-bakes',
        'desserts',
        'breads',
        'candy-and-confections',
    ):
        # Limit the "easy" sweep so we don't blow out the token budget
        # on 800 recipes. Caller can expand later.
        return False
    return False


def main():
    recipes = json.loads(RECIPES.read_text())
    if isinstance(recipes, dict):
        recipes = recipes.get('recipes', [])

    kid_recipes = [r for r in recipes if r.get('content_type') != 'essay' and is_kid_friendly_recipe(r)]

    recipe_payload = []
    for r in kid_recipes:
        recipe_payload.append({
            'id': r.get('id'),
            'title': r.get('title'),
            'source_book': r.get('source_book'),
            'source_year': r.get('source_year'),
            'category': r.get('category'),
            'difficulty': r.get('difficulty'),
            'tags': r.get('tags') or [],
            'original_recipe': r.get('original_recipe'),
            'modern_ingredients': (r.get('modern_recipe') or {}).get('ingredients'),
            'modern_instructions': (r.get('modern_recipe') or {}).get('instructions'),
            'prompt': RECIPE_PROMPT,
        })

    OUT_RECIPES.write_text(json.dumps(recipe_payload, indent=2, ensure_ascii=False))

    # Lessons ---------------------------------------------------------
    if LESSONS.exists():
        lessons = json.loads(LESSONS.read_text())
        if isinstance(lessons, dict):
            lessons = lessons.get('lessons', [])
    else:
        lessons = []

    kid_lessons = [l for l in lessons if l.get('fun_for_kids')]

    lesson_payload = []
    for l in kid_lessons:
        lesson_payload.append({
            'id': l.get('id'),
            'title': l.get('title'),
            'topic': l.get('topic'),
            'source_book': l.get('source_book'),
            'source_year': l.get('source_year'),
            'original_text': l.get('original_text'),
            'modern_explanation': l.get('modern_explanation'),
            'key_takeaways': l.get('key_takeaways'),
            'prompt': LESSON_PROMPT,
        })

    OUT_LESSONS.write_text(json.dumps(lesson_payload, indent=2, ensure_ascii=False))

    # Summary ---------------------------------------------------------
    lines = [
        '# Kid Mode payload summary',
        '',
        f'Recipes to process: **{len(kid_recipes)}**',
        f'Lessons to process: **{len(kid_lessons)}**',
        '',
        '## Recipe selection criteria',
        '',
        '- Any recipe tagged `kid-friendly` or `kids`',
        '- Any recipe in the `kids-in-the-kitchen` category',
        '',
        '## Expected Perplexity response shape',
        '',
        '### Per recipe',
        '',
        '```json',
        '{',
        '  "id": "bcs-apple-pie",',
        '  "kid_jobs": ["Wash the apples.", "Press the pie crust into the pan."],',
        '  "grownup_jobs": ["Slice the apples thin with a sharp knife.", "Put the pie in the oven."],',
        '  "together_jobs": ["Arrange the apple slices in the crust."],',
        '  "teaching_moments": [',
        '    "Apples brown when you cut them because oxygen in the air reacts with the juice. A splash of lemon stops it.",',
        '    "Butter makes the crust flaky because the little chunks melt in the oven and leave layers of air."',
        '  ],',
        '  "prep_ahead": ["Preheat the oven to 425°F.", "Do all the knife work.", "Put out the stepstool."]',
        '}',
        '```',
        '',
        '### Per lesson',
        '',
        '```json',
        '{',
        '  "id": "shc-yeast-bread",',
        '  "kid_explainer": "Yeast is a tiny living thing. It\'s smaller than you can see, but you can put it in warm water with a spoonful of sugar and watch it wake up..."',
        '}',
        '```',
        '',
        '## Drop the result at',
        '',
        '`public/heritage_kitchen_kid_mode.json` — the render step in',
        'commit 7 will pick it up automatically.',
    ]
    OUT_SUMMARY.write_text('\n'.join(lines))

    print(f'Wrote:')
    print(f'  {OUT_RECIPES}   ({OUT_RECIPES.stat().st_size // 1024} KB, {len(recipe_payload)} recipes)')
    print(f'  {OUT_LESSONS}   ({OUT_LESSONS.stat().st_size // 1024} KB, {len(lesson_payload)} lessons)')
    print(f'  {OUT_SUMMARY}')
    return 0

if __name__ == '__main__':
    sys.exit(main())
