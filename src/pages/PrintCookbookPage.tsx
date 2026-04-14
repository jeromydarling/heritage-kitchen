import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useUser } from '../lib/auth';
import { loadAllForIds } from '../lib/recipes';
import type { Recipe } from '../lib/types';

interface Project {
  id: string;
  title: string;
  subtitle: string | null;
  dedication: string | null;
  recipe_ids: string[];
}

/**
 * The print-optimized cookbook view. Designed to look clean when the
 * user invokes "Save as PDF" from the browser â€” US Letter, serif
 * typography, title page, table of contents, one recipe per section.
 *
 * The page uses the site's print stylesheet (hides header/footer/nav)
 * and adds a few print-specific utilities for page breaks.
 */
export default function PrintCookbookPage() {
  const { id = '' } = useParams();
  const user = useUser();
  const [project, setProject] = useState<Project | null>(null);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!user || !supabase) {
        setLoading(false);
        return;
      }
      const { data: proj } = await supabase
        .from('cookbook_projects')
        .select('*')
        .eq('id', id)
        .eq('user_id', user.id)
        .maybeSingle();
      if (cancelled || !proj) {
        setLoading(false);
        return;
      }
      setProject(proj as Project);
      const list = await loadAllForIds((proj as Project).recipe_ids);
      // Preserve the order from recipe_ids
      const byId = Object.fromEntries(list.map((r) => [r.id, r]));
      const ordered = (proj as Project).recipe_ids
        .map((rid) => byId[rid])
        .filter((r): r is Recipe => !!r);
      if (!cancelled) {
        setRecipes(ordered);
        setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [id, user]);

  if (loading) return <p className="text-muted">Loadingâ€¦</p>;
  if (!project) {
    return (
      <p className="text-muted">
        That cookbook project can't be found. It may have been deleted.
      </p>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex justify-end gap-2 py-4 no-print">
        <button onClick={() => window.print()} className="btn-primary">
          Save as PDF (via print)
        </button>
      </div>

      {/* Title page */}
      <section className="mb-16 flex min-h-[90vh] flex-col items-center justify-center text-center print:min-h-screen">
        <p className="font-serif text-sm italic text-muted">
          &ldquo;Ever ancient, ever new.&rdquo;
        </p>
        <h1 className="mt-10 font-serif text-5xl leading-tight sm:text-6xl">
          {project.title}
        </h1>
        {project.subtitle && (
          <p className="mt-4 font-serif text-xl italic text-muted">
            {project.subtitle}
          </p>
        )}
        {project.dedication && (
          <p className="mt-20 max-w-md whitespace-pre-wrap font-serif text-base italic text-muted">
            {project.dedication}
          </p>
        )}
        <p className="mt-auto pt-24 text-xs uppercase tracking-widest text-muted">
          Heritage Kitchen
        </p>
      </section>

      {/* Table of contents */}
      <section className="mb-16 break-after-page">
        <h2 className="font-serif text-3xl">Contents</h2>
        <ol className="mt-6 space-y-2">
          {recipes.map((r, i) => (
            <li key={r.id} className="flex items-baseline justify-between gap-3 text-base">
              <span className="font-serif">
                <span className="text-muted">{i + 1}.</span> {r.title}
              </span>
              <span className="text-sm text-muted">
                {r.source_book}, {r.source_year}
              </span>
            </li>
          ))}
        </ol>
      </section>

      {/* Recipes */}
      {recipes.map((r) => (
        <PrintRecipe key={r.id} recipe={r} />
      ))}
    </div>
  );
}

function PrintRecipe({ recipe }: { recipe: Recipe }) {
  const m = recipe.modern_recipe;
  const ingredients = Array.isArray(m.ingredients) ? m.ingredients : m.ingredients ? [m.ingredients] : [];
  const instructions = Array.isArray(m.instructions) ? m.instructions : m.instructions ? [m.instructions] : [];

  return (
    <article className="mb-16 break-before-page break-after-page">
      <p className="text-xs uppercase tracking-widest text-muted">
        {recipe.source_book} Â· {recipe.source_year}
      </p>
      <h2 className="mt-1 font-serif text-4xl">{recipe.title}</h2>
      {m.description && (
        <p className="mt-3 text-lg leading-relaxed">{m.description}</p>
      )}

      <div className="mt-6 grid grid-cols-3 gap-4 text-sm">
        {m.prep_time && (
          <div>
            <p className="text-[0.65rem] font-semibold uppercase tracking-widest text-muted">Prep</p>
            <p className="font-serif">{m.prep_time}</p>
          </div>
        )}
        {m.cook_time && (
          <div>
            <p className="text-[0.65rem] font-semibold uppercase tracking-widest text-muted">Cook</p>
            <p className="font-serif">{m.cook_time}</p>
          </div>
        )}
        {m.servings && (
          <div>
            <p className="text-[0.65rem] font-semibold uppercase tracking-widest text-muted">Serves</p>
            <p className="font-serif">{m.servings}</p>
          </div>
        )}
      </div>

      {ingredients.length > 0 && (
        <div className="mt-6">
          <h3 className="font-serif text-xl">Ingredients</h3>
          <ul className="mt-2 space-y-1 text-base">
            {ingredients.map((ing, i) => (
              <li key={i}>&middot; {ing}</li>
            ))}
          </ul>
        </div>
      )}

      {instructions.length > 0 && (
        <div className="mt-6">
          <h3 className="font-serif text-xl">Instructions</h3>
          <ol className="mt-2 space-y-2 text-base">
            {instructions.map((step, i) => (
              <li key={i}>
                <span className="mr-2 font-serif font-semibold text-terracotta">{i + 1}.</span>
                {step}
              </li>
            ))}
          </ol>
        </div>
      )}

      {m.tips && (
        <div className="mt-6">
          <h3 className="font-serif text-lg italic">A note</h3>
          <p className="mt-1 text-base">{m.tips}</p>
        </div>
      )}

      {recipe.history_note && (
        <div className="mt-6 border-t border-rule pt-4">
          <p className="font-serif text-sm italic leading-relaxed text-muted">
            {recipe.history_note}
          </p>
        </div>
      )}
    </article>
  );
}
