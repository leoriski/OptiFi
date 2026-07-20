'use client';

// Ícones de meta por chave (goals.icon_key) — a família do protótipo,
// em SVG com traço. Inclui o seletor visual usado no drawer de metas.

const S = { fill: 'none', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

const PATHS: Record<string, React.ReactNode> = {
  target: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1" />
    </>
  ),
  home: (
    <>
      <path d="M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z" />
      <path d="M9 21v-6h6v6" />
    </>
  ),
  plane: <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2Z" />,
  car: (
    <>
      <path d="M5 17H3V7a1 1 0 0 1 1-1h10l4 5h2a1 1 0 0 1 1 1v5h-2" />
      <circle cx="7.5" cy="17.5" r="1.8" />
      <circle cx="16.5" cy="17.5" r="1.8" />
    </>
  ),
  shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
  heart: <path d="M12 21s-7-4.5-9-9c-1.5-3.5.5-7 4-7 2 0 3.5 1 5 3 1.5-2 3-3 5-3 3.5 0 5.5 3.5 4 7-2 4.5-9 9-9 9Z" />,
  graduation: (
    <>
      <path d="M22 9 12 5 2 9l10 4 10-4Z" />
      <path d="M6 11v5c0 1 2.7 2.5 6 2.5s6-1.5 6-2.5v-5" />
    </>
  ),
  trending: (
    <>
      <path d="M3 17 9 11l4 4 8-8" />
      <path d="M14 5h7v7" />
    </>
  ),
  laptop: (
    <>
      <rect x="3" y="5" width="18" height="12" rx="2" />
      <path d="M2 20h20" />
    </>
  ),
  gift: (
    <>
      <rect x="3" y="8" width="18" height="4" rx="1" />
      <path d="M12 8v13M5 12v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-8" />
      <path d="M12 8S10.5 3 8 4.5 9.5 8 12 8Zm0 0s1.5-5 4-3.5S14.5 8 12 8Z" />
    </>
  ),
  dumbbell: (
    <>
      <path d="M6 7v10M18 7v10M3 9v6M21 9v6M6 12h12" />
    </>
  ),
  sailboat: (
    <>
      <path d="M3 18h18l-2 3H5l-2-3Z" />
      <path d="M12 3v12M12 3 5 15h7M12 6l6 9h-6" />
    </>
  ),
};

export const GOAL_ICON_KEYS = Object.keys(PATHS);

export function GoalIcon({ iconKey, size = 20, color = 'var(--pr)' }: { iconKey: string; size?: number; color?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} stroke={color} {...S}>
      {PATHS[iconKey] ?? PATHS.target}
    </svg>
  );
}

export function GoalIconPicker({ value, onChange }: { value: string; onChange: (key: string) => void }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8 }}>
      {GOAL_ICON_KEYS.map((key) => {
        const active = key === value;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            aria-label={key}
            style={{
              aspectRatio: '1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 12,
              cursor: 'pointer',
              background: active ? 'color-mix(in srgb, var(--pr) 16%, transparent)' : 'var(--card2)',
              border: active ? '1.5px solid var(--pr)' : '1px solid var(--b)',
            }}
          >
            <GoalIcon iconKey={key} size={18} color={active ? 'var(--pr)' : 'var(--tx2)'} />
          </button>
        );
      })}
    </div>
  );
}
