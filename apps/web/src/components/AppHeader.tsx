'use client';

// Cabeçalho do protótipo: logótipo OptiFi (anel + linha de pulso em gradiente)
// e o selo "Seguro" — o mesmo markup e classes do index.html original.

export function OptiFiLogo({ size = 21 }: { size?: number }) {
  return (
    <svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" width={size} height={size}>
      <defs>
        <linearGradient id="lG1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1A6BFF" />
          <stop offset="100%" stopColor="#00C896" />
        </linearGradient>
        <linearGradient id="lG2" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#00C896" />
          <stop offset="100%" stopColor="#1A6BFF" />
        </linearGradient>
        <clipPath id="cc1">
          <circle cx="16" cy="16" r="14" />
        </clipPath>
      </defs>
      <circle cx="16" cy="16" r="15" fill="none" stroke="var(--tx)" strokeWidth="1.5" />
      <path d="M 8 16 A 8 8 0 0 1 24 16" fill="none" stroke="var(--tx)" strokeWidth="2.5" strokeLinecap="round" clipPath="url(#cc1)" />
      <path
        d="M 7 17 C 10 17, 11 12, 13 14 C 15 16, 16 11, 18 13 C 20 15, 21 19, 24 18"
        fill="none"
        stroke="var(--tx)"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        clipPath="url(#cc1)"
      />
    </svg>
  );
}

export function AppHeader({ secureLabel }: { secureLabel: string }) {
  return (
    <header className="hdr">
      <div className="logo">
        <div className="logo-icon">
          <OptiFiLogo />
        </div>
        <span>OptiFi</span>
      </div>
      <div className="hdr-r">
        <div className="secure-badge">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <span>{secureLabel}</span>
        </div>
      </div>
    </header>
  );
}
