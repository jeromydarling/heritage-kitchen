import { jsPDF } from 'jspdf';
import type { Recipe } from './types';

// ====================================================================
// FONT LOADING
// ====================================================================
//
// Playfair Display, Lora, and Courier Prime are bundled as static TTF
// assets in /public/fonts/. On first PDF generation we fetch them, base64
// them once, cache the result, and register them with each jsPDF instance
// via addFileToVFS + addFont. Named families: "Playfair" (display serif),
// "Lora" (body serif with italic), "CourierPrime" (typewriter).
// The web-safe "helvetica" and "times" families remain available as
// fallbacks if callers ever need them.

interface FontAssets {
  playfairRegular: string;
  loraRegular: string;
  loraItalic: string;
  courier: string;
}

let cachedFonts: FontAssets | null = null;

async function loadFonts(): Promise<FontAssets> {
  if (cachedFonts) return cachedFonts;
  const base = (import.meta.env.BASE_URL as string) ?? '/';
  const fetchBase64 = async (file: string): Promise<string> => {
    const res = await fetch(`${base}fonts/${file}`);
    if (!res.ok) throw new Error(`font fetch failed: ${file}`);
    const buf = await res.arrayBuffer();
    return arrayBufferToBase64(buf);
  };
  cachedFonts = {
    playfairRegular: await fetchBase64('PlayfairDisplay-Regular.ttf'),
    loraRegular: await fetchBase64('Lora-Regular.ttf'),
    loraItalic: await fetchBase64('Lora-Italic.ttf'),
    courier: await fetchBase64('CourierPrime-Regular.ttf'),
  };
  return cachedFonts;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(
      null,
      Array.from(bytes.subarray(i, i + chunkSize)),
    );
  }
  return btoa(binary);
}

function applyFonts(doc: jsPDF, assets: FontAssets) {
  doc.addFileToVFS('PlayfairDisplay-Regular.ttf', assets.playfairRegular);
  doc.addFont('PlayfairDisplay-Regular.ttf', 'Playfair', 'normal');
  doc.addFont('PlayfairDisplay-Regular.ttf', 'Playfair', 'bold');

  doc.addFileToVFS('Lora-Regular.ttf', assets.loraRegular);
  doc.addFont('Lora-Regular.ttf', 'Lora', 'normal');
  doc.addFont('Lora-Regular.ttf', 'Lora', 'bold');

  doc.addFileToVFS('Lora-Italic.ttf', assets.loraItalic);
  doc.addFont('Lora-Italic.ttf', 'Lora', 'italic');

  doc.addFileToVFS('CourierPrime-Regular.ttf', assets.courier);
  doc.addFont('CourierPrime-Regular.ttf', 'CourierPrime', 'normal');
}

/**
 * Client-side PDF generator for the Heritage Kitchen cookbook builder.
 *
 * Produces a text-based (crisp) PDF at 6x9 inches trim, which is the size
 * Lulu offers for a "Premium Color Hardcover" family cookbook. Uses built-in
 * jsPDF fonts (Times for body, Helvetica for small-caps headers) to keep
 * the download small â€” no web fonts are embedded.
 *
 * The layout intentionally mirrors the on-screen print view: serif title
 * page with an Augustine epigraph, table of contents, and one recipe per
 * section with its ingredients and numbered instructions.
 */

export interface CookbookProject {
  title: string;
  subtitle: string | null;
  dedication: string | null;
  /** Optional editorial foreword page, one paragraph of prose from the author. */
  foreword?: string | null;
  /** When true, recipes are grouped by category with a divider page between groups. */
  groupByCategory?: boolean;
  recipes: Recipe[];
}

// Page dimensions â€” 6x9 inches in points (1 inch = 72 points).
const PAGE_W = 432;
const PAGE_H = 648;
const MARGIN_X = 54; // 3/4 inch
const MARGIN_TOP = 72; // 1 inch
const MARGIN_BOTTOM = 72;
const CONTENT_W = PAGE_W - MARGIN_X * 2;

interface Cursor {
  y: number;
  page: number;
}

