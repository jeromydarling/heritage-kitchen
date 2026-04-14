export default function EssayBadge({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border border-terracotta/40 bg-terracotta/5 px-2.5 py-0.5 text-xs font-medium uppercase tracking-widest text-terracotta ${className}`}
    >
      Essay
    </span>
  );
}
