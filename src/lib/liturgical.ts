/**
 * Catholic liturgical calendar calculations for Heritage Kitchen.
 *
 * Provides enough of the liturgical year to drive seasonal cooking
 * suggestions: the current season and its color, moveable feasts
 * (computed from Easter), the major fixed feasts with food traditions,
 * and whether today is a day of fasting or abstinence.
 *
 * This is deliberately simplified. We follow the reformed Roman calendar
 * where it affects dates of feasts, but we use the traditional pastoral
 * convention that Christmastide runs through Candlemas (Feb 2) â€” both
 * because it matches how most families actually live the season and
 * because it gives us a satisfying feast-cooking window.
 *
 * All dates are computed in the caller's local timezone.
 */

export type LiturgicalSeason =
  | 'advent'
  | 'christmastide'
  | 'lent'
  | 'holy-week'
  | 'eastertide'
  | 'ordinary-time';

export interface LiturgicalDay {
  date: Date;
  season: LiturgicalSeason;
  seasonLabel: string;
  seasonColor: 'purple' | 'white' | 'green' | 'red' | 'rose';
  feast?: Feast;
  isSunday: boolean;
  isFriday: boolean;
  /** Traditional Friday abstinence, Ash Wednesday, Good Friday, Lenten weekdays of old. */
  isAbstinence: boolean;
  /** Ash Wednesday and Good Friday (the two universal fast days). */
  isFast: boolean;
  /** A short suggestion shown in cooking UI. */
  suggestionMode: SuggestionMode;
}

export type SuggestionMode =
  | 'ordinary'
  | 'fasting'
  | 'friday-abstinence'
  | 'advent-simple'
  | 'christmas-feast'
  | 'easter-feast'
  | 'feast-day';

export interface Feast {
  name: string;
  /** Optional short description. */
  blurb?: string;
  /** Title tokens to prefer when surfacing recipes for this feast. */
  titleTokens?: string[];
  /** Degree: 'solemnity' | 'feast' | 'memorial' */
  rank: 'solemnity' | 'feast' | 'memorial';
  /** Suggestion mode override for this day. */
  mode?: SuggestionMode;
}

// ---------- Easter calculation (Butcher's algorithm, Gregorian) ----------

