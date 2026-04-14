import { useRecipeAdoption } from '../lib/sponsors';

/**
 * A small museum-donor-style credit that appears on recipe pages whose
 * page has been adopted by a sponsor. Deliberately quiet: no logos, no
 * colored background, no buttons. Just a line of italic text with a
 * plain link. If the recipe has no active adoption, this component
 * renders nothing.
 */
export default function AdoptionCredit({ recipeId }: { recipeId: string }) {
  const adoption = useRecipeAdoption(recipeId);
  if (!adoption || !adoption.sponsor_slug) return null;
  const sponsor = adoption.sponsor ?? null;
  const text =
    adoption.credit_text ??
    (sponsor?.description ??
      `This recipe's page is adopted by ${sponsor?.name ?? 'a friend of Heritage Kitchen'}.`);
  const name = sponsor?.name;
  const href = sponsor?.url;

  return (
    <section className="border-t border-rule pt-4">
      <p className="font-serif text-[0.72rem] uppercase tracking-[0.2em] text-muted">
        Adopted by
      </p>
      <p className="mt-1 text-sm italic leading-relaxed text-muted">
        {text}
      </p>
      {name && href && (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="mt-1 inline-block text-xs"
        >
          {name} &rarr;
        </a>
      )}
    </section>
  );
}
