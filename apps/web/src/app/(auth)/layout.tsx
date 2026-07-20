// Visível apenas enquanto o .env.local tiver os placeholders — evita que um
// "Failed to fetch" pareça um bug quando é configuração em falta.
function ConfigWarning() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  if (url !== '' && !url.includes('placeholder')) return null;
  return (
    <div
      style={{
        marginBottom: 14,
        padding: '12px 14px',
        borderRadius: 10,
        background: 'rgba(245,158,11,.12)',
        border: '1px solid rgba(245,158,11,.35)',
        color: '#F59E0B',
        fontSize: 12,
        fontWeight: 700,
        lineHeight: 1.5,
      }}
    >
      ⚠️ Configuração em falta: apps/web/.env.local ainda tem valores de exemplo.
      Preenche NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY com os
      valores do teu projeto Supabase e reinicia o servidor. Nenhum login ou
      registo funciona até isso estar feito.
    </div>
  );
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main
      style={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      <div style={{ width: '100%', maxWidth: 400 }}>
        <ConfigWarning />
        {children}
      </div>
    </main>
  );
}
