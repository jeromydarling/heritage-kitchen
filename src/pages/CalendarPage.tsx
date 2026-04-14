import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getLiturgicalDay,
  upcomingFeasts,
  SEASON_BLURBS,
  SUGGESTION_MODE_LABELS,
  type LiturgicalDay,
  type Feast,
} from '../lib/liturgical';
import { getSeasonalSuggestions } from '../lib/recipes';
import { useLiturgicalKitchen } from '../lib/preferences';
import type { Recipe } from '../lib/types';
import RecipeCard from '../components/RecipeCard';

/**
 * Shows the liturgical day, an argument for why cooking by this calendar
 * is worthwhile even for the non-religious, today's cooking suggestions,
 * and the next few months of feasts. The whole page is date-sensitive and
 * recomputes on mount.
 */
export default function CalendarPage() {
  const [day, setDay] = useState<LiturgicalDay | null>(null);
  const [suggestions, setSuggestions] = useState<Recipe[]>([]);
  const [upcoming, setUpcoming] = useState<Array<{ date: Date; feast: Feast }>>([]);
  const [calendarOn, setCalendarOn] = useLiturgicalKitchen();

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
    <div className="space-y-14">
      <header className="space-y-3">
        <p className="text-xs uppercase tracking-[0.2em] text-terracotta">
          The liturgical kitchen
        </p>
        <h1 className="font-serif text-4xl sm:text-5xl">
          The oldest calendar in the kitchen
        </h1>
        <p className="max-w-2xl text-lg text-muted">
          An ancient rhythm of fast and feast that pre-dates every modern
          food fashion by several thousand years &mdash; and that you can cook by
          whether you are religious or not.
        </p>
      </header>

      <AncientCalendarEssay />

      <ToggleRow enabled={calendarOn} onChange={setCalendarOn} />

      {calendarOn ? (
        <>
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
                    {day.seasonLabel} Â·{' '}
                    {day.feast.rank === 'solemnity'
                      ? 'Solemnity'
                      : day.feast.rank === 'feast'
                        ? 'Feast'
                        : 'Memorial'}
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
              {day.isFast && (
                <span className="chip border-terracotta/40 text-terracotta">Fast day</span>
              )}
              {day.isAbstinence && !day.isFast && (
                <span className="chip border-terracotta/40 text-terracotta">Abstinence</span>
              )}
              {day.isFriday && !day.isFast && <span className="chip">Friday</span>}
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
                The library doesnâ€™t have anything obviously matching todayâ€™s
                tone yet. Browse the full library and pick what feels right.
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
              The next feasts on the horizon. Start thinking about what
              youâ€™d like to make &mdash; bread and fruit cake want time, and so
              do we.
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
        </>
      ) : (
        <section className="card p-6 sm:p-10">
          <p className="text-muted">
            The liturgical kitchen is currently turned off. Home page
            suggestions and the Calendar nav link are hidden. You can turn
            it back on any time using the toggle above, or just{' '}
            <Link to="/">head back to browsing</Link>.
          </p>
        </section>
      )}
    </div>
  );
}

// -------- Essay block: the case for the oldest calendar --------

function AncientCalendarEssay() {
  return (
    <section className="space-y-5 text-base leading-relaxed">
      <p>
        The Christian liturgical year is usually filed as a religious
        schedule &mdash; feasts and fasts for people who sit in pews. But
        underneath, it is something far older: the oldest farming calendar
        most of us still have access to. Almost every date on it was
        already marked on the calendars of pre-Christian Mediterranean
        farmers for reasons that had very little to do with theology and
        everything to do with the seasons.
      </p>
      <p>
        Easter is the spring lamb and the first grain. Pentecost &mdash; fifty
        days later &mdash; is the wheat harvest. The Assumption, August 15, is
        the first-fruits blessing of the late-summer orchard that Greek
        and Roman farmers held in the same week for a thousand years
        before anyone read the Gospel. All Saints, at the beginning of
        November, lands on the old cross-quarter day between the autumn
        equinox and winter solstice &mdash; the last killing frost, the moment
        where what is going to be preserved gets preserved and what isnâ€™t
        gets eaten.
      </p>
      <p>
        Even the forty days of Lent are a farmerâ€™s calendar in disguise.
        The reason pre-industrial families abstained from meat and dairy
        in late winter is that the root cellar was getting empty, the
        first greens hadnâ€™t come up, the laying hens had slowed down, and
        the newborn lambs were too valuable to kill. Fasting turned a
        hungry gap into a discipline, and discipline into anticipation
        &mdash; so that Easter lamb, when it finally came, tasted the way
        nothing else in the year could.
      </p>
      <p>
        You donâ€™t have to be Catholic, or Orthodox, or religious at all,
        to cook by this calendar. You just have to be willing to eat what
        the season is actually giving you, feast when there is something
        worth feasting over, and pull back a little when the pantry is
        light. This is also, not coincidentally, roughly what every modern
        nutritionist, every locavore cookbook, every &ldquo;eat the seasons&rdquo;
        argument is trying to rediscover. The Christian year got there
        first &mdash; and then held onto it for two thousand years while the
        rest of us were inventing microwave meals.
      </p>
      <p>
        Cook with it for a year and see what happens. Strawberries in June
        taste different when youâ€™ve actually waited for them. A roast
        goose at Christmas is a different thing when you havenâ€™t been
        eating goose in July. Even the Friday fish, that most quietly
        persistent of habits, turns out to be a small rhythm your week
        didnâ€™t know it was missing.
      </p>
    </section>
  );
}

function ToggleRow({
  enabled,
  onChange,
}: {
  enabled: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-rule bg-surface p-5 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="font-serif text-lg">Liturgical kitchen</p>
        <p className="text-sm text-muted">
          {enabled
            ? 'Currently on. The home page shows todayâ€™s season and suggested recipes.'
            : 'Currently off. The home page and nav bar are plain. You can still visit this page any time.'}
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        onClick={() => onChange(!enabled)}
        className={`relative inline-flex h-7 w-12 flex-shrink-0 items-center rounded-full border border-rule transition ${
          enabled ? 'bg-terracotta' : 'bg-paper'
        }`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-surface shadow transition ${
            enabled ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
        <span className="sr-only">
          {enabled ? 'Turn liturgical kitchen off' : 'Turn liturgical kitchen on'}
        </span>
      </button>
    </section>
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