/** Returns the date of Easter Sunday in the given (Gregorian) year. */
export function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const L = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * L) / 451);
  const month = Math.floor((h + L - 7 * m + 114) / 31); // 3=March, 4=April
  const day = ((h + L - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

// ---------- Advent calculation ----------

/** First Sunday of Advent: the Sunday on or after Nov 27 (i.e. 4 Sundays before Christmas). */
export function firstSundayOfAdvent(year: number): Date {
  // Find the Sunday on or before Dec 24 (the 4th Sunday of Advent),
  // then subtract three weeks to get the 1st Sunday.
  const dec24 = new Date(year, 11, 24);
  const back = dec24.getDay(); // 0 (Sun) means Dec 24 is already Sunday
  const fourth = new Date(year, 11, 24 - back);
  const first = new Date(fourth);
  first.setDate(first.getDate() - 21);
  return first;
}

// ---------- Date helpers ----------

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function isBetween(d: Date, start: Date, end: Date): boolean {
  const t = startOfDay(d).getTime();
  return t >= startOfDay(start).getTime() && t <= startOfDay(end).getTime();
}

// ---------- Fixed feasts with food associations ----------

/**
 * Major fixed-date feasts that matter for the kitchen. The titleTokens are
 * used to surface specific traditional dishes on the feast day.
 */
function fixedFeasts(year: number): Array<{ date: Date; feast: Feast }> {
  const f = (
    month: number,
    day: number,
    name: string,
    rank: Feast['rank'],
    opts: Partial<Feast> = {},
  ) => ({
    date: new Date(year, month - 1, day),
    feast: { name, rank, ...opts },
  });

  return [
    f(12, 6, 'St. Nicholas', 'memorial', {
      blurb:
        'The original gift-giver. Put a coin in a pair of shoes and bake something spiced.',
      titleTokens: ['gingerbread', 'speculaas', 'pfeffernuss', 'spice', 'cookie'],
      mode: 'feast-day',
    }),
    f(12, 8, 'The Immaculate Conception', 'solemnity', {
      titleTokens: ['cake', 'pudding', 'tart'],
      mode: 'feast-day',
    }),
    f(12, 13, 'St. Lucy', 'memorial', {
      blurb: 'Light in the darkest weeks of the year. Bake saffron buns.',
      titleTokens: ['saffron', 'bun', 'roll', 'sweet bread'],
      mode: 'feast-day',
    }),
    f(12, 24, 'Christmas Eve', 'solemnity', {
      blurb:
        'The Vigil of the Nativity. In many places traditionally meatless â€” fish, soup, sweets.',
      titleTokens: ['fish', 'eel', 'oyster', 'soup', 'pudding'],
      mode: 'feast-day',
    }),
    f(12, 25, 'The Nativity of the Lord', 'solemnity', {
      blurb: 'Christmas Day. The feast of the Incarnation calls for a feast on the table.',
      titleTokens: [
        'plum pudding', 'fruit cake', 'mince', 'wassail', 'eggnog',
        'gingerbread', 'goose', 'turkey', 'ham', 'roast', 'cookie', 'yule',
      ],
      mode: 'christmas-feast',
    }),
    f(12, 26, 'St. Stephen', 'feast', {
      blurb: '"Good King Wenceslas looked out, on the feast of Stephen..."',
      mode: 'christmas-feast',
    }),
    f(12, 27, 'St. John the Evangelist', 'feast', { mode: 'christmas-feast' }),
    f(12, 28, 'The Holy Innocents', 'feast', { mode: 'christmas-feast' }),
    f(1, 1, 'Mary, Mother of God', 'solemnity', {
      blurb: 'The octave day of Christmas. New Year traditions meet the Christmas feast.',
      mode: 'christmas-feast',
    }),
    f(1, 6, 'The Epiphany', 'solemnity', {
      blurb:
        'The manifestation to the Magi. A king cake hides a bean or a baby; whoever finds it wears the crown.',
      titleTokens: ['king cake', 'galette', 'three kings', 'almond', 'cake'],
      mode: 'feast-day',
    }),
    f(2, 2, 'The Presentation (Candlemas)', 'feast', {
      blurb:
        'Forty days after Christmas. In France, crepes; in England, the end of the Christmas greens.',
      titleTokens: ['crepe', 'pancake', 'candlemas'],
      mode: 'feast-day',
    }),
    f(3, 17, 'St. Patrick', 'memorial', {
      blurb: 'Irish bread, soda bread, and a hearty stew.',
      titleTokens: ['soda bread', 'irish', 'stew', 'cabbage', 'corned beef'],
      mode: 'feast-day',
    }),
    f(3, 19, 'St. Joseph', 'solemnity', {
      blurb:
        'Sicilian tradition fills the table with zeppole and cream puffs for the Foster Father of Our Lord.',
      titleTokens: ['zeppole', 'cream puff', 'cannoli', 'st joseph'],
      mode: 'feast-day',
    }),
    f(3, 25, 'The Annunciation', 'solemnity', {
      blurb: 'Nine months before Christmas.',
      mode: 'feast-day',
    }),
    f(6, 24, 'The Nativity of St. John the Baptist', 'solemnity', {
      blurb: 'Midsummer. Strawberries, lemonade, cakes iced white.',
      titleTokens: ['strawberry', 'cake', 'lemonade'],
      mode: 'feast-day',
    }),
    f(6, 29, 'Sts. Peter and Paul', 'solemnity', { mode: 'feast-day' }),
    f(8, 6, 'The Transfiguration', 'feast', {
      blurb: 'The feast when the Church traditionally blesses the first grapes of the harvest.',
      titleTokens: ['grape', 'fig'],
      mode: 'feast-day',
    }),
    f(8, 15, 'The Assumption', 'solemnity', {
      blurb: 'First fruits of the harvest. Herbs and flowers are blessed in many places.',
      titleTokens: ['harvest', 'apple', 'peach', 'herb'],
      mode: 'feast-day',
    }),
    f(11, 1, "All Saints' Day", 'solemnity', {
      blurb: 'Soul cakes, pan de muerto, and the beginning of the November commemorations.',
      titleTokens: ['soul cake', 'bread'],
      mode: 'feast-day',
    }),
    f(11, 2, "All Souls' Day", 'memorial', {
      blurb: 'A day of prayer for the dead. Traditionally simple food.',
      mode: 'ordinary',
    }),
    f(11, 11, 'St. Martin of Tours', 'memorial', {
      blurb: 'Martinmas â€” the old end of the farming year. Goose, apples, new wine.',
      titleTokens: ['goose', 'apple'],
      mode: 'feast-day',
    }),
  ];
}

// ---------- Moveable feasts computed from Easter ----------

function moveableFeasts(easter: Date): Array<{ date: Date; feast: Feast }> {
  return [
    {
      date: addDays(easter, -46),
      feast: {
        name: 'Ash Wednesday',
        rank: 'feast',
        blurb: 'The beginning of Lent. A day of fasting and abstinence.',
        mode: 'fasting',
      },
    },
    {
      date: addDays(easter, -2),
      feast: {
        name: 'Good Friday',
        rank: 'solemnity',
        blurb: 'A day of fasting. Traditionally hot cross buns in the evening.',
        titleTokens: ['hot cross', 'simnel', 'fish'],
        mode: 'fasting',
      },
    },
    {
      date: addDays(easter, -1),
      feast: {
        name: 'Holy Saturday',
        rank: 'solemnity',
        blurb: 'The quiet day. In Eastern tradition, baskets of food are prepared for blessing at the Vigil.',
        titleTokens: ['paska', 'kulich', 'babka'],
        mode: 'fasting',
      },
    },
    {
      date: easter,
      feast: {
        name: 'Easter Sunday',
        rank: 'solemnity',
        blurb:
          'The feast of feasts. Lamb, ham, braided sweet breads, and eggs: everything denied in Lent returns.',
        titleTokens: [
          'lamb', 'ham', 'easter', 'simnel', 'hot cross', 'paska',
          'kulich', 'babka', 'egg', 'braid', 'sweet bread',
        ],
        mode: 'easter-feast',
      },
    },
    {
      date: addDays(easter, 39),
      feast: {
        name: 'The Ascension',
        rank: 'solemnity',
        blurb: 'Forty days after Easter.',
        mode: 'feast-day',
      },
    },
    {
      date: addDays(easter, 49),
      feast: {
        name: 'Pentecost',
        rank: 'solemnity',
        blurb: 'The birthday of the Church. In Italy traditionally dove-shaped bread.',
        titleTokens: ['dove', 'bread'],
        mode: 'feast-day',
      },
    },
    {
      date: addDays(easter, 60),
      feast: {
        name: 'Corpus Christi',
        rank: 'solemnity',
        blurb: 'The feast of the Most Holy Body and Blood of Christ. Bread and wheat.',
        titleTokens: ['bread', 'wheat'],
        mode: 'feast-day',
      },
    },
  ];
}

// ---------- Main API ----------

/** Returns the liturgical day information for the given date (default: today). */
export function getLiturgicalDay(date: Date = new Date()): LiturgicalDay {
  const today = startOfDay(date);
  const year = today.getFullYear();
  const easter = easterSunday(year);
  const advent1 = firstSundayOfAdvent(year);

  // Season boundaries
  const ashWed = addDays(easter, -46);
  const holyThursday = addDays(easter, -3);
  const pentecost = addDays(easter, 49);
  // Use traditional pastoral convention: Christmastide runs through Candlemas (Feb 2)
  const candlemas = new Date(year, 1, 2);
  // Previous year's Advent may still be active in early Jan? No â€” Christmastide follows.
  // For dates Jan 1 â€“ Feb 2 we're in Christmastide from last year.

  let season: LiturgicalSeason = 'ordinary-time';

  if (isBetween(today, advent1, new Date(year, 11, 24))) {
    season = 'advent';
  } else if (
    isBetween(today, new Date(year, 11, 25), new Date(year, 11, 31))
  ) {
    season = 'christmastide';
  } else if (isBetween(today, new Date(year, 0, 1), candlemas)) {
    season = 'christmastide';
  } else if (isBetween(today, ashWed, addDays(easter, -4))) {
    season = 'lent';
  } else if (isBetween(today, holyThursday, addDays(easter, -1))) {
    season = 'holy-week';
  } else if (isBetween(today, easter, pentecost)) {
    season = 'eastertide';
  }

  // Look up feast day
  const candidates = [...fixedFeasts(year), ...moveableFeasts(easter)];
  const feastHit = candidates.find((c) => sameDay(c.date, today));
  const feast = feastHit?.feast;

  const dow = today.getDay();
  const isSunday = dow === 0;
  const isFriday = dow === 5;

  const isInLent = season === 'lent' || season === 'holy-week';
  const isFast =
    sameDay(today, ashWed) ||
    (feast?.name === 'Good Friday');
  const isAbstinence =
    isFriday || isInLent || isFast || feast?.name === 'Ash Wednesday';

  // Determine suggestion mode. Feast-specific override wins.
  let suggestionMode: SuggestionMode = 'ordinary';
  if (feast?.mode) {
    suggestionMode = feast.mode;
  } else if (season === 'advent') {
    suggestionMode = 'advent-simple';
  } else if (season === 'christmastide') {
    suggestionMode = 'christmas-feast';
  } else if (isInLent) {
    suggestionMode = isFriday ? 'fasting' : isAbstinence ? 'fasting' : 'advent-simple';
  } else if (season === 'eastertide') {
    suggestionMode = 'easter-feast';
  } else if (isFriday) {
    suggestionMode = 'friday-abstinence';
  }

  const seasonLabel = SEASON_LABELS[season];
  const seasonColor = SEASON_COLORS[season];

  return {
    date: today,
    season,
    seasonLabel,
    seasonColor,
    feast,
    isSunday,
    isFriday,
    isAbstinence,
    isFast,
    suggestionMode,
  };
}

export const SEASON_LABELS: Record<LiturgicalSeason, string> = {
  advent: 'Advent',
  christmastide: 'Christmastide',
  lent: 'Lent',
  'holy-week': 'Holy Week',
  eastertide: 'Eastertide',
  'ordinary-time': 'Ordinary Time',
};

export const SEASON_COLORS: Record<LiturgicalSeason, LiturgicalDay['seasonColor']> = {
  advent: 'purple',
  christmastide: 'white',
  lent: 'purple',
  'holy-week': 'red',
  eastertide: 'white',
  'ordinary-time': 'green',
};

export const SEASON_BLURBS: Record<LiturgicalSeason, string> = {
  advent:
    'The four weeks of waiting. Kitchens keep things simple â€” the feast is still coming. A good season for soups, breads, and slow preparations of what will be Christmas fare.',
  christmastide:
    'Twelve days of the Nativity and then the octave of Epiphany, through Candlemas in the old reckoning. Every day is a feast day. Bake freely.',
  lent:
    'Forty days of penance. Traditionally meatless Fridays (and in many places, weekdays too), simple suppers, and a rediscovery of what the garden and the sea can do without the help of beef.',
  'holy-week':
    'The holiest week of the year. The kitchen quiets down into Good Friday and Holy Saturday, then bursts open on Easter with everything that was given up.',
  eastertide:
    'Fifty days of feasting. Lamb, ham, braided sweet breads, eggs in every form â€” the table finally matches the season.',
  'ordinary-time':
    'The long green stretches of the year. Cook with what the garden is giving you; keep Friday meatless if you can.',
};

export const SUGGESTION_MODE_LABELS: Record<SuggestionMode, string> = {
  ordinary: 'Everyday cooking',
  fasting: 'A simple, meatless supper',
  'friday-abstinence': 'Friday abstinence â€” fish or vegetarian',
  'advent-simple': 'Quiet Advent cooking',
  'christmas-feast': 'Christmas feast',
  'easter-feast': 'Easter feast',
  'feast-day': 'A feast day on the table',
};

/**
 * Returns the next `count` notable feast days after the given date,
 * wrapping to the next year if needed, within a 13-month window.
 */
export function upcomingFeasts(fromDate: Date = new Date(), count = 8): Array<{ date: Date; feast: Feast }> {
  const startYear = fromDate.getFullYear();
  const all: Array<{ date: Date; feast: Feast }> = [];
  for (const y of [startYear, startYear + 1]) {
    all.push(...fixedFeasts(y));
    all.push(...moveableFeasts(easterSunday(y)));
  }
  // Keep only major feasts (solemnities and notable memorials)
  const from = startOfDay(fromDate).getTime();
  return all
    .filter((x) => startOfDay(x.date).getTime() > from)
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(0, count);
}
