import { Link } from 'react-router-dom';
import type { Recipe } from '../lib/types';
import RecipeImage from './RecipeImage';
import DifficultyBadge from './DifficultyBadge';
import EssayBadge from './EssayBadge';

/**
 * Renders a clickable card for either a recipe or an essay. When the entry
 * is an essay we route to /essay/:id and show the essay badge in place of
 * the difficulty chip, since essays have no difficulty rating.
 */
export default function RecipeCard({ recipe }: { recipe: Recipe }) {
  const isEssay = recipe.content_type === 'essay';
  const href = isEssay ? `/essay/${recipe.id}` : `/recipe/${recipe.id}`;
  return (
    <Link
      to={href}
      className="card group flex flex-col overflow-hidden !no-underline !text-ink transition hover:-translate-y-0.5 hover:border-terracotta"
    >
      <div className="aspect-[4/3] w-full overflow-hidden border-b border-rule bg-paper">
        <RecipeImage
          recipe={recipe}
          className="h-full w-full object-cover transition group-hover:scale-[1.02]"
        />
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="font-serif text-lg leading-snug">{recipe.title}</h3>
        <p className="text-xs text-muted">
          {recipe.source_book} · {recipe.source_year}
        </p>
        <div className="mt-auto flex items-center justify-between pt-2">
          {isEssay ? <EssayBadge /> : <DifficultyBadge difficulty={recipe.difficulty} />}
          {!isEssay && recipe.tags?.[0] && <span className="chip">{recipe.tags[0]}</span>}
        </div>
      </div>
    </Link>
  );
}
