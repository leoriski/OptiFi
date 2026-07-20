'use client';

import Link from 'next/link';
import { useI18n } from '@/lib/i18n';
import { AuthCard } from '@/components/AuthCard';

export default function VerifyPage() {
  const { t } = useI18n();
  return (
    <AuthCard title={t('auth_verify_title')} sub={t('auth_verify_sub')}>
      <p style={{ fontSize: 12, color: 'var(--tx3)' }}>{t('auth_verify_spam')}</p>
      <div style={{ marginTop: 16, textAlign: 'center' }}>
        <Link href="/login" style={{ fontSize: 13, color: 'var(--pr)', fontWeight: 700, textDecoration: 'none' }}>
          {t('auth_back_login')}
        </Link>
      </div>
    </AuthCard>
  );
}
