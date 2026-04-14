import type { Difficulty } from '../lib/types';

const styles: Record<Difficulty, string> = {
  easy: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  moderate: 'bg-amber-50 text-amber-800 border-amber-200',
  involved: 'bg-rose-50 text-rose-800 border-rose-200',
};

export default function DifficultyBadge({ difficulty }: { difficulty: Difficulty }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${styles[difficulty]}`}
    >
      {difficulty}
    </span>
  );
}