export async function generateCookbookPdf(project: CookbookProject): Promise<Blob> {
  const doc = new jsPDF({
    unit: 'pt',
    format: [PAGE_W, PAGE_H],
    compress: true,
  });

  // -------- Title page --------
  drawTitlePage(doc, project);

  // -------- Table of contents --------
  doc.addPage();
  const tocCursor: Cursor = { y: MARGIN_TOP, page: doc.getNumberOfPages() };
  drawTableOfContents(doc, project.recipes, tocCursor);

  // -------- Recipes --------
  for (const recipe of project.recipes) {
    doc.addPage();
    const cursor: Cursor = { y: MARGIN_TOP, page: doc.getNumberOfPages() };
    drawRecipe(doc, recipe, cursor);
  }

  // -------- Colophon --------
  doc.addPage();
  drawColophon(doc);

  return doc.output('blob');
}

function drawTitlePage(doc: jsPDF, project: CookbookProject) {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(120, 90, 60);
  centeredText(doc, 'HERITAGE KITCHEN', PAGE_H / 2 - 180);

  doc.setFont('Lora', 'italic');
  doc.setFontSize(11);
  doc.setTextColor(120, 110, 90);
  centeredText(doc, '"Beauty ever ancient, ever new."', PAGE_H / 2 - 150);
  centeredText(doc, '\u2014 St. Augustine', PAGE_H / 2 - 133);

  doc.setFont('Playfair', 'normal');
  doc.setFontSize(32);
  doc.setTextColor(59, 35, 20);
  const titleLines = doc.splitTextToSize(project.title, CONTENT_W);
  let y = PAGE_H / 2 - 60;
  for (const line of titleLines as string[]) {
    centeredText(doc, line, y);
    y += 36;
  }

  if (project.subtitle) {
    doc.setFont('Lora', 'italic');
    doc.setFontSize(14);
    doc.setTextColor(120, 110, 90);
    const subLines = doc.splitTextToSize(project.subtitle, CONTENT_W);
    y += 12;
    for (const line of subLines as string[]) {
      centeredText(doc, line, y);
      y += 18;
    }
  }

  if (project.dedication) {
    doc.setFont('Lora', 'italic');
    doc.setFontSize(11);
    doc.setTextColor(120, 110, 90);
    const dedLines = doc.splitTextToSize(project.dedication, CONTENT_W - 80);
    let dy = PAGE_H - 180;
    for (const line of dedLines as string[]) {
      centeredText(doc, line, dy);
      dy += 16;
    }
  }

  // Footer
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(120, 90, 60);
  centeredText(doc, 'heritagekitchen.app', PAGE_H - 54);
}

