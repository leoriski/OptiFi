'use client';

// Metas — nível protótipo: resumo reservado/livre, cartões com ícone da meta
// (icon_key), e criação/edição num drawer (bottom sheet) com seletor de
// ícones. Levantar e apagar mantêm-se. Tudo ligado ao motor (projeções).

import { useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { useFinance, type GoalRow } from '@/lib/useFinance';
import { fmtEur, fmtEur0, fill, monthLabel } from '@optifi/core';
import { EmptyImportState } from '@/components/EmptyImportState';
import { Drawer } from '@/components/Drawer';
import { GoalIcon, GoalIconPicker } from '@/components/GoalIcon';

const label: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--tx2)', margin: '12px 0 5px' };

interface FormState {
  id?: string;
  name: string;
  iconKey: string;
  target: string;
  current: string;
  month: number;
  year: number;
  alloc: string;
  allocDay: number;
}

const emptyForm = (): FormState => ({
  name: '',
  iconKey: 'target',
  target: '',
  current: '0',
  month: 12,
  year: new Date().getFullYear(),
  alloc: '0',
  allocDay: 1,
});

export default function GoalsPage() {
  const { t, lang } = useI18n();
  const fin = useFinance();
  const { loading, imported, imp, fs, goals } = fin;
  const [form, setForm] = useState<FormState | null>(null);

  if (loading) return <div className="card" style={{ color: 'var(--tx2)', fontSize: 13 }}>…</div>;
  if (!imported || !fs || !imp) {
    return (
      <>
        <div className="ptitle" style={{ marginBottom: 14 }}>{t('nav_goals')}</div>
        <EmptyImportState msgKey="empty_goals" />
      </>
    );
  }

  const locale = lang === 'pt' ? 'pt-PT' : 'en-GB';
  const monthName = (m: number) => new Date(new Date().getFullYear(), m - 1, 1).toLocaleDateString(locale, { month: 'long' });
  const dateLabel = (d: Date) => d.toLocaleDateString(locale, { month: 'short', year: 'numeric' });

  const openEdit = (g: GoalRow) =>
    setForm({
      id: g.id,
      name: g.name,
      iconKey: g.icon_key || 'target',
      target: String(g.target_eur),
      current: String(g.current_eur),
      month: g.target_month ?? 12,
      year: g.target_year ?? new Date().getFullYear(),
      alloc: String(g.monthly_allocation),
      allocDay: g.allocation_day ?? 1,
    });

  const submit = async () => {
    if (!form || !form.name.trim() || !(parseFloat(form.target) > 0)) return;
    await fin.saveGoal({
      ...(form.id !== undefined ? { id: form.id } : {}),
      name: form.name.trim(),
      icon_key: form.iconKey,
      target_eur: parseFloat(form.target),
      current_eur: Math.max(0, parseFloat(form.current) || 0),
      target_month: form.month,
      target_year: form.year,
      monthly_allocation: Math.max(0, parseFloat(form.alloc) || 0),
      allocation_day: form.allocDay,
    });
    setForm(null);
  };

  const projLine = (goalId: string): { text: string; color: string } => {
    const p = fs.goalProjections[goalId];
    if (!p) return { text: '', color: 'var(--tx3)' };
    if (p.state === 'done') return { text: t('goal_proj_done'), color: 'var(--tx2)' };
    if (p.state === 'unallocated') return { text: t('goal_proj_none'), color: 'var(--tx3)' };
    if (p.onTrack) return { text: fill(t('goal_proj_ontrack'), { date: dateLabel(p.estDate!), n: p.months! }), color: 'var(--tx2)' };
    return { text: fill(t('goal_proj_late'), { date: dateLabel(p.estDate!), n: p.monthsLate! }), color: 'var(--tx2)' };
  };

  const yearNow = new Date().getFullYear();

  return (
    <>
      <div className="ptitle" style={{ marginBottom: 14 }}>{t('nav_goals')}</div>

      {/* Resumo: reservado vs livre */}
      <div className="goals-summary-card">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--tx3)' }}>{t('goals_reserved')}</div>
            <div style={{ fontSize: 17, fontWeight: 900, color: 'var(--pr)' }}>{fmtEur(fs.allocatedTotal)}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--tx3)' }}>{t('goals_free')}</div>
            {(() => {
              // Mesma fonte que a Home: gastável do saldo real (assinado). Sem
              // saldo definido, cai na sobra do mês. Vermelho quando negativo.
              const free = fs.spendableNow ?? fs.freeToSpend;
              return (
                <div style={{ fontSize: 17, fontWeight: 900, color: 'var(--tx)' }}>{fmtEur(free)}</div>
              );
            })()}
          </div>
        </div>
        <div style={{ fontSize: 10, color: 'var(--tx3)', marginTop: 8 }}>{t('goals_free_note')}</div>
        {(() => {
          // Lembrete: metas com alocação vencida ainda por transferir este mês.
          const due = goals.filter((g) => fs.goalAllocationStatus[g.id] === 'due');
          if (due.length === 0) return null;
          const total = due.reduce((a, g) => a + Number(g.monthly_allocation), 0);
          return (
            <div style={{ marginTop: 10, padding: '9px 12px', borderRadius: 'var(--rs)', background: 'var(--card2)', border: '1px solid var(--b)', fontSize: 12, fontWeight: 700, color: 'var(--tx)' }}>
              {fill(t('goal_alloc_reminder'), { n: due.length, amount: fmtEur(total) })}
            </div>
          );
        })()}
        {fs.monthDeficit > 0 && (
          <div style={{ marginTop: 10, padding: '9px 12px', borderRadius: 'var(--rs)', background: 'color-mix(in srgb, var(--re) 12%, transparent)', color: 'var(--re)', fontSize: 12, fontWeight: 700, lineHeight: 1.4 }}>
            {fill(t('goals_deficit'), { month: monthLabel(imp.statement_month, lang), amount: fmtEur(fs.monthDeficit) })}
          </div>
        )}
        {fs.overAllocated && (
          <div style={{ marginTop: 10, padding: '9px 12px', borderRadius: 'var(--rs)', background: 'color-mix(in srgb, var(--re) 12%, transparent)', color: 'var(--re)', fontSize: 12, fontWeight: 700 }}>
            {fill(t('goals_overalloc'), { amount: fmtEur(fs.overReserved) })}
          </div>
        )}
      </div>

      {/* Lista de metas */}
      {goals.length === 0 && (() => {
        // Primeira vez, sem metas: se o mês fechou com FOLGA, sugere começar a
        // poupar um valor conservador (metade da folga) — nunca num mês negativo.
        const surplus = fs.net;
        if (surplus > 20) {
          const safe = Math.max(5, Math.round((surplus * 0.5) / 5) * 5);
          return (
            <div className="card" style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 13, color: 'var(--tx)', fontWeight: 700, lineHeight: 1.5 }}>
                {fill(t('goals_start_nudge'), { month: monthLabel(imp.statement_month, lang), surplus: fmtEur(surplus), safe: fmtEur0(safe) })}
              </div>
              <div style={{ fontSize: 10, color: 'var(--tx3)', marginTop: 6 }}>{t('goals_start_note')}</div>
            </div>
          );
        }
        return <div className="card" style={{ marginBottom: 12, fontSize: 12, color: 'var(--tx2)' }}>{t('goals_empty')}</div>;
      })()}
      {goals.map((g) => {
        const pct = Math.min(100, Math.round((Number(g.current_eur) / Number(g.target_eur)) * 100));
        const proj = projLine(g.id);
        return (
          <div key={g.id} className="card" style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 8 }}>
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 12,
                  background: 'color-mix(in srgb, var(--pr) 13%, transparent)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <GoalIcon iconKey={g.icon_key || 'target'} size={21} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <div style={{ fontSize: 15, fontWeight: 900 }}>{g.name}</div>
                  <div style={{ fontSize: 15, fontWeight: 900, color: 'var(--pr)' }}>{pct}%</div>
                </div>
                <div style={{ fontSize: 12, color: 'var(--tx2)', marginTop: 1 }}>
                  <b style={{ color: 'var(--tx)' }}>{fmtEur(Number(g.current_eur))}</b> / {fmtEur(Number(g.target_eur))}
                </div>
              </div>
            </div>
            <div className="goal-prog">
              <div className="goal-fill" style={{ width: `${pct}%` }} />
            </div>
            <div style={{ fontSize: 11, color: proj.color, fontWeight: 700, margin: '8px 0 4px' }}>{proj.text}</div>
            {Number(g.monthly_allocation) > 0 && (
              <div style={{ fontSize: 11, color: 'var(--tx3)', marginBottom: 6 }}>
                {fmtEur(Number(g.monthly_allocation))}
                {t('goal_alloc_short')}
                {` · ${fill(t('goal_alloc_day_short'), { day: g.allocation_day ?? 1 })}`}
              </div>
            )}
            {/* Estado da alocação deste mês: já alocado / por alocar / agendado */}
            {(() => {
              const status = fs.goalAllocationStatus[g.id];
              if (!status || status === 'none') return null;
              const done = status === 'done';
              return (
                <button
                  onClick={() => void (done ? fin.unmarkGoalAllocated(g.id) : fin.markGoalAllocated(g.id))}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    width: '100%',
                    padding: '9px 11px',
                    marginBottom: 6,
                    borderRadius: 'var(--rs)',
                    border: `1px solid ${done ? 'color-mix(in srgb, var(--gr) 35%, transparent)' : 'var(--b)'}`,
                    background: done ? 'color-mix(in srgb, var(--gr) 8%, transparent)' : 'var(--card2)',
                    cursor: 'pointer',
                    fontFamily: 'Manrope, sans-serif',
                    textAlign: 'left',
                  }}
                >
                  <span
                    style={{
                      width: 17,
                      height: 17,
                      borderRadius: 5,
                      flexShrink: 0,
                      border: done ? 'none' : '1.5px solid var(--tx3)',
                      background: done ? 'var(--gr)' : 'transparent',
                      color: 'var(--bg)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 11,
                      fontWeight: 900,
                    }}
                  >
                    {done ? '✓' : ''}
                  </span>
                  <span style={{ flex: 1, fontSize: 11.5, fontWeight: 700, color: done ? 'var(--gr)' : 'var(--tx)' }}>
                    {done ? t('goal_alloc_done') : status === 'due' ? t('goal_alloc_due') : t('goal_alloc_scheduled')}
                  </span>
                </button>
              );
            })()}
            <div style={{ display: 'flex', gap: 7, marginTop: 6 }}>
              <button className="pill-btn" onClick={() => openEdit(g)}>{t('goal_edit')}</button>
              {Number(g.current_eur) > 0 && (
                <button
                  className="pill-btn"
                  onClick={() => {
                    const raw = window.prompt(fill(t('goal_withdraw_prompt'), { max: fmtEur(Number(g.current_eur)) }));
                    const v = parseFloat((raw ?? '').replace(',', '.'));
                    if (v > 0) void fin.withdrawFromGoal(g.id, v);
                  }}
                >
                  {t('goal_withdraw')}
                </button>
              )}
              <button
                className="pill-btn"
                style={{ color: 'var(--re)', marginLeft: 'auto' }}
                onClick={() => {
                  if (window.confirm(fill(t('goal_delete_confirm'), { name: g.name }))) void fin.deleteGoal(g.id);
                }}
              >
                {t('goal_delete')}
              </button>
            </div>
          </div>
        );
      })}

      <button className="btn-primary" onClick={() => setForm(emptyForm())}>
        {t('goal_add')}
      </button>

      {/* Drawer nova/editar meta */}
      <Drawer open={form !== null} onClose={() => setForm(null)} title={form?.id ? t('goal_edit') : t('goal_add')}>
        {form && (
          <div className="card">
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 6 }}>
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 14,
                  background: 'color-mix(in srgb, var(--pr) 14%, transparent)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <GoalIcon iconKey={form.iconKey} size={24} />
              </div>
              <input className="auth-input" placeholder={t('goal_name')} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={{ flex: 1 }} />
            </div>

            <label style={label}>{t('goal_icon')}</label>
            <GoalIconPicker value={form.iconKey} onChange={(key) => setForm({ ...form, iconKey: key })} />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={label}>{t('goal_target')}</label>
                <input className="auth-input" type="number" inputMode="decimal" value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })} />
              </div>
              <div>
                <label style={label}>{t('goal_current')}</label>
                <input className="auth-input" type="number" inputMode="decimal" value={form.current} onChange={(e) => setForm({ ...form, current: e.target.value })} />
              </div>
            </div>

            <label style={label}>{t('goal_date')}</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <select className="auth-input" value={form.month} onChange={(e) => setForm({ ...form, month: Number(e.target.value) })}>
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>{monthName(i + 1)}</option>
                ))}
              </select>
              <select className="auth-input" value={form.year} onChange={(e) => setForm({ ...form, year: Number(e.target.value) })}>
                {Array.from({ length: 11 }, (_, i) => (
                  <option key={yearNow + i} value={yearNow + i}>{yearNow + i}</option>
                ))}
              </select>
            </div>

            <label style={label}>{t('goal_alloc_lbl')}</label>
            <input className="auth-input" type="number" inputMode="decimal" value={form.alloc} onChange={(e) => setForm({ ...form, alloc: e.target.value })} />

            <label style={label}>{t('goal_alloc_day_lbl')}</label>
            <select className="auth-input" value={form.allocDay} onChange={(e) => setForm({ ...form, allocDay: Number(e.target.value) })}>
              {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>{fill(t('goal_alloc_day_opt'), { day: d })}</option>
              ))}
            </select>
            <div style={{ fontSize: 10, color: 'var(--tx3)', marginTop: 4 }}>{t('goal_alloc_day_note')}</div>

            <button className="btn-primary" style={{ marginTop: 16 }} onClick={() => void submit()}>
              {t('goal_save')}
            </button>
            <button className="btn-secondary" style={{ marginTop: 8 }} onClick={() => setForm(null)}>
              {t('goal_cancel')}
            </button>
          </div>
        )}
      </Drawer>
    </>
  );
}
