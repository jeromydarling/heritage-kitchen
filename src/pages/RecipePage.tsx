import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  getRecipe,
  getRandomRecipe,
  getRelatedEssays,
  getEntry,
} from '../lib/recipes';
import { CATEGORIES, type Recipe } from '../lib/types';
import TabSwitcher from '../components/TabSwitcher';
import RecipeImage from '../components/RecipeImage';
import DifficultyBadge from '../components/DifficultyBadge';
import RecipeActions from '../components/RecipeActions';

type Tab = 'original' | 'modern';

export default function RecipePage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [recipe, setRecipe] = useState<Recipe | undefined>();
  const [relatedEssays, setRelatedEssays] = useState<Recipe[]>([]);
  const [tab, setTab] = useState<Tab>('modern');
  const [checked, setChecked] = useState<Record<number, boolean>>({});

  useEffect(() => {
    setChecked({});
    setTab('modern');
    setRelatedEssays([]);
    (async () => {
      const r = await getRecipe(id);
      if (r) {
        setRecipe(r);
        setRelatedEssays(await getRelatedEssays(r));
        return;
      }
      // If the id resolves to an essay entry, bounce the user over to the
      // essay page instead of showing an empty "recipe not found" state.
      const entry = await getEntry(id);
      if (entry && entry.content_type === 'essay') {
        navigate(`/essay/${entry.id}`, { replace: true });
      }
    })();
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [id, navigate]);

  useEffect(() => {
    if (!recipe) return;
    // JSON-LD structured data for SEO
    const ld = {
      '@context': 'https://schema.org',
      '@type': 'Recipe',
      name: recipe.title,
      description: recipe.modern_recipe.description,
      recipeCategory: recipe.category,
      author: { '@type': 'Person', name: recipe.source_author },
      recipeYield: recipe.modern_recipe.servings,
      prepTime: recipe.modern_recipe.prep_time,
      cookTime: recipe.modern_recipe.cook_time,
      recipeIngredient: Array.isArray(recipe.modern_recipe.ingredients)
        ? recipe.modern_recipe.ingredients
        : recipe.modern_recipe.ingredients
          ? [recipe.modern_recipe.ingredients]
          : [],
      recipeInstructions: Array.isArray(recipe.modern_recipe.instructions)
        ? recipe.modern_recipe.instructions.map((s) => ({ '@type': 'HowToStep', text: s }))
        : [],
      image: recipe.image_url ?? undefined,
    };
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.text = JSON.stringify(ld);
    document.head.appendChild(script);
    const origTitle = document.title;
    document.title = `${recipe.title} — Heritage Kitchen`;
    return () => {
      script.remove();
      document.title = origTitle;
    };
  }, [recipe]);

  if (!recipe) {
    return <p className="text-muted">Loading…</p>;
  }

  const category = CATEGORIES.find((c) => c.slug === recipe.category);

  async function tryAnother() {
    const next = await getRandomRecipe(recipe!.category);
    if (next && next.id !== recipe!.id) navigate(`/recipe/${next.id}`);
  }

  return (
    <article className="space-y-8">
      <nav className="text-xs uppercase tracking-widest text-muted">
        <Link to="/">Home</Link> <span className="mx-1 text-rule">/</span>
        {category && (
          <>
            <Link to={`/category/${category.slug}`}>{category.label}</Link>
            <span className="mx-1 text-rule">/</span>
          </>
        )}
        <span>{recipe.title}</span>
      </nav>

      <header className="grid gap-6 sm:grid-cols-5">
        <div className="sm:col-span-2">
          <div className="aspect-[4/3] overflow-hidden rounded-2xl border border-rule bg-paper shadow-card">
            <RecipeImage recipe={recipe} className="h-full w-full object-cover" eager />
          </div>
        </div>
        <div className="sm:col-span-3">
          <p className="text-xs uppercase tracking-widest text-terracotta">
            {recipe.source_book} · {recipe.source_year}
          </p>
          <h1 className="mt-1 font-serif text-4xl leading-tight sm:text-5xl">{recipe.title}</h1>
          <p className="mt-2 text-sm text-muted">by {recipe.source_author}</p>

          {recipe.modern_recipe.description && (
            <p className="mt-4 text-lg leading-relaxed text-ink/90">
              {recipe.modern_recipe.description}
            </p>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <DifficultyBadge difficulty={recipe.difficulty} />
            {recipe.tags?.map((t) => (
              <span key={t} className="chip">
                {t}
              </span>
            ))}
          </div>

          <div className="mt-6">
            <TabSwitcher active={tab} onChange={setTab} />
          </div>
        </div>
      </header>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {tab === 'original' ? (
            <OriginalView recipe={recipe} />
          ) : (
            <ModernView recipe={recipe} checked={checked} setChecked={setChecked} />
          )}
        </div>

        <aside className="space-y-4">
          {recipe.history_note && (
            <div className="card p-5">
              <h3 className="font-serif text-lg">A bit of history</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{recipe.history_note}</p>
            </div>
          )}
          <div className="card p-5">
            <h3 className="font-serif text-lg">Source</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              {recipe.source_book}
              <br />
              {recipe.source_author}, {recipe.source_year}
            </p>
            <a
              href={recipe.source_url}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-block text-sm"
            >
              View on Project Gutenberg ↗
            </a>
          </div>
          <RecipeActions recipe={recipe} />

          {relatedEssays.length > 0 && (
            <div className="card p-5">
              <h3 className="font-serif text-lg">Read more</h3>
              <p className="mt-1 text-xs text-muted">
                Historical essays from the cookbooks
              </p>
              <ul className="mt-3 space-y-2">
                {relatedEssays.map((e) => (
                  <li key={e.id}>
                    <Link to={`/essay/${e.id}`} className="text-sm">
                      {e.title}
                    </Link>
                    <span className="ml-2 text-xs text-muted">
                      {e.source_year}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <button onClick={tryAnother} className="btn w-full justify-center">
            Try another {category?.label.toLowerCase() ?? 'recipe'} →
          </button>
        </aside>
      </div>
    </article>
  );
}

function OriginalView({ recipe }: { recipe: Recipe }) {
  return (
    <section
      role="tabpanel"
      aria-label="Original recipe text"
      className="paper rounded-2xl border border-rule p-6 shadow-card sm:p-10"
    >
      <p className="mb-4 font-serif text-xs uppercase tracking-[0.2em] text-terracotta">
        As written in {recipe.source_year}
      </p>
      <h2 className="font-serif text-2xl">{recipe.title}</h2>
      <p className="mt-1 font-serif italic text-muted">
        From {recipe.source_book} by {recipe.source_author}
      </p>
      <hr className="my-5 border-rule" />
      <pre className="whitespace-pre-wrap font-mono text-[0.95rem] leading-relaxed text-ink">
        {recipe.original_recipe}
      </pre>
    </section>
  );
}

function ModernView({
  recipe,
  checked,
  setChecked,
}: {
  recipe: Recipe;
  checked: Record<number, boolean>;
  setChecked: (v: Record<number, boolean>) => void;
}) {
  const { modern_recipe: m } = recipe;
  const ingredients = Array.isArray(m.ingredients) ? m.ingredients : m.ingredients ? [m.ingredients] : [];
  const instructions = Array.isArray(m.instructions)
    ? m.instructions
    : m.instructions
      ? [m.instructions]
      : [];

  // If ingredients look like a single long paragraph rather than a tidy list,
  // render it as prose instead of a broken bullet list.
  const asProse = ingredients.length === 1 && ingredients[0].length > 140;

  return (
    <section
      role="tabpanel"
      aria-label="Modern adaptation"
      className="card space-y-8 p-6 sm:p-10"
    >
      <div className="grid grid-cols-2 gap-4 rounded-xl bg-cream p-4 sm:grid-cols-4">
        <Stat label="Prep" value={m.prep_time} />
        <Stat label="Cook" value={m.cook_time} />
        <Stat label="Serves" value={m.servings} />
        <Stat label="Level" value={recipe.difficulty} />
      </div>

      <div>
        <h2 className="font-serif text-2xl">Ingredients</h2>
        {ingredients.length === 0 ? (
          <p className="mt-3 text-sm italic text-muted">
            No modern ingredient list available for this recipe yet.
          </p>
        ) : asProse ? (
          <p className="mt-3 leading-relaxed">{ingredients[0]}</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {ingredients.map((ing, i) => (
              <li key={i} className="flex items-start gap-3">
                <input
                  id={`ing-${i}`}
                  type="checkbox"
                  checked={!!checked[i]}
                  onChange={(e) => setChecked({ ...checked, [i]: e.target.checked })}
                  className="mt-1 h-4 w-4 rounded border-rule text-terracotta focus:ring-terracotta"
                />
                <label
                  htmlFor={`ing-${i}`}
                  className={checked[i] ? 'text-muted line-through' : ''}
                >
                  {ing}
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h2 className="font-serif text-2xl">Instructions</h2>
        {instructions.length === 0 ? (
          <p className="mt-3 text-sm italic text-muted">No modern instructions available yet.</p>
        ) : (
          <ol className="mt-3 space-y-4">
            {instructions.map((step, i) => (
              <li key={i} className="flex gap-4">
                <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-terracotta text-sm font-semibold text-cream">
                  {i + 1}
                </span>
                <p className="leading-relaxed">{step}</p>
              </li>
            ))}
          </ol>
        )}
      </div>

      {m.tips && (
        <div className="rounded-xl border border-terracotta/30 bg-terracotta/5 p-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-terracotta">Tip</p>
          <p className="mt-1 text-sm leading-relaxed">{m.tips}</p>
        </div>
      )}
    </section>
  );
}

function Stat({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <p className="text-[0.65rem] font-semibold uppercase tracking-widest text-muted">{label}</p>
      <p className="mt-0.5 font-serif text-base capitalize">{value || '—'}</p>
    </div>
  );
}
