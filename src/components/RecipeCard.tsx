import { Link } from 'react-router-dom';
import type { Recipe } from '../lib/types';
import RecipeImage from './RecipeImage';
import DifficultyBadge from './DifficultyBadge';

export default function RecipeCard({ recipe }: { recipe: Recipe }) {
  return (
    <Link
      to={`/recipe/${recipe.id}`}
      className="card group flex flex-col overflow-hidden !no-underline !text-ink transition hover:-translate-y-0.5 hover:border-terracotta"
    >
      <div className="aspect-[4/3] w-full overflow-hidden border-b border-rule bg-paper">
        <RecipeImage recipe={recipe} className="h-full w-full object-cover transition group-hover:scale-[1.02]" />
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="font-serif text-lg leading-snug">{recipe.title}</h3>
        <p className="text-xs text-muted">
          {recipe.source_book} Â· {recipe.source_year}
        </p>
        <div className="mt-auto flex items-center justify-between pt-2">
          <DifficultyBadge difficulty={recipe.difficulty} />
          {recipe.tags?.[0] && <span className="chip">{recipe.tags[0]}</span>}
        </div>
      </div>
    </Link>
  );
}