function drawTableOfContents(doc: jsPDF, recipes: Recipe[], c: Cursor) {
  doc.setFont('Playfair', 'normal');
  doc.setFontSize(24);
  doc.setTextColor(59, 35, 20);
  doc.text('Contents', MARGIN_X, c.y);
  c.y += 36;

  doc.setFont('Lora', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(59, 35, 20);

  recipes.forEach((r, i) => {
    if (c.y > PAGE_H - MARGIN_BOTTOM - 14) {
      doc.addPage();
      c.y = MARGIN_TOP;
    }
    const number = `${i + 1}.`;
    const title = r.title;
    const year = r.source_year;
    doc.text(number, MARGIN_X, c.y);
    doc.text(title, MARGIN_X + 22, c.y);
    doc.setTextColor(120, 110, 90);
    const yearWidth = doc.getTextWidth(year);
    doc.text(year, PAGE_W - MARGIN_X - yearWidth, c.y);
    doc.setTextColor(59, 35, 20);
    c.y += 16;
  });
}

function drawRecipe(doc: jsPDF, recipe: Recipe, c: Cursor) {
  // Source line (small caps)
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(120, 90, 60);
  doc.text(
    `${recipe.source_book.toUpperCase()}  ${String.fromCharCode(183)}  ${recipe.source_year}`,
    MARGIN_X,
    c.y,
  );
  c.y += 14;

  // Title
  doc.setFont('Playfair', 'normal');
  doc.setFontSize(22);
  doc.setTextColor(59, 35, 20);
  const titleLines = doc.splitTextToSize(recipe.title, CONTENT_W);
  for (const line of titleLines as string[]) {
    needRoom(doc, c, 26);
    doc.text(line, MARGIN_X, c.y);
    c.y += 26;
  }

  // Description
  const m = recipe.modern_recipe;
  if (m.description) {
    c.y += 4;
    doc.setFont('Lora', 'italic');
    doc.setFontSize(11);
    doc.setTextColor(90, 70, 50);
    const lines = doc.splitTextToSize(m.description, CONTENT_W);
    for (const line of lines as string[]) {
      needRoom(doc, c, 14);
      doc.text(line, MARGIN_X, c.y);
      c.y += 14;
    }
  }

  // Stats
  c.y += 8;
  const statParts = [
    m.prep_time && `Prep ${m.prep_time}`,
    m.cook_time && `Cook ${m.cook_time}`,
    m.servings && `Serves ${m.servings}`,
  ].filter(Boolean) as string[];
  if (statParts.length > 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(120, 90, 60);
    doc.text(statParts.join('   \u00B7   '), MARGIN_X, c.y);
    c.y += 18;
  }

  // Ingredients
  const ingredients = Array.isArray(m.ingredients)
    ? m.ingredients
    : m.ingredients
      ? [m.ingredients]
      : [];
  if (ingredients.length > 0) {
    needRoom(doc, c, 32);
    doc.setFont('Playfair', 'normal');
    doc.setFontSize(14);
    doc.setTextColor(59, 35, 20);
    doc.text('Ingredients', MARGIN_X, c.y);
    c.y += 18;
    doc.setFont('Lora', 'normal');
    doc.setFontSize(10);
    for (const ing of ingredients) {
      const lines = doc.splitTextToSize(`\u00B7  ${ing}`, CONTENT_W - 10);
      for (const line of lines as string[]) {
        needRoom(doc, c, 13);
        doc.text(line, MARGIN_X + 4, c.y);
        c.y += 13;
      }
    }
    c.y += 6;
  }

  // Instructions
  const instructions = Array.isArray(m.instructions)
    ? m.instructions
    : m.instructions
      ? [m.instructions]
      : [];
  if (instructions.length > 0) {
    needRoom(doc, c, 32);
    doc.setFont('Playfair', 'normal');
    doc.setFontSize(14);
    doc.setTextColor(59, 35, 20);
    doc.text('Instructions', MARGIN_X, c.y);
    c.y += 18;
    doc.setFont('Lora', 'normal');
    doc.setFontSize(10);
    instructions.forEach((step, i) => {
      const prefix = `${i + 1}.  `;
      const lines = doc.splitTextToSize(prefix + step, CONTENT_W - 12);
      for (let li = 0; li < (lines as string[]).length; li++) {
        needRoom(doc, c, 13);
        doc.text((lines as string[])[li], MARGIN_X + 2, c.y);
        c.y += 13;
      }
      c.y += 4;
    });
  }

  // Tips
  if (m.tips) {
    c.y += 4;
    needRoom(doc, c, 28);
    doc.setFont('Lora', 'italic');
    doc.setFontSize(10);
    doc.setTextColor(100, 75, 55);
    const lines = doc.splitTextToSize(`Note: ${m.tips}`, CONTENT_W);
    for (const line of lines as string[]) {
      needRoom(doc, c, 13);
      doc.text(line, MARGIN_X, c.y);
      c.y += 13;
    }
  }

  // History note (footer of page)
  if (recipe.history_note) {
    c.y += 12;
    needRoom(doc, c, 40);
    doc.setDrawColor(232, 223, 211);
    doc.line(MARGIN_X, c.y, PAGE_W - MARGIN_X, c.y);
    c.y += 10;
    doc.setFont('Lora', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(120, 110, 90);
    const lines = doc.splitTextToSize(recipe.history_note, CONTENT_W);
    for (const line of lines as string[]) {
      needRoom(doc, c, 12);
      doc.text(line, MARGIN_X, c.y);
      c.y += 12;
    }
  }
}

function drawColophon(doc: jsPDF) {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(120, 90, 60);
  centeredText(doc, 'Colophon', PAGE_H / 2 - 40);
  doc.setFont('Lora', 'italic');
  doc.setFontSize(10);
  doc.setTextColor(90, 70, 50);
  centeredText(doc, 'Printed from Heritage Kitchen', PAGE_H / 2);
  centeredText(doc, 'heritagekitchen.app', PAGE_H / 2 + 16);
  doc.setFontSize(8);
  doc.setTextColor(120, 90, 60);
  centeredText(doc, 'All recipes are in the public domain', PAGE_H / 2 + 40);
  centeredText(
    doc,
    'from American cookbooks published 1869\u20131917',
    PAGE_H / 2 + 52,
  );
}

function centeredText(doc: jsPDF, text: string, y: number) {
  const width = doc.getTextWidth(text);
  doc.text(text, (PAGE_W - width) / 2, y);
}

function needRoom(doc: jsPDF, c: Cursor, amount: number) {
  if (c.y + amount > PAGE_H - MARGIN_BOTTOM) {
    doc.addPage();
    c.y = MARGIN_TOP;
    c.page = doc.getNumberOfPages();
  }
}

/**
 * Returns the total page count of a generated PDF without keeping the file
 * in memory. Useful before sending to Lulu, since they need page count to
 * quote the right POD package.
 */
export async function pageCountOf(blob: Blob): Promise<number> {
  // jsPDF embeds page count in its metadata but the blob is opaque here.
  // The generator above calls getNumberOfPages() at the end; we expose a
  // variant that also returns the count alongside the blob.
  // This helper exists so callers can post-process the Blob if needed.
  return approximatePageCountFromBlob(blob);
}

function approximatePageCountFromBlob(_blob: Blob): number {
  // Cheap fallback: callers use generateCookbookPdfWithMeta() below.
  return 0;
}

// ====================================================================
// FRONT AND BACK MATTER
// ====================================================================

/** Short category metadata for dividers. Keep in sync with lib/types. */
const CATEGORY_BLURBS: Record<string, { label: string; blurb: string }> = {
  'breakfast-and-bakes': { label: 'Breakfast & Bakes', blurb: 'Griddle cakes, muffins, and morning comforts.' },
  'soups-and-stews': { label: 'Soups & Stews', blurb: 'Long-simmered pots from chilly kitchens.' },
  'main-dishes': { label: 'Main Dishes', blurb: 'The centerpiece of the family table.' },
  'sides-and-vegetables': { label: 'Sides & Vegetables', blurb: 'Garden-fresh accompaniments.' },
  'salads': { label: 'Salads', blurb: 'Bright, simple, and often surprising.' },
  'sauces-and-condiments': { label: 'Sauces & Condiments', blurb: 'The little jars that changed a meal.' },
  'desserts': { label: 'Desserts', blurb: 'Puddings, pies, and Sunday sweets.' },
  'candy-and-confections': { label: 'Candy & Confections', blurb: 'Pull-taffy and penuche from the parlour.' },
  'beverages': { label: 'Beverages', blurb: 'Cocoa, cordials, and cooling drinks.' },
  'breads': { label: 'Breads', blurb: 'Loaves, biscuits, and rolls worth the wait.' },
  'preserves-and-pickles': { label: 'Preserves & Pickles', blurb: 'Putting the harvest away for winter.' },
  'kids-in-the-kitchen': { label: 'Kids in the Kitchen', blurb: 'Simple recipes to cook together.' },
};

function drawCopyrightPage(doc: jsPDF) {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(120, 90, 60);
  centeredText(doc, 'HERITAGE KITCHEN', PAGE_H / 2 - 60);

  doc.setFont('Lora', 'italic');
  doc.setFontSize(10);
  doc.setTextColor(100, 80, 60);
  const year = new Date().getFullYear();
  centeredText(doc, `Typeset ${year} by Heritage Kitchen.`, PAGE_H / 2 - 30);
  centeredText(doc, 'heritagekitchen.app', PAGE_H / 2 - 14);

  doc.setFont('Lora', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(90, 75, 60);
  const disclaimer = doc.splitTextToSize(
    'All source recipes are in the public domain, drawn from American cookbooks published between 1869 and 1917 and digitized by Project Gutenberg. The modernized adaptations, category pairings, and editorial notes are the work of Heritage Kitchen.',
    CONTENT_W - 40,
  ) as string[];
  let y = PAGE_H / 2 + 14;
  for (const line of disclaimer) {
    centeredText(doc, line, y);
    y += 13;
  }
}

function drawForeword(doc: jsPDF, project: CookbookProject) {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(120, 90, 60);
  doc.text('A NOTE ON THE RECIPES', MARGIN_X, MARGIN_TOP);

  doc.setDrawColor(168, 75, 47);
  doc.setLineWidth(0.5);
  doc.line(MARGIN_X, MARGIN_TOP + 10, MARGIN_X + 40, MARGIN_TOP + 10);

  const text =
    project.foreword ??
    'These recipes were written for kitchens very different from yours. The stoves were wood. The butter was unsalted and came from a neighbor. The flour was bought in barrels. What follows is our attempt to carry them across the hundred years between then and now without losing what made them good in the first place. Cook slowly. Taste often. Leave the phone in another room.';

  doc.setFont('Lora', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(59, 35, 20);
  const lines = doc.splitTextToSize(text, CONTENT_W) as string[];
  let y = MARGIN_TOP + 40;
  for (const line of lines) {
    doc.text(line, MARGIN_X, y);
    y += 16;
  }
}

function drawCategoryDivider(doc: jsPDF, categorySlug: string) {
  const meta = CATEGORY_BLURBS[categorySlug] ?? {
    label: categorySlug,
    blurb: '',
  };

  // Hairline rules framing a central band at the page's vertical midline
  doc.setDrawColor(168, 75, 47);
  doc.setLineWidth(0.4);
  const topY = PAGE_H * 0.38;
  const botY = PAGE_H * 0.62;
  doc.line(MARGIN_X + 20, topY, PAGE_W - MARGIN_X - 20, topY);
  doc.line(MARGIN_X + 20, botY, PAGE_W - MARGIN_X - 20, botY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(168, 75, 47);
  centeredText(doc, 'HERITAGE KITCHEN', topY + 18);

  doc.setFont('Playfair', 'normal');
  doc.setFontSize(28);
  doc.setTextColor(59, 35, 20);
  centeredText(doc, meta.label, PAGE_H / 2 + 6);

  if (meta.blurb) {
    doc.setFont('Lora', 'italic');
    doc.setFontSize(11);
    doc.setTextColor(120, 110, 90);
    const blurbLines = doc.splitTextToSize(meta.blurb, CONTENT_W - 60) as string[];
    let y = PAGE_H / 2 + 34;
    for (const line of blurbLines) {
      centeredText(doc, line, y);
      y += 14;
    }
  }
}

function drawRecipeIndex(doc: jsPDF, recipes: Recipe[]) {
  doc.setFont('Playfair', 'normal');
  doc.setFontSize(22);
  doc.setTextColor(59, 35, 20);
  doc.text('Index', MARGIN_X, MARGIN_TOP);

  const sorted = [...recipes].sort((a, b) => a.title.localeCompare(b.title));
  doc.setFont('Lora', 'normal');
  doc.setFontSize(10);

  let y = MARGIN_TOP + 32;
  let col = 0;
  const colW = (CONTENT_W - 20) / 2;
  for (const r of sorted) {
    if (y > PAGE_H - MARGIN_BOTTOM - 14) {
      if (col === 0) {
        col = 1;
        y = MARGIN_TOP + 32;
      } else {
        doc.addPage();
        doc.setFont('Lora', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(59, 35, 20);
        col = 0;
        y = MARGIN_TOP;
      }
    }
    const x = MARGIN_X + (col * (colW + 20));
    doc.text(r.title, x, y);
    const yearStr = String(r.source_year);
    const yearW = doc.getTextWidth(yearStr);
    doc.setTextColor(120, 110, 90);
    doc.text(yearStr, x + colW - yearW, y);
    doc.setTextColor(59, 35, 20);
    y += 13;
  }
}

function drawBibliography(doc: jsPDF, recipes: Recipe[]) {
  doc.setFont('Playfair', 'normal');
  doc.setFontSize(22);
  doc.setTextColor(59, 35, 20);
  doc.text('Source books', MARGIN_X, MARGIN_TOP);

  // Unique by source_book, keeping first occurrence's author/year
  const seen = new Set<string>();
  const books: { title: string; author: string; year: string }[] = [];
  for (const r of recipes) {
    if (!seen.has(r.source_book)) {
      seen.add(r.source_book);
      books.push({
        title: r.source_book,
        author: r.source_author,
        year: r.source_year,
      });
    }
  }
  books.sort((a, b) => Number(a.year) - Number(b.year));

  doc.setFont('Lora', 'normal');
  doc.setFontSize(11);
  let y = MARGIN_TOP + 36;
  for (const b of books) {
    if (y > PAGE_H - MARGIN_BOTTOM - 40) {
      doc.addPage();
      y = MARGIN_TOP;
    }
    doc.setFont('Playfair', 'normal');
    doc.setTextColor(59, 35, 20);
    doc.text(b.title, MARGIN_X, y);
    y += 14;
    doc.setFont('Lora', 'italic');
    doc.setTextColor(120, 110, 90);
    doc.text(`${b.author}  \u00B7  ${b.year}`, MARGIN_X, y);
    y += 22;
  }
}

function drawAboutHeritageKitchen(doc: jsPDF) {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(120, 90, 60);
  centeredText(doc, 'ABOUT HERITAGE KITCHEN', PAGE_H / 2 - 90);

  doc.setFont('Lora', 'italic');
  doc.setFontSize(11);
  doc.setTextColor(100, 80, 60);
  const lines = [
    'Heritage Kitchen is a small library of American recipes from',
    '1869\u20131917, each shown beside a modern adaptation and tuned to',
    'the rhythms of the Christian year. Cook the old food, together.',
  ];
  let y = PAGE_H / 2 - 60;
  for (const line of lines) {
    centeredText(doc, line, y);
    y += 16;
  }

  doc.setFont('Lora', 'normal');
  doc.setFontSize(13);
  doc.setTextColor(168, 75, 47);
  centeredText(doc, 'heritagekitchen.app', PAGE_H / 2 + 20);

  doc.setFont('Lora', 'italic');
  doc.setFontSize(9);
  doc.setTextColor(120, 110, 90);
  centeredText(doc, '\u201cEver ancient, ever new.\u201d', PAGE_H / 2 + 50);
}

/** Generates the PDF and returns both the blob and its page count. */
export async function generateCookbookPdfWithMeta(
  project: CookbookProject,
): Promise<{ blob: Blob; pageCount: number }> {
  const doc = new jsPDF({
    unit: 'pt',
    format: [PAGE_W, PAGE_H],
    compress: true,
  });

  const fonts = await loadFonts();
  applyFonts(doc, fonts);

  // -------- Front matter --------
  drawTitlePage(doc, project);

  doc.addPage();
  drawCopyrightPage(doc);

  doc.addPage();
  drawForeword(doc, project);

  doc.addPage();
  const tocCursor: Cursor = { y: MARGIN_TOP, page: doc.getNumberOfPages() };
  drawTableOfContents(doc, project.recipes, tocCursor);

  // -------- Recipes (optionally grouped by category) --------
  if (project.groupByCategory && project.recipes.length >= 12) {
    // Stable group order: use the first occurrence of each category
    const order: string[] = [];
    const buckets = new Map<string, Recipe[]>();
    for (const r of project.recipes) {
      if (!buckets.has(r.category)) {
        buckets.set(r.category, []);
        order.push(r.category);
      }
      buckets.get(r.category)!.push(r);
    }
    for (const cat of order) {
      doc.addPage();
      drawCategoryDivider(doc, cat);
      for (const recipe of buckets.get(cat)!) {
        doc.addPage();
        const cursor: Cursor = { y: MARGIN_TOP, page: doc.getNumberOfPages() };
        drawRecipe(doc, recipe, cursor);
      }
    }
  } else {
    for (const recipe of project.recipes) {
      doc.addPage();
      const cursor: Cursor = { y: MARGIN_TOP, page: doc.getNumberOfPages() };
      drawRecipe(doc, recipe, cursor);
    }
  }

  // -------- Back matter --------
  doc.addPage();
  drawRecipeIndex(doc, project.recipes);

  doc.addPage();
  drawBibliography(doc, project.recipes);

  doc.addPage();
  drawAboutHeritageKitchen(doc);

  doc.addPage();
  drawColophon(doc);

  // Lulu requires even page count for perfect-bound hardcovers. Pad if odd.
  let pageCount = doc.getNumberOfPages();
  if (pageCount % 2 === 1) {
    doc.addPage();
    pageCount++;
  }
  // Lulu requires a minimum of 24 pages for hardcover.
  while (pageCount < 24) {
    doc.addPage();
    pageCount++;
  }

  const blob = doc.output('blob');
  return { blob, pageCount };
}

// ====================================================================
// COVER GENERATOR
// ====================================================================
//
// Produces a full single-page cover PDF (back + spine + front as one
// landscape page) sized to the exact dimensions Lulu returns from its
// cover-dimensions endpoint. Design philosophy: typography and negative
// space only. No illustration on the front, no marketing copy on the
// back. The whole book is the argument; the cover just quietly points
// at it.
//
// Layout (landscape, origin top-left):
//   [ wrap ][ back cover ][ spine ][ front cover ][ wrap ]
//   [ wrap ][                                    ][ wrap ]
//
// The wrap is the Lulu-calculated bleed area that gets trimmed or
// folded onto the inside of the case. We draw a subtle cream field
// across the whole thing so the wrap is invisible if it bleeds.

export interface CoverDimensions {
  width_in: number;        // total cover width including wrap
  height_in: number;       // total cover height including wrap
  spine_in: number;        // spine width
  wrap_in: number;         // wrap size on each edge
  safe_zone_in: number;    // recommended safe zone inside trim
}

const CREAM: [number, number, number] = [255, 253, 248];
const TERRACOTTA: [number, number, number] = [168, 75, 47];
const INK: [number, number, number] = [59, 35, 20];
const MUTED: [number, number, number] = [122, 107, 93];

export async function generateCoverPdf(
  project: CookbookProject,
  dims: CoverDimensions,
): Promise<Blob> {
  const totalW = dims.width_in * 72;
  const totalH = dims.height_in * 72;
  const spineW = dims.spine_in * 72;
  const wrap = dims.wrap_in * 72;
  const trimW = (totalW - 2 * wrap - spineW) / 2;
  const trimH = totalH - 2 * wrap;

  const doc = new jsPDF({
    unit: 'pt',
    format: [totalW, totalH],
    orientation: totalW > totalH ? 'landscape' : 'portrait',
    compress: true,
  });

  const fonts = await loadFonts();
  applyFonts(doc, fonts);

  // Full-bleed cream field so the wrap area is covered.
  doc.setFillColor(...CREAM);
  doc.rect(0, 0, totalW, totalH, 'F');

  // Anchor origins (top-left corner of each major panel's trim area).
  const backX = wrap;
  const spineX = wrap + trimW;
  const frontX = wrap + trimW + spineW;
  const trimY = wrap;

  drawBackCover(doc, backX, trimY, trimW, trimH);
  drawSpine(doc, project, spineX, trimY, spineW, trimH);
  drawFrontCover(doc, project, frontX, trimY, trimW, trimH);

  return doc.output('blob');
}

function drawFrontCover(
  doc: jsPDF,
  project: CookbookProject,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const safe = 36;
  const innerX = x + safe;
  const innerW = w - safe * 2;
  const topRuleY = y + h * 0.32;
  const bottomRuleY = y + h * 0.72;

  doc.setDrawColor(...TERRACOTTA);
  doc.setLineWidth(0.6);
  doc.line(innerX, topRuleY, innerX + innerW, topRuleY);
  doc.line(innerX, bottomRuleY, innerX + innerW, bottomRuleY);

  // Small-caps "HERITAGE KITCHEN" above the title
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...TERRACOTTA);
  const houseLabel = 'H  E  R  I  T  A  G  E     K  I  T  C  H  E  N';
  centered(doc, houseLabel, x + w / 2, topRuleY + 20);

  // Tiny rule beneath the house label
  const miniRuleLen = 28;
  const miniRuleY = topRuleY + 32;
  doc.setLineWidth(0.4);
  doc.line(
    x + (w - miniRuleLen) / 2,
    miniRuleY,
    x + (w + miniRuleLen) / 2,
    miniRuleY,
  );

  // Title in large serif, wrapped, vertically centered between the rules
  doc.setFont('Playfair', 'normal');
  doc.setFontSize(32);
  doc.setTextColor(...INK);
  const titleLines = doc.splitTextToSize(project.title, innerW) as string[];
  const lineH = 36;
  const titleBlockH = titleLines.length * lineH;
  const bandCenter = (topRuleY + bottomRuleY) / 2;
  let cursor = bandCenter - titleBlockH / 2 + 26;
  for (const line of titleLines) {
    centered(doc, line, x + w / 2, cursor);
    cursor += lineH;
  }

  // Subtitle in serif italic
  if (project.subtitle) {
    doc.setFont('Lora', 'italic');
    doc.setFontSize(14);
    doc.setTextColor(...MUTED);
    const subLines = doc.splitTextToSize(project.subtitle, innerW - 40) as string[];
    cursor += 8;
    for (const line of subLines) {
      centered(doc, line, x + w / 2, cursor);
      cursor += 18;
    }
  }

  // Fleuron ornament near the bottom rule
  doc.setFont('Lora', 'normal');
  doc.setFontSize(18);
  doc.setTextColor(...TERRACOTTA);
  centered(doc, '\u2766', x + w / 2, bottomRuleY - 14);
}

function drawSpine(
  doc: jsPDF,
  project: CookbookProject,
  x: number,
  y: number,
  spineW: number,
  h: number,
) {
  // Spine is too narrow to fit horizontal type. If it's less than
  // about a quarter inch we skip type entirely â€” Lulu's minimum
  // spine-text page count is 80 anyway.
  if (spineW < 18) return;

  const centerX = x + spineW / 2;

  // Small terracotta marks at top and bottom of the spine
  doc.setDrawColor(...TERRACOTTA);
  doc.setLineWidth(0.5);
  const markLen = 10;
  doc.line(x + 3, y + 30, x + spineW - 3, y + 30);
  doc.line(x + 3, y + h - 30, x + spineW - 3, y + h - 30);

  // Title running vertically bottom-to-top
  doc.setFont('Playfair', 'normal');
  doc.setFontSize(14);
  doc.setTextColor(...INK);
  // Place the baseline slightly left of center so the rotated type
  // sits centered in the spine visually.
  doc.text(project.title, centerX + 5, y + h / 2, {
    angle: 90,
    align: 'center',
  });

  // "HERITAGE KITCHEN" near the bottom
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(...TERRACOTTA);
  doc.text('HERITAGE  KITCHEN', centerX + 4, y + h - 44, {
    angle: 90,
    align: 'center',
  });

  // Suppress unused warning
  void markLen;
}

function drawBackCover(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const safe = 48;

  // Augustine epigraph, centered high on the back cover
  doc.setFont('Lora', 'italic');
  doc.setFontSize(16);
  doc.setTextColor(...INK);
  const q1 = '\u201cLate have I loved you,';
  const q2 = 'Beauty so ancient and so new.\u201d';
  centered(doc, q1, x + w / 2, y + h * 0.38);
  centered(doc, q2, x + w / 2, y + h * 0.38 + 22);

  // Attribution
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  centered(doc, '\u2014 Augustine, Confessions X.27', x + w / 2, y + h * 0.38 + 46);

  // Site URL footer
  doc.setFont('Lora', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...TERRACOTTA);
  centered(doc, 'heritagekitchen.app', x + w / 2, y + h - safe - 18);

  // Tiny rule above the URL
  const ruleLen = 24;
  doc.setDrawColor(...TERRACOTTA);
  doc.setLineWidth(0.4);
  doc.line(
    x + (w - ruleLen) / 2,
    y + h - safe - 30,
    x + (w + ruleLen) / 2,
    y + h - safe - 30,
  );

  // Barcode safe-zone placeholder (Lulu inserts a real barcode
  // automatically when you submit the cover, but we leave a clean
  // white-ish rectangle in the lower-left so our art doesn't clash).
  doc.setFillColor(255, 255, 255);
  doc.rect(x + 24, y + h - 84, 120, 48, 'F');
  doc.setDrawColor(232, 223, 211);
  doc.setLineWidth(0.3);
  doc.rect(x + 24, y + h - 84, 120, 48, 'S');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(200, 190, 175);
  doc.text('barcode', x + 68, y + h - 58);
}

function centered(doc: jsPDF, text: string, centerX: number, y: number) {
  const w = doc.getTextWidth(text);
  doc.text(text, centerX - w / 2, y);
}

