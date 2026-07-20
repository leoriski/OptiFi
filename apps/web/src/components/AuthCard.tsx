'use client';

import type { ReactNode } from 'react';

export function AuthCard({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) {
  return (
    <div className="card" style={{ padding: 24 }}>
      <div
        style={{
          fontSize: 22,
          fontWeight: 900,
          background: 'var(--brand-gradient)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          marginBottom: 4,
        }}
      >
        OptiFi
      </div>
      <h1 style={{ fontSize: 18, fontWeight: 800, margin: '10px 0 4px' }}>{title}</h1>
      {sub ? <p style={{ fontSize: 13, color: 'var(--tx2)', margin: '0 0 18px' }}>{sub}</p> : null}
      {children}
    </div>
  );
}

export function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--tx2)', margin: '12px 0 6px' }}>
      {children}
    </label>
  );
}

export function ErrorMsg({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <div
      style={{
        marginTop: 12,
        padding: '10px 12px',
        borderRadius: 'var(--rs)',
        background: 'color-mix(in srgb, var(--re) 12%, transparent)',
        border: '1px solid color-mix(in srgb, var(--re) 30%, transparent)',
        color: 'var(--re)',
        fontSize: 12,
        fontWeight: 700,
      }}
    >
      {children}
    </div>
  );
}

export function OkMsg({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <div
      style={{
        marginTop: 12,
        padding: '10px 12px',
        borderRadius: 'var(--rs)',
        background: 'color-mix(in srgb, var(--gr) 12%, transparent)',
        border: '1px solid color-mix(in srgb, var(--gr) 30%, transparent)',
        color: 'var(--gr)',
        fontSize: 12,
        fontWeight: 700,
      }}
    >
      {children}
    </div>
  );
}
