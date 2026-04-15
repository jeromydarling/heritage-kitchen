/**
 * Heuristic kid/grown-up task splitter for "Cook with kids" mode.
 *
 * The current recipe library (3,485 entries) wasn't authored with
 * kid-mode in mind. Each instruction step is a single blob of text
 * that needs to be classified on the fly as:
 *
 *   - "kid"       — a kid of the given age can safely do this alone
 *                   (washing, stirring, pressing, pouring, measuring
 *                   dry ingredients)
 *   - "grownup"   — requires adult hands (hot stove, sharp knife,
 *                   raw meat, boiling, oven)
 *   - "together"  — both hands on the job (kneading dough, rolling
 *                   out crust, shaping cookies)
 *
 * The rules below are intentionally keyword-based and deterministic.
 * They cover the common cases and fall back to "together" when a
 * step mixes signals. For the ~300 explicitly kid-friendly recipes
 * we'll overlay LLM-augmented task arrays in a later commit; the
 * heuristic is the fallback for every other recipe in the library.
 */

export type KidTaskKind = 'kid' | 'grownup' | 'together';

export interface ClassifiedStep {
  kind: KidTaskKind;
  text: string;
}

// Signals that a step unambiguously requires adult hands. These
// override every "kid" signal — better to be conservative on safety.
const GROWNUP_SIGNALS = [
  /\b(stove|burner|flame|fire|open flame)\b/i,
  /\b(boil(?:ing|s|ed)?|simmer|scald)\b/i,
  /\b(fry(?:ing|s|ied)?|sauté|sautee|deep[- ]fry|pan[- ]fry)\b/i,
  /\b(hot\s+(?:fat|oil|grease|butter|pan|skillet|water))\b/i,
  /\b(sharp\s+knife|chop|slice|mince|dice|cube|julienne|fillet|debone|bone)\b/i,
  /\b(remove\s+from\s+(?:oven|heat|stove))\b/i,
  /\b(broil|broiler)\b/i,
  /\b(drain\s+(?:through|in)\s+(?:a\s+)?colander)\b/i,
  /\b(raw\s+(?:chicken|turkey|poultry|pork|beef|meat|eggs?))\b/i,
  /\b(pressure\s+cook|canner|can\s+(?:the|them))\b/i,
  /\b(grater|grate\b)/i,
  /\b(blender|food\s+processor|mandoline)\b/i,
  /\b(carve|carving)\b/i,
  /\b(sear|searing)\b/i,
  /\b(reduce\s+(?:by|to|until))\b/i,
  /\b(caramel(?:ize|ise|ization))\b/i,
  /\b(candy\s+thermometer|soft[- ]ball|hard[- ]crack|thread\s+stage)\b/i,
];

// Signals that a step is kid-safe. Leaves the oven alone entirely
// (oven temperature adjustments are a grown-up job, though opening
// the oven to peek is fine together).
const KID_SIGNALS = [
  /\b(wash|rinse|clean|dry)\s+(?:the\s+)?(?:berries|fruit|lettuce|vegetables|greens|herbs|mushrooms)\b/i,
  /\b(pick|tear|shred)\s+(?:the\s+)?(?:herbs|lettuce|basil|parsley)\b/i,
  /\b(measure\s+(?:out\s+)?(?:the\s+)?(?:flour|sugar|salt|baking|milk|water))\b/i,
  /\b(pour\s+(?:the\s+)?(?:milk|water|oil|juice|cream|liquid))\b/i,
  /\b(stir|whisk|mix|combine|fold|beat)\b/i,
  /\b(sprinkle|dust|toss)\b/i,
  /\b(press\s+(?:the\s+)?(?:dough|crust|crumbs))\b/i,
  /\b(shape\s+into|form\s+into|roll\s+into\s+balls?)\b/i,
  /\b(arrange|place|lay|put)\s+(?:the\s+)?(?:fruit|berries|cookies|biscuits)\b/i,
  /\b(break|crack)\s+(?:the\s+)?eggs?\b/i,
  /\b(butter|grease)\s+(?:the\s+)?(?:pan|dish|tin|cups?)\b/i,
  /\b(sift)\b/i,
  /\b(set\s+aside|cover\s+with)\b/i,
];

// Signals that a step is best done together — kneading, rolling,
// anything where the kid can help but not lead.
const TOGETHER_SIGNALS = [
  /\b(knead|kneading)\b/i,
  /\b(roll\s+out|roll\s+the\s+dough|rolling\s+pin)\b/i,
  /\b(cut\s+out\s+(?:the\s+)?(?:cookies|biscuits|shapes))\b/i,
  /\b(spread\s+(?:the\s+)?(?:dough|batter|filling))\b/i,
  /\b(decorate|decorating|frost(?:ing)?)\b/i,
  /\b(assemble\s+(?:the\s+)?(?:pie|tart|sandwich|cake))\b/i,
  /\b(fill\s+(?:the\s+)?(?:pastry|shells|crust|muffin))\b/i,
];

