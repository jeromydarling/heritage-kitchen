import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useUser } from '../lib/auth';

const STORAGE_KEY = 'hk.onboarded';

/**
 * A small 3-step welcome modal that appears the first time a signed-in
 * user lands on any page. Dismissal is persisted to localStorage so it
 * never nags a returning user. The modal only fires for users who
 * actually have an auth session â€” signed-out browsers never see it.
 */
export default function OnboardingTour() {
  const user = useUser();
  const [step, setStep] = useState(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    if (typeof localStorage === 'undefined') return;
    if (localStorage.getItem(STORAGE_KEY) === 'done') return;
    setOpen(true);
    setStep(0);
  }, [user]);

  function finish() {
    try {
      localStorage.setItem(STORAGE_KEY, 'done');
    } catch {
      // ignore
    }
    setOpen(false);
  }

  if (!open || !user) return null;

  const steps: Array<{ title: string; body: React.ReactNode }> = [
    {
      title: 'Welcome to the kitchen',
      body: (
        <>
          <p>
            Heritage Kitchen is a growing library of American cookbook
            recipes from 1869&ndash;1917 &mdash; the food our
            great-grandmothers cooked, adapted so you can cook it too.
          </p>
          <p className="mt-3">
            We believe in Augustine's phrase <em>ever ancient, ever new</em>.
            Everything in here is built to make the old food easy to cook
            with the people you love.
          </p>
        </>
      ),
    },
    {
      title: 'Make it yours',
      body: (
        <>
          <p>
            <strong>Save recipes</strong> you want to come back to, and
            keep <strong>private notes</strong> on them. When you cook
            something, log it with a star rating and a line about how it
            went. Next year, when the same season comes around, the site
            will remind you what you made and ask if you want to make it
            again.
          </p>
          <p className="mt-3 text-xs text-muted">
            That annual memory is the heart of the site. A year from now
            you'll have a little book of your own.
          </p>
        </>
      ),
    },
    {
      title: 'Plan the week, share the kitchen',
      body: (
        <>
          <p>
            Your <Link to="/plan">meal plan</Link> is a week view. Click a
            day, pick a recipe, and it lands there &mdash; with the
            liturgical day of that date already labeled for you. Then click{' '}
            <em>Generate from this week's plan</em> on the{' '}
            <Link to="/shopping">shopping list</Link> to turn your plan into
            ingredients to bring home.
          </p>
          <p className="mt-3">
            Plans and shopping lists are shared with anyone else in your
            household &mdash; hand them the 6-character invite code from
            your cookbook page and they can join.
          </p>
        </>
      ),
    },
  ];

  const s = steps[step];
  const last = step === steps.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
      <div className="w-full max-w-md rounded-3xl border border-rule bg-surface p-7 shadow-card">
        <p className="text-xs uppercase tracking-[0.2em] text-terracotta">
          Step {step + 1} of {steps.length}
        </p>
        <h2 className="mt-2 font-serif text-2xl leading-tight">{s.title}</h2>
        <div className="mt-4 space-y-3 text-sm leading-relaxed text-ink/90">
          {s.body}
        </div>
        <div className="mt-6 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={finish}
            className="text-xs text-muted hover:text-terracotta"
          >
            Skip
          </button>
          <div className="flex gap-2">
            {step > 0 && (
              <button type="button" onClick={() => setStep(step - 1)} className="btn">
                Back
              </button>
            )}
            {last ? (
              <button type="button" onClick={finish} className="btn-primary">
                Let's cook
              </button>
            ) : (
              <button type="button" onClick={() => setStep(step + 1)} className="btn-primary">
                Next
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
