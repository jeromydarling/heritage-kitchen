export type Difficulty = 'easy' | 'moderate' | 'involved';

export type CategorySlug =
  | 'breakfast-and-bakes'
  | 'soups-and-stews'
  | 'main-dishes'
  | 'sides-and-vegetables'
  | 'salads'
  | 'sauces-and-condiments'
  | 'desserts'
  | 'candy-and-confections'
  | 'beverages'
  | 'breads'
  | 'preserves-and-pickles'
  | 'kids-in-the-kitchen';

export interface ModernRecipe {
  description?: string;
  prep_time?: string;
  cook_time?: string;
  servings?: string;
  ingredients?: string[] | string;
  instructions?: string[] | string;
  tips?: string;
}

export interface Recipe {
  id: string;
  title: string;
  source_book: string;
  source_author: string;
  source_year: string;
  source_url: string;
  category: CategorySlug | string;
  original_recipe: string;
  modern_recipe: ModernRecipe;
  history_note?: string;
  tags?: string[];
  difficulty: Difficulty;
  image_prompt: string;
  image_url?: string | null;
}

export interface CategoryMeta {
  slug: CategorySlug;
  label: string;
  blurb: string;
}

export const CATEGORIES: CategoryMeta[] = [
  { slug: 'breakfast-and-bakes', label: 'Breakfast & Bakes', blurb: 'Griddle cakes, muffins, and morning comforts.' },
  { slug: 'soups-and-stews', label: 'Soups & Stews', blurb: 'Long-simmered pots from chilly kitchens.' },
  { slug: 'main-dishes', label: 'Main Dishes', blurb: 'The centerpiece of the family table.' },
  { slug: 'sides-and-vegetables', label: 'Sides & Vegetables', blurb: 'Garden-fresh accompaniments.' },
  { slug: 'salads', label: 'Salads', blurb: 'Bright, simple, and often surprising.' },
  { slug: 'sauces-and-condiments', label: 'Sauces & Condiments', blurb: 'The little jars that changed a meal.' },
  { slug: 'desserts', label: 'Desserts', blurb: 'Puddings, pies, and Sunday sweets.' },
  { slug: 'candy-and-confections', label: 'Candy & Confections', blurb: 'Pull-taffy and penuche from the parlour.' },
  { slug: 'beverages', label: 'Beverages', blurb: 'Cocoa, cordials, and cooling drinks.' },
  { slug: 'breads', label: 'Breads', blurb: 'Loaves, biscuits, and rolls worth the wait.' },
  { slug: 'preserves-and-pickles', label: 'Preserves & Pickles', blurb: 'Putting the harvest away for winter.' },
  { slug: 'kids-in-the-kitchen', label: 'Kids in the Kitchen', blurb: 'Simple recipes to cook together.' },
];

export const SOURCE_BOOKS = [
  {
    title: 'The Boston Cooking-School Cook Book',
    author: 'Fannie Merritt Farmer',
    year: '1896',
    gutenberg: 'https://www.gutenberg.org/ebooks/65061',
  },
  {
    title: 'Mrs. Lincolnâ€™s Boston Cook Book',
    author: 'Mary J. Lincoln',
    year: '1884',
    gutenberg: 'https://www.gutenberg.org/ebooks/60107',
  },
  {
    title: 'The Settlement Cook Book',
    author: 'Mrs. Simon Kander',
    year: '1901',
    gutenberg: 'https://www.gutenberg.org/ebooks/27291',
  },
  {
    title: 'Miss Parloaâ€™s New Cook Book',
    author: 'Maria Parloa',
    year: '1887',
    gutenberg: 'https://www.gutenberg.org/ebooks/43772',
  },
  {
    title: "The American Woman's Home",
    author: 'Catharine Beecher & Harriet Beecher Stowe',
    year: '1869',
    gutenberg: 'https://www.gutenberg.org/ebooks/6598',
  },
];
