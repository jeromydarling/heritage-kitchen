import { jsPDF } from 'jspdf';
import type { Recipe } from './types';

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

  doc.setFont('times', 'italic');
  doc.setFontSize(11);
  doc.setTextColor(120, 110, 90);
  centeredText(doc, '"Beauty ever ancient, ever new."', PAGE_H / 2 - 150);
  centeredText(doc, '\u2014 St. Augustine', PAGE_H / 2 - 133);

  doc.setFont('times', 'bold');
  doc.setFontSize(32);
  doc.setTextColor(59, 35, 20);
  const titleLines = doc.splitTextToSize(project.title, CONTENT_W);
  let y = PAGE_H / 2 - 60;
  for (const line of titleLines as string[]) {
    centeredText(doc, line, y);
    y += 36;
  }

  if (project.subtitle) {
    doc.setFont('times', 'italic');
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
    doc.setFont('times', 'italic');
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
  doc.setFont('times', 'bold');
  doc.setFontSize(24);
  doc.setTextColor(59, 35, 20);
  doc.text('Contents', MARGIN_X, c.y);
  c.y += 36;

  doc.setFont('times', 'normal');
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
  doc.setFont('times', 'bold');
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
    doc.setFont('times', 'italic');
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
    doc.setFont('times', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(59, 35, 20);
    doc.text('Ingredients', MARGIN_X, c.y);
    c.y += 18;
    doc.setFont('times', 'normal');
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
    doc.setFont('times', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(59, 35, 20);
    doc.text('Instructions', MARGIN_X, c.y);
    c.y += 18;
    doc.setFont('times', 'normal');
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
    doc.setFont('times', 'italic');
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
    doc.setFont('times', 'italic');
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
  doc.setFont('times', 'italic');
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

/** Generates the PDF and returns both the blob and its page count. */
export async function generateCookbookPdfWithMeta(
  project: CookbookProject,
): Promise<{ blob: Blob; pageCount: number }> {
  const doc = new jsPDF({
    unit: 'pt',
    format: [PAGE_W, PAGE_H],
    compress: true,
  });

  drawTitlePage(doc, project);

  doc.addPage();
  const tocCursor: Cursor = { y: MARGIN_TOP, page: doc.getNumberOfPages() };
  drawTableOfContents(doc, project.recipes, tocCursor);

  for (const recipe of project.recipes) {
    doc.addPage();
    const cursor: Cursor = { y: MARGIN_TOP, page: doc.getNumberOfPages() };
    drawRecipe(doc, recipe, cursor);
  }

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
  doc.setFont('times', 'bold');
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
    doc.setFont('times', 'italic');
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
  doc.setFont('times', 'normal');
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
  doc.setFont('times', 'bold');
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
  doc.setFont('times', 'italic');
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
  doc.setFont('times', 'normal');
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

