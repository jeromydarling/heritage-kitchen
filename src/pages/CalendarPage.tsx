import { useEffect, useState } from 'react';
import {
  getLiturgicalDay,
  upcomingFeasts,
  SEASON_BLURBS,
  SUGGESTION_MODE_LABELS,
  type LiturgicalDay,
  type Feast,
} from '../lib/liturgical';
import { getSeasonalSuggestions } from '../lib/recipes';
import type { Recipe } from '../lib/types';
import RecipeCard from '../components/RecipeCard';

/**
 * Shows the liturgical day, season blurb, today's cooking suggestions, and
 * the upcoming feasts in roughly the next few months. The whole page is
 * recomputed on mount so it will reflect whatever day you load it.
 */
export default function CalendarPage() {
  const [day, setDay] = useState<LiturgicalDay | null>(null);
  const [suggestions, setSuggestions] = useState<Recipe[]>([]);
  const [upcoming, setUpcoming] = useState<Array<{ date: Date; feast: Feast }>>([]);

  useEffect(() => {
    const today = getLiturgicalDay(new Date());
    setDay(today);
    setUpcoming(upcomingFeasts(new Date(), 10));
    getSeasonalSuggestions(today, 9).then(setSuggestions);
  }, []);

  if (!day) return <p className="text-muted">Loading the calendarâ€¦</p>;

  const dateFmt = new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="space-y-12">
      <header className="space-y-3">
        <p className="text-xs uppercase tracking-[0.2em] text-terracotta">
          The liturgical kitchen
        </p>
        <h1 className="font-serif text-4xl sm:text-5xl">
          Cooking with the Church year
        </h1>
        <p className="max-w-2xl text-lg text-muted">
          Every day of the year has its own mood in the Christian kitchen â€” a
          day of waiting, of fasting, of quiet, of celebration. Here is what
          today is asking for.
        </p>
      </header>

      <section className="card p-6 sm:p-10">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted">
              {dateFmt.format(day.date)}
            </p>
            <h2 className="mt-1 font-serif text-3xl">
              {day.feast?.name ?? day.seasonLabel}
            </h2>
            {day.feast && (
              <p className="mt-1 text-sm text-muted">
                {day.seasonLabel} Â· {day.feast.rank === 'solemnity' ? 'Solemnity' : day.feast.rank === 'feast' ? 'Feast' : 'Memorial'}
              </p>
            )}
          </div>
          <SeasonPill day={day} />
        </div>

        <p className="mt-5 max-w-2xl leading-relaxed">
          {day.feast?.blurb ?? SEASON_BLURBS[day.season]}
        </p>

        <div className="mt-6 flex flex-wrap gap-2 text-xs">
          <span className="chip">{SUGGESTION_MODE_LABELS[day.suggestionMode]}</span>
          {day.isFast && <span className="chip border-terracotta/40 text-terracotta">Fast day</span>}
          {day.isAbstinence && !day.isFast && (
            <span className="chip border-terracotta/40 text-terracotta">Abstinence</span>
          )}
          {day.isFriday && !day.isFast && (
            <span className="chip">Friday</span>
          )}
        </div>
      </section>

      <section>
        <h2 className="font-serif text-2xl">For the table today</h2>
        <p className="mt-1 text-sm text-muted">
          {day.feast?.titleTokens?.length
            ? 'Drawn from the traditions of this feast.'
            : 'Selected to match the mood of the season.'}
        </p>
        {suggestions.length === 0 ? (
          <p className="mt-6 text-muted">
            The library doesnâ€™t have anything obviously matching todayâ€™s tone
            yet. Browse the full library and pick what feels right.
          </p>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {suggestions.map((r) => (
              <RecipeCard key={r.id} recipe={r} />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="font-serif text-2xl">Coming up</h2>
        <p className="mt-1 text-sm text-muted">
          The next feasts on the horizon. Start thinking about what youâ€™d like
          to make â€” bread and fruit cake want time, and so do we.
        </p>
        <ul className="mt-6 space-y-3">
          {upcoming.map(({ date, feast }) => (
            <li
              key={`${feast.name}-${date.toISOString()}`}
              className="card flex flex-col gap-2 p-4 sm:flex-row sm:items-baseline sm:justify-between"
            >
              <div>
                <p className="font-serif text-lg">{feast.name}</p>
                {feast.blurb && <p className="text-sm text-muted">{feast.blurb}</p>}
              </div>
              <p className="text-xs uppercase tracking-widest text-muted">
                {new Intl.DateTimeFormat(undefined, {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                }).format(date)}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function SeasonPill({ day }: { day: LiturgicalDay }) {
  const color = day.seasonColor;
  const classes: Record<LiturgicalDay['seasonColor'], string> = {
    purple: 'bg-purple-100 text-purple-900 border-purple-200',
    white: 'bg-amber-50 text-amber-900 border-amber-200',
    green: 'bg-emerald-50 text-emerald-900 border-emerald-200',
    red: 'bg-rose-50 text-rose-900 border-rose-200',
    rose: 'bg-pink-50 text-pink-900 border-pink-200',
  };
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-widest ${classes[color]}`}
    >
      <span className="h-2 w-2 rounded-full bg-current" />
      {day.seasonLabel}
    </span>
  );
}
