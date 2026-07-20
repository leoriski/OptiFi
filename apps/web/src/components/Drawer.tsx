'use client';

// Bottom sheet do protótipo (.sp-overlay/.sp-sheet com transições CSS).
// Controlado por `open`; fecha no overlay, no ✕ e com Escape.

import { useEffect } from 'react';

export function Drawer({
  open,
  onClose,
  title,
  sub,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  sub?: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  return (
    <>
      <div className={`sp-overlay${open ? ' open' : ''}`} onClick={onClose} />
      <div className={`sp-sheet${open ? ' open' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div style={{ flexShrink: 0 }}>
          <div className="ci-dr-handle" />
          <div className="ci-dr-hdr">
            <div>
              <div style={{ fontSize: 16, fontWeight: 900 }}>{title}</div>
              {sub ? <div style={{ fontSize: 11, color: 'var(--tx2)', marginTop: 1 }}>{sub}</div> : null}
            </div>
            <button className="ci-dr-close-btn" onClick={onClose} aria-label="Fechar">
              ✕
            </button>
          </div>
        </div>
        <div className="sp-body">{children}</div>
      </div>
    </>
  );
}
