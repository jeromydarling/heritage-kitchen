#!/usr/bin/env python3
"""
One-time patch for the three HARD/SOFT hits from the problematic
titles audit. Deterministic, idempotent, and verifiable — after
running, re-run audit_problematic_titles.py and the HARD/SOFT
counts should drop to zero.

Patches applied:

  1. mf-pickaninny-fudge  →  mf-chocolate-fudge
     - id and slug updated
     - title changed to "Chocolate Fudge"
     - slur stripped from original_recipe
     - history_note gains an editorial line explaining the rename

  2. wh-rye-and-corn-bread
     - "Rye and Injun" replaced with "Rye and Indian meal" in the
       original_recipe and modern_recipe.instructions
     - title and id unchanged (they were always fine)

  3. bcs-hindoo-salad  →  bcs-curried-tomato-salad
     - id and slug updated
     - title changed to "Curried Tomato Salad"
     - "Hindoo" and "hindoo" replaced with "curried tomato" in
       the body text and modern description

Also emits scripts/recipe_redirects.json — a small map of old-id →
new-id that the RecipePage loads so bookmarked URLs still work.
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).parent.parent
DATASET = ROOT / 'public' / 'heritage_kitchen_recipes.json'
REDIRECTS = ROOT / 'public' / 'recipe_redirects.json'


def patch_pickaninny_fudge(r):
    """mf-pickaninny-fudge → mf-chocolate-fudge."""
    new_id = 'mf-chocolate-fudge'
    r['id'] = new_id
    r['title'] = 'Chocolate Fudge'

    # Strip the slur from the original text, preserving the recipe body.
    original = r.get('original_recipe', '') or ''
    # Replace the header line variants
    original = re.sub(
        r'NO\.\s*29\.?-+\s*PICKANINNY\s+FUDGE\.?',
        'NO. 29.--CHOCOLATE FUDGE.',
        original,
        flags=re.IGNORECASE,
    )
    original = re.sub(r'Pickaninny\s+Fudge', 'Chocolate Fudge', original, flags=re.IGNORECASE)
    original = re.sub(r'\bpickaninny\b', 'chocolate', original, flags=re.IGNORECASE)
    r['original_recipe'] = original

    # Scrub the modern_recipe text too, in case the slur leaked through
    # during the adaptation.
    mr = r.get('modern_recipe') or {}
    for key in ('description', 'tips'):
        v = mr.get(key)
        if isinstance(v, str):
            mr[key] = re.sub(r'\bpickaninny\b', 'chocolate', v, flags=re.IGNORECASE)
    for key in ('ingredients', 'instructions'):
        v = mr.get(key)
        if isinstance(v, list):
            mr[key] = [re.sub(r'\bpickaninny\b', 'chocolate', s, flags=re.IGNORECASE) if isinstance(s, str) else s for s in v]
        elif isinstance(v, str):
            mr[key] = re.sub(r'\bpickaninny\b', 'chocolate', v, flags=re.IGNORECASE)
    r['modern_recipe'] = mr

    # Editorial note — preserve any existing history_note and append.
    editor_note = (
        'Editorial note: this recipe was published in The Mary Frances '
        'Cook Book (1912) under a title containing a racial slur for a '
        'Black child. Heritage Kitchen has renamed the recipe to '
        '"Chocolate Fudge." The cooking method is unchanged from the '
        'original; only the slur has been removed.'
    )
    existing = r.get('history_note')
    if existing:
        if 'Editorial note' not in existing:
            r['history_note'] = f'{existing}\n\n{editor_note}'
    else:
        r['history_note'] = editor_note
    return new_id


def patch_rye_and_corn_bread(r):
    """wh-rye-and-corn-bread body — strip 'Rye and Injun' colloquialism."""
    original = r.get('original_recipe', '') or ''
    original = re.sub(r'"?Rye\s+and\s+Injun"?', 'rye-and-cornmeal bread', original, flags=re.IGNORECASE)
    r['original_recipe'] = original

    mr = r.get('modern_recipe') or {}
    for key in ('description', 'tips'):
        v = mr.get(key)
        if isinstance(v, str):
            mr[key] = re.sub(r'"?Rye\s+and\s+Injun"?', 'rye-and-cornmeal bread', v, flags=re.IGNORECASE)
    for key in ('ingredients', 'instructions'):
        v = mr.get(key)
        if isinstance(v, list):
            mr[key] = [re.sub(r'"?Rye\s+and\s+Injun"?', 'rye-and-cornmeal bread', s, flags=re.IGNORECASE) if isinstance(s, str) else s for s in v]
        elif isinstance(v, str):
            mr[key] = re.sub(r'"?Rye\s+and\s+Injun"?', 'rye-and-cornmeal bread', v, flags=re.IGNORECASE)
    r['modern_recipe'] = mr

    editor_note = (
        'Editorial note: the original White House Cookbook (1887) text '
        'referenced this dish by a colloquial colonial name that '
        'contained a slur for Indigenous Americans. The colloquial '
        'phrase has been replaced with "rye-and-cornmeal bread." The '
        'recipe itself is unchanged.'
    )
    existing = r.get('history_note')
    if existing:
        if 'Editorial note' not in existing:
            r['history_note'] = f'{existing}\n\n{editor_note}'
    else:
        r['history_note'] = editor_note
    return None  # no id change


def patch_hindoo_salad(r):
    """bcs-hindoo-salad → bcs-curried-tomato-salad."""
    new_id = 'bcs-curried-tomato-salad'
    r['id'] = new_id
    r['title'] = 'Curried Tomato Salad'

    # Replace "Hindoo Salad" and standalone "hindoo" uses.
    def scrub(text):
        if not isinstance(text, str):
            return text
        text = re.sub(r'Hindoo\s+Salad', 'Curried Tomato Salad', text, flags=re.IGNORECASE)
        text = re.sub(r'\bhindoo\b', 'curried', text, flags=re.IGNORECASE)
        return text

    r['original_recipe'] = scrub(r.get('original_recipe', ''))

    mr = r.get('modern_recipe') or {}
    for key in ('description', 'tips'):
        if isinstance(mr.get(key), str):
            mr[key] = scrub(mr[key])
    for key in ('ingredients', 'instructions'):
        v = mr.get(key)
        if isinstance(v, list):
            mr[key] = [scrub(s) for s in v]
        elif isinstance(v, str):
            mr[key] = scrub(v)
    r['modern_recipe'] = mr

    editor_note = (
        'Editorial note: Fannie Farmer published this curried tomato '
        'salad in the 1896 Boston Cooking-School Cook Book under the '
        'name "Hindoo Salad" — an orientalist label that conflated '
        'South Asian cuisines under one archaic descriptor. Heritage '
        'Kitchen has renamed the recipe to "Curried Tomato Salad" to '
        'describe what it actually is. The ingredients and method are '
        'unchanged.'
    )
    existing = r.get('history_note')
    if existing:
        if 'Editorial note' not in existing:
            r['history_note'] = f'{existing}\n\n{editor_note}'
    else:
        r['history_note'] = editor_note
    return new_id


PATCHES = {
    'mf-pickaninny-fudge': patch_pickaninny_fudge,
    'wh-rye-and-corn-bread': patch_rye_and_corn_bread,
    'bcs-hindoo-salad': patch_hindoo_salad,
}


def main():
    data = json.loads(DATASET.read_text())
    if isinstance(data, list):
        recipes = data
    else:
        recipes = data.get('recipes', [])

    id_map = {}  # old_id → new_id for the redirect table

    applied = []
    for r in recipes:
        rid = r.get('id')
        if rid in PATCHES:
            new_id = PATCHES[rid](r)
            if new_id and new_id != rid:
                id_map[rid] = new_id
            applied.append((rid, new_id or rid))

    # Write the patched dataset back, preserving the original top-level shape.
    if isinstance(data, list):
        out = recipes
    else:
        data['recipes'] = recipes
        out = data
    DATASET.write_text(json.dumps(out, indent=2, ensure_ascii=False))

    # Redirect map. Load the existing one if present and extend it.
    existing_redirects = {}
    if REDIRECTS.exists():
        try:
            existing_redirects = json.loads(REDIRECTS.read_text())
        except Exception:
            existing_redirects = {}
    existing_redirects.update(id_map)
    REDIRECTS.write_text(json.dumps(existing_redirects, indent=2, ensure_ascii=False))

    print(f'Patched {len(applied)} recipes:')
    for old, new in applied:
        if old == new:
            print(f'  {old}  (body scrub, no id change)')
        else:
            print(f'  {old}  →  {new}')
    print()
    print(f'Redirect map: {REDIRECTS}  ({len(existing_redirects)} entries)')
    return 0


if __name__ == '__main__':
    sys.exit(main())
