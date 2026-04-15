#!/usr/bin/env python3
"""
Audit the recipe library for racial slurs, ethnic slurs, and
dehumanizing period-era terms.

Heritage Kitchen publishes recipes from cookbooks written between
1869 and 1920. Some of those books contain language that was
casually offensive in its own time and is plainly unacceptable now —
most obviously slurs in recipe titles. This script surfaces every
such hit so the editor can rename or remove them before the recipe
renders anywhere on the site.

Three severities:

  HARD: the word is a slur with no innocent meaning. Must be
        renamed or removed before the recipe can be published.
  SOFT: the word has shifted in register. In the 1900s it was a
        neutral descriptor; today it reads as at best clinical and
        at worst dehumanizing. Editor's call.
  CONTEXT: the word has both innocent and offensive uses depending
        on context (e.g. "gypsy" as a food name, "Indian" as in
        "Indian pudding" which refers to cornmeal). Editor reviews
        the surrounding text.

Output:
  scripts/problematic_titles.json — structured for re-processing
  scripts/problematic_titles.md   — human-readable report
"""
import json
import re
from pathlib import Path
from collections import defaultdict

ROOT = Path(__file__).parent.parent
DATASET = ROOT / 'public' / 'heritage_kitchen_recipes.json'
OUT_JSON = ROOT / 'scripts' / 'problematic_titles.json'
OUT_MD = ROOT / 'scripts' / 'problematic_titles.md'

# HARD: slurs with no innocent meaning. Must be renamed or removed.
# Word-boundary matched, case-insensitive. Some entries are deliberately
# encoded compactly to avoid false-hitting innocent words.
HARD_SLURS = [
    ('pickaninny', 'racial slur for a Black child; common in pre-WWII white American cookbooks'),
    ('pickaninnies', 'racial slur for Black children'),
    ('nigger', 'the most severe racial slur against Black people'),
    ('niggers', 'the most severe racial slur against Black people'),
    ('darky', 'racial slur for a Black person'),
    ('darkey', 'racial slur for a Black person (alt. spelling)'),
    ('darkie', 'racial slur for a Black person (alt. spelling)'),
    ('darkies', 'racial slur for Black people (plural)'),
    ('coon', 'racial slur for a Black person (also a raccoon in context — check)'),
    ('chink', 'racial slur for a Chinese person'),
    ('jap', 'ethnic slur for a Japanese person'),
    ('japs', 'ethnic slur for Japanese people'),
    ('dago', 'ethnic slur for an Italian person'),
    ('wop', 'ethnic slur for an Italian person'),
    ('kike', 'ethnic slur for a Jewish person'),
    ('hebe', 'ethnic slur for a Jewish person'),
    ('squaw', 'slur for an Indigenous woman'),
    ('squaws', 'slur for Indigenous women'),
    ('injun', 'derogatory term for Indigenous Americans'),
    ('injuns', 'derogatory term for Indigenous Americans'),
    ('redskin', 'slur for an Indigenous American'),
    ('redskins', 'slur for Indigenous Americans'),
]

# SOFT: terms that were once neutral descriptors and now read as at
# best clinical and at worst dehumanizing. Editor decides per-case.
SOFT_TERMS = [
    ('negro', 'clinical in 1900, dehumanizing today; rename to "African American" or remove'),
    ('negroes', 'plural; same concerns'),
    ('negress', 'feminized form; particularly dehumanizing'),
    ('mulatto', 'a race-based term for mixed ancestry; no longer used in respectful writing'),
    ('octoroon', 'a race-based term based on fractional ancestry; obsolete'),
    ('quadroon', 'a race-based term based on fractional ancestry; obsolete'),
    ('oriental', 'outdated term for East Asian; replace with "Asian" or the specific country'),
    ('hindoo', 'archaic spelling; use "Hindu" or "Indian" per context'),
    ('mohammedan', 'archaic term for Muslim; replace with "Muslim"'),
    ('mahometan', 'archaic term for Muslim; replace with "Muslim"'),
    ('eskimo', 'some communities find this offensive; prefer "Inuit" or the specific people'),
    ('gypsy', 'widely considered a slur for Romani people; context-dependent in food names'),
    ('gypsies', 'same concerns'),
]

# CONTEXT: terms that have both innocent food-name uses and problematic
# uses. Surface them all so the editor can eyeball the context.
CONTEXT_TERMS = [
    ('indian pudding', 'legitimate New England dish name from "Indian meal" = cornmeal'),
    ('indian meal', 'historical term for cornmeal; not about Indigenous people as such'),
    ('nigger toes', 'offensive old name for brazil nuts; must be renamed'),
    ('jew bread', 'historical term; consider renaming to "matzo"'),
    ('jew cake', 'historical term; consider renaming'),
    ('jewish', 'usually fine; surface to check surrounding context'),
    ('chinaman', 'offensive; rename even in recipe titles'),
]


def build_regex(terms):
    """Build a single word-boundary regex for fast matching."""
    words = [re.escape(t) for t, _ in terms]
    # Sort by length descending so multi-word phrases match before their components.
    words.sort(key=len, reverse=True)
    return re.compile(r'\b(' + '|'.join(words) + r')\b', re.IGNORECASE)


def get_explanations(terms):
    return {t.lower(): reason for t, reason in terms}


HARD_RE = build_regex(HARD_SLURS)
SOFT_RE = build_regex(SOFT_TERMS)
CONTEXT_RE = build_regex(CONTEXT_TERMS)
HARD_EXP = get_explanations(HARD_SLURS)
SOFT_EXP = get_explanations(SOFT_TERMS)
CONTEXT_EXP = get_explanations(CONTEXT_TERMS)