// Mild signals that a step is probably grown-up territory for very
// young kids. Used only when age < 8.
const CAUTIOUS_SIGNALS = [
  /\b(oven\s+to|preheat|turn\s+on\s+the\s+oven|set\s+the\s+oven)\b/i,
  /\b(put\s+(?:it|in)\s+(?:in|into)\s+the\s+oven)\b/i,
  /\b(take\s+out\s+of\s+the\s+oven)\b/i,
];

/** Score a single instruction step and return its classification. */
export function classifyStep(step: string, age = 8): ClassifiedStep {
  const text = step.trim();
  if (!text) return { kind: 'together', text };

  let grownup = 0;
  let kid = 0;
  let together = 0;

  for (const re of GROWNUP_SIGNALS) if (re.test(text)) grownup += 2;
  for (const re of KID_SIGNALS) if (re.test(text)) kid += 1;
  for (const re of TOGETHER_SIGNALS) if (re.test(text)) together += 2;
  if (age < 8) {
    for (const re of CAUTIOUS_SIGNALS) if (re.test(text)) grownup += 1;
  }

  // Safety rule: any grown-up signal dominates. A step that mentions
  // both "wash the berries" and "in boiling water" is grown-up. We
  // never get this wrong in the direction that matters.
  if (grownup > 0) return { kind: 'grownup', text };
  if (together > 0) return { kind: 'together', text };
  if (kid > 0) return { kind: 'kid', text };
  // Fall back to "together" — the safe neutral when no signal fires.
  return { kind: 'together', text };
}

/** Classify every step in an instructions array. */
export function classifySteps(steps: string[], age = 8): ClassifiedStep[] {
  return steps.map((s) => classifyStep(s, age));
}

/**
 * Generate a "Before you call the kid over" pre-flight checklist
 * from the ingredients and instructions. Looks for things the
 * grown-up should do alone before the kid shows up:
 *   - Preheating the oven
 *   - Pre-measuring ingredients (so the kid can dump them in)
 *   - Setting out tools / the stepstool
 *   - Washing raw produce that'll end up cooked
 */
export function generatePrepList(
  ingredients: string[],
  steps: string[],
): string[] {
  const items: string[] = [];
  const stepsText = steps.join(' ').toLowerCase();

  const ovenMatch = stepsText.match(/(?:preheat|oven\s+to)\s+([0-9]{3})/i);
  if (ovenMatch) {
    items.push(`Preheat the oven to ${ovenMatch[1]}°F.`);
  } else if (/\boven\b/.test(stepsText)) {
    items.push('Preheat the oven to the temperature the recipe calls for.');
  }

  if (ingredients.length >= 3) {
    items.push('Pre-measure every ingredient into small bowls so the kid can dump them in.');
  }

  if (/\b(stepstool|step[- ]stool)\b/.test(stepsText)) {
    // rare, but surface if the recipe mentions it
    items.push('Put out the stepstool.');
  } else {
    items.push('Put out the stepstool and an apron for the kid.');
  }

  if (/\b(flour|dough|batter|crumbs)\b/.test(stepsText)) {
    items.push('Spread a clean dish towel on the counter — flour gets everywhere.');
  }

  if (/\b(eggs?)\b/.test(stepsText)) {
    items.push('Have a small extra bowl ready for egg shells.');
  }

  if (/\b(knife|chop|slice|dice)\b/.test(stepsText)) {
    items.push('Do any knife work before the kid arrives.');
  }

  if (
    /\b(raw\s+(?:chicken|turkey|poultry|pork|beef|meat))\b/.test(stepsText)
  ) {
    items.push('Handle any raw meat yourself, then wash your hands and the counter before the kid touches anything.');
  }

  return items;
}

/**
 * Human label for a task kind, used in the recipe view badges.
 */
export const TASK_LABELS: Record<KidTaskKind, string> = {
  kid: "Kid's job",
  grownup: "Grown-up's job",
  together: 'Together',
};

/**
 * Tailwind classes for each task kind's badge.
 */
export const TASK_STYLES: Record<KidTaskKind, string> = {
  kid: 'bg-sage/20 text-sage-dark border-sage/40',
  grownup: 'bg-terracotta/15 text-terracotta border-terracotta/40',
  together: 'bg-cream border-rule text-ink/80',
};
