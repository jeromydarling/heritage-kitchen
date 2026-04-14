import { useEffect, useState } from 'react';
import type { Recipe } from '../lib/types';
import { requestRecipeImage } from '../lib/images';

interface Props {
  recipe: Recipe;
  className?: string;
  eager?: boolean;
}

/**
 * Displays the AI-generated illustration for a recipe. If the recipe does not
 * yet have an image_url, a vintage-styled placeholder is shown while a lazy
 * generation request is kicked off in the background (once per session).
 */
export default function RecipeImage({ recipe, className, eager }: Props) {
  const [url, setUrl] = useState<string | null>(recipe.image_url ?? null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (url || !eager) return;
    let cancelled = false;
    setLoading(true);
    requestRecipeImage(recipe)
      .then((generated) => {
        if (!cancelled && generated) setUrl(generated);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [recipe, url, eager]);

  if (url) {
    return <img src={url} alt={recipe.title} className={className} loading="lazy" />;
  }

  return <Placeholder title={recipe.title} loading={loading} className={className} />;
}

function Placeholder({
  title,
  loading,
  className,
}: {
  title: string;
  loading: boolean;
  className?: string;
}) {
  return (
    <div
      className={`flex items-center justify-center paper ${className ?? ''}`}
      role="img"
      aria-label={`Illustration coming soon for ${title}`}
    >
      <div className="flex flex-col items-center gap-2 px-6 text-center">
        <svg
          viewBox="0 0 48 48"
          className="h-10 w-10 text-terracotta/70"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="24" cy="24" r="18" />
          <path d="M10 28 L18 20 L26 26 L38 14" />
          <circle cx="32" cy="18" r="2" />
        </svg>
        <span className="font-serif text-xs italic text-muted">
          {loading ? 'Sketching the illustrationâ€¦' : 'Illustration coming soon'}
        </span>
      </div>
    </div>
  );
}