def scan_text(text, regex, explanations, severity):
    """Returns a list of (term, severity, reason, excerpt) tuples."""
    if not text:
        return []
    out = []
    for m in regex.finditer(text):
        term = m.group(0).lower()
        start = max(0, m.start() - 40)
        end = min(len(text), m.end() + 40)
        excerpt = text[start:end].replace('\n', ' ').strip()
        out.append({
            'term': term,
            'severity': severity,
            'reason': explanations.get(term, ''),
            'excerpt': f'…{excerpt}…' if start > 0 or end < len(text) else excerpt,
        })
    return out


def audit_recipe(r):
    """Scan title, original_recipe, modern_recipe for problematic terms."""
    hits = []
    title = r.get('title', '') or ''
    original = r.get('original_recipe', '') or ''
    mr = r.get('modern_recipe') or {}
    modern_parts = []
    for k in ('description', 'tips'):
        v = mr.get(k)
        if isinstance(v, str): modern_parts.append(v)
    for k in ('ingredients', 'instructions'):
        v = mr.get(k)
        if isinstance(v, list):
            modern_parts.extend(str(x) for x in v if x)
        elif isinstance(v, str):
            modern_parts.append(v)
    modern = '\n'.join(modern_parts)

    for (text, where) in (
        (title, 'title'),
        (original, 'original'),
        (modern, 'modern'),
    ):
        for h in scan_text(text, HARD_RE, HARD_EXP, 'HARD'):
            h['where'] = where
            hits.append(h)
        for h in scan_text(text, SOFT_RE, SOFT_EXP, 'SOFT'):
            h['where'] = where
            hits.append(h)
        for h in scan_text(text, CONTEXT_RE, CONTEXT_EXP, 'CONTEXT'):
            h['where'] = where
            hits.append(h)
    return hits


def main():
    data = json.loads(DATASET.read_text())
    recipes = data if isinstance(data, list) else data.get('recipes', [])

    flagged = []
    hard_count = soft_count = context_count = 0

    for r in recipes:
        hits = audit_recipe(r)
        if not hits:
            continue
        severities = {h['severity'] for h in hits}
        if 'HARD' in severities:
            hard_count += 1
        elif 'SOFT' in severities:
            soft_count += 1
        else:
            context_count += 1
        flagged.append({
            'id': r.get('id'),
            'title': r.get('title'),
            'source_book': r.get('source_book'),
            'source_year': r.get('source_year'),
            'content_type': r.get('content_type'),
            'worst_severity': ('HARD' if 'HARD' in severities else
                               'SOFT' if 'SOFT' in severities else 'CONTEXT'),
            'hits': hits,
        })

    # Sort HARD first, then SOFT, then CONTEXT
    severity_order = {'HARD': 0, 'SOFT': 1, 'CONTEXT': 2}
    flagged.sort(key=lambda x: (severity_order[x['worst_severity']], x['source_book'] or '', x['title'] or ''))

    OUT_JSON.write_text(json.dumps(flagged, indent=2, ensure_ascii=False))

    # Markdown report
    lines = [
        '# Problematic titles audit',
        '',
        f'Total recipes scanned: **{len(recipes)}**',
        f'Flagged: **{len(flagged)}**',
        '',
        '| Severity | Count | What to do |',
        '| --- | ---: | --- |',
        f'| HARD | {hard_count} | Must be renamed or removed before rendering anywhere on the site. |',
        f'| SOFT | {soft_count} | Editor\'s call — rewrite with a modern respectful term, or leave with an editorial note. |',
        f'| CONTEXT | {context_count} | Eyeball the context to decide — some may be innocent food-name uses. |',
        '',
        '## HARD — slurs with no innocent meaning',
        '',
    ]

    by_severity = defaultdict(list)
    for f in flagged:
        by_severity[f['worst_severity']].append(f)

    def render_group(severity, group):
        ls = []
        for f in group:
            ls.append(f'### {f["title"]}  <sub>`{f["id"]}`</sub>')
            ls.append('')
            ls.append(f'- **Source**: {f["source_book"]} ({f["source_year"]})')
            ls.append(f'- **Type**: {f["content_type"] or "recipe"}')
            ls.append('')
            for h in f['hits']:
                if h['severity'] != severity:
                    continue
                ls.append(f'  - **`{h["term"]}`** in *{h["where"]}* — {h["reason"]}')
                ls.append(f'    > {h["excerpt"]}')
            ls.append('')
        return ls

    lines.extend(render_group('HARD', by_severity['HARD']))

    lines.append('## SOFT — once-neutral terms now clinical or dehumanizing')
    lines.append('')
    lines.extend(render_group('SOFT', by_severity['SOFT']))

    lines.append('## CONTEXT — eyeball the surrounding text')
    lines.append('')
    lines.extend(render_group('CONTEXT', by_severity['CONTEXT']))

    OUT_MD.write_text('\n'.join(lines))

    print(f'Scanned {len(recipes)} recipes.')
    print(f'  HARD:    {hard_count}  (must rename or remove)')
    print(f'  SOFT:    {soft_count}  (editor\'s call)')
    print(f'  CONTEXT: {context_count}  (eyeball the context)')
    print(f'  Total:   {len(flagged)}')
    print()
    print(f'Wrote:')
    print(f'  {OUT_JSON}')
    print(f'  {OUT_MD}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
