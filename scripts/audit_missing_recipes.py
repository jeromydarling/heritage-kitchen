#!/usr/bin/env python3
"""
Audit the Heritage Kitchen recipe dataset for recipes that are missing
ingredients, missing cooking instructions, or both. Outputs a JSON
report (scripts/missing_recipes.json) plus a short Markdown summary
(scripts/missing_recipes.md) that can be handed to a re-processing
pipeline.

Criteria:
  - Missing ingredients: the modern_recipe.ingredients field is empty,
    a placeholder like "See original recipe...", or too short to be
    a real list (< 2 items for array form, < 40 chars for string form).
  - Missing instructions: the modern_recipe.instructions field is empty,
    a placeholder, or a single short step under ~60 chars that can't
    possibly cook the dish.
  - Self-reference bug: the instructions mention the recipe's own
    title (e.g. "Potato Cakes" whose instructions end with "cook same
    as Potato Cakes" — a scraper regression that lost the sibling
    variant).
"""
import json
import re
import sys
from pathlib import Path

DATASET = Path(__file__).parent.parent / 'public' / 'heritage_kitchen_recipes.json'
OUT_JSON = Path(__file__).parent / 'missing_recipes.json'
OUT_MD = Path(__file__).parent / 'missing_recipes.md'

PLACEHOLDER_RE = re.compile(
    r'^\s*(see\s+(original|above|below|previous|main|note)|refer\s+to|as\s+in\s+the\s+original|tbd|todo|placeholder)',
    re.IGNORECASE,
)

# Fragments that indicate a truncated ingredient — the extractor broke
# mid-sentence and we ended up with a pointer to something else in the
# book that didn't make it into the field.
FRAGMENT_SUFFIX_RE = re.compile(r'[:;,]\s*$')
FRAGMENT_TEXT_TOKENS = [
    'see above',
    'see note',
    'as follows',
    'as directed',
    'the same as',
    'as below',
]

MIN_INSTRUCTION_CHAR_TOTAL = 60

def normalize_list(val):
    if val is None:
        return []
    if isinstance(val, str):
        return [val] if val.strip() else []
    if isinstance(val, list):
        return [str(x).strip() for x in val if x and str(x).strip()]
    return []

def is_placeholder(text: str) -> bool:
    return bool(PLACEHOLDER_RE.match(text or ''))

def looks_like_fragment(text: str) -> bool:
    """A truncated ingredient that trails off or points elsewhere."""
    if FRAGMENT_SUFFIX_RE.search(text):
        return True
    lower = text.lower()
    return any(tok in lower for tok in FRAGMENT_TEXT_TOKENS)

def audit_ingredients(mr) -> str | None:
    """Returns a reason string if ingredients are missing, or None if fine.

    A recipe with a genuine one-item list ("6 slices of bacon", "1 head
    lettuce") is fine — some dishes really are one ingredient. We only
    flag empty lists, placeholders ("See original recipe"), and single-
    entry fragments that trail off ("To one half add:"). Section
    headers like "FOR THE ICING:" inside a multi-item list are fine.
    """
    raw = mr.get('ingredients')
    items = normalize_list(raw)
    if not items:
        return 'empty'
    if any(is_placeholder(i) for i in items):
        hit = next(i for i in items if is_placeholder(i))
        return f'placeholder: "{hit[:80]}"'
    if len(items) == 1 and looks_like_fragment(items[0]):
        return f'fragment: "{items[0][:80]}"'
    return None

def audit_instructions(mr, title) -> str | None:
    raw = mr.get('instructions')
    items = normalize_list(raw)
    if not items:
        return 'empty'
    if any(is_placeholder(i) for i in items):
        hit = next(i for i in items if is_placeholder(i))
        return f'placeholder: "{hit[:80]}"'
    total_chars = sum(len(i) for i in items)
    if total_chars < MIN_INSTRUCTION_CHAR_TOTAL:
        return f'too short ({len(items)} steps, {total_chars} chars)'
    # Self-reference: instructions mention the recipe's own title as a
    # "cook same as X" / "proceed as for X" back-reference.
    title_l = title.strip().lower()
    if title_l:
        joined = ' '.join(items).lower()
        self_ref = re.search(
            r'(?:cook|bake|boil|fry|proceed|make|prepared?)\s+(?:same as|as for|as in|like|as)\s+' + re.escape(title_l),
            joined,
        )
        if self_ref:
            return f'self-reference: "...{self_ref.group(0)[:80]}"'
    return None

