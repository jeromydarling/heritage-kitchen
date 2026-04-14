import { useCallback, useRef } from 'react';

type Tab = 'original' | 'modern';

interface Props {
  active: Tab;
  onChange: (tab: Tab) => void;
}

export default function TabSwitcher({ active, onChange }: Props) {
  const refs = useRef<Record<Tab, HTMLButtonElement | null>>({
    original: null,
    modern: null,
  });

  const onKey = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        const next: Tab = active === 'original' ? 'modern' : 'original';
        onChange(next);
        refs.current[next]?.focus();
      }
    },
    [active, onChange],
  );

  return (
    <div
      role="tablist"
      aria-label="Recipe version"
      onKeyDown={onKey}
      className="inline-flex rounded-full border border-rule bg-surface p-1 shadow-card"
    >
      {(['original', 'modern'] as Tab[]).map((tab) => {
        const selected = active === tab;
        return (
          <button
            key={tab}
            ref={(el) => {
              refs.current[tab] = el;
            }}
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab)}
            className={`rounded-full px-5 py-2 text-sm font-semibold capitalize transition ${
              selected ? 'bg-terracotta text-cream' : 'text-muted hover:text-ink'
            }`}
          >
            {tab === 'original' ? 'Original' : 'Modern'}
          </button>
        );
      })}
    </div>
  );
}
