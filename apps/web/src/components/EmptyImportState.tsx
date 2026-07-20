'use client';

import { useRouter } from 'next/navigation';
import { useI18n, type DictKey } from '@/lib/i18n';

// Estado vazio partilhado — o mesmo padrão em todos os cartões de análise do
// protótipo: ícone + mensagem específica + atalho para a importação.
export function EmptyImportState({ msgKey }: { msgKey: DictKey }) {
  const { t } = useI18n();
  const router = useRouter();
  return (
    <div className="card" style={{ textAlign: 'center', padding: '28px 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10, color: 'var(--pr)' }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <path d="m7 10 5 5 5-5" />
          <path d="M12 15V3" />
        </svg>
      </div>
      <div style={{ fontSize: 15, fontWeight: 900, marginBottom: 5 }}>{t('empty_import_title')}</div>
      <div style={{ fontSize: 12, color: 'var(--tx2)', lineHeight: 1.5, marginBottom: 6 }}>{t(msgKey)}</div>
      <div style={{ fontSize: 12, color: 'var(--tx2)', lineHeight: 1.5, marginBottom: 16 }}>{t('empty_import_sub')}</div>
      <button
        className="btn-primary"
        style={{ width: 'auto', padding: '11px 20px', fontSize: 13 }}
        onClick={() => router.push('/atividade')}
      >
        {t('empty_import_cta')}
      </button>
      <div style={{ fontSize: 10, color: 'var(--tx3)', marginTop: 12 }}>{t('empty_import_privacy')}</div>
    </div>
  );
}