def main():
    data = json.loads(DATASET.read_text())
    recipes = data if isinstance(data, list) else data.get('recipes', [])
    missing = []
    stats = {
        'total': 0,
        'missing_ingredients_only': 0,
        'missing_instructions_only': 0,
        'missing_both': 0,
    }
    for r in recipes:
        if r.get('content_type') == 'essay':
            continue
        stats['total'] += 1
        mr = r.get('modern_recipe') or {}
        ing_reason = audit_ingredients(mr)
        ins_reason = audit_instructions(mr, r.get('title', ''))
        if not ing_reason and not ins_reason:
            continue
        if ing_reason and ins_reason:
            stats['missing_both'] += 1
        elif ing_reason:
            stats['missing_ingredients_only'] += 1
        else:
            stats['missing_instructions_only'] += 1
        missing.append({
            'id': r.get('id'),
            'title': r.get('title'),
            'source_book': r.get('source_book'),
            'source_year': r.get('source_year'),
            'source_url': r.get('source_url'),
            'category': r.get('category'),
            'missing_ingredients': ing_reason,
            'missing_instructions': ins_reason,
            'original_recipe': r.get('original_recipe', ''),
            'current_modern_ingredients': mr.get('ingredients'),
            'current_modern_instructions': mr.get('instructions'),
        })

    # Sort: most broken first (both), then instructions, then ingredients,
    # then by source_book for grouping.
    def sort_key(x):
        score = (
            (2 if x['missing_ingredients'] and x['missing_instructions'] else
             1 if x['missing_instructions'] else 0)
        )
        return (-score, x['source_book'] or '', x['title'] or '')
    missing.sort(key=sort_key)

    OUT_JSON.write_text(json.dumps(missing, indent=2, ensure_ascii=False))

    # Markdown summary
    lines = [
        '# Recipes missing ingredients or instructions',
        '',
        f'Total recipes audited: **{stats["total"]}**',
        f'Recipes with missing data: **{len(missing)}**',
        '',
        '| Category | Count |',
        '| --- | ---: |',
        f'| Missing both | {stats["missing_both"]} |',
        f'| Missing instructions only | {stats["missing_instructions_only"]} |',
        f'| Missing ingredients only | {stats["missing_ingredients_only"]} |',
        '',
        '## By source book',
        '',
    ]
    by_book = {}
    for m in missing:
        by_book.setdefault(m['source_book'] or 'Unknown', []).append(m)
    for book in sorted(by_book):
        lines.append(f'### {book} ({len(by_book[book])})')
        lines.append('')
        for m in by_book[book][:]:
            tag = []
            if m['missing_ingredients']:
                tag.append(f'ingredients ({m["missing_ingredients"]})')
            if m['missing_instructions']:
                tag.append(f'instructions ({m["missing_instructions"]})')
            lines.append(f'- **{m["title"]}** ({m["id"]}) — {"; ".join(tag)}')
        lines.append('')

    OUT_MD.write_text('\n'.join(lines))

    # Console summary
    print(f'Audited {stats["total"]} recipes.')
    print(f'  Missing both:             {stats["missing_both"]}')
    print(f'  Missing instructions:     {stats["missing_instructions_only"]}')
    print(f'  Missing ingredients only: {stats["missing_ingredients_only"]}')
    print(f'  Total to re-process:      {len(missing)}')
    print()
    print(f'Wrote:')
    print(f'  {OUT_JSON}  ({OUT_JSON.stat().st_size // 1024} KB)')
    print(f'  {OUT_MD}')
    return 0

if __name__ == '__main__':
    sys.exit(main())
