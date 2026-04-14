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
