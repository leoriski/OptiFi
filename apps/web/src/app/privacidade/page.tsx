import Link from 'next/link';

export const metadata = { title: 'Política de Privacidade — OptiFi' };

const h2: React.CSSProperties = { fontSize: 15, fontWeight: 800, margin: '22px 0 8px' };
const p: React.CSSProperties = { fontSize: 13, lineHeight: 1.65, color: 'var(--tx2)', margin: '0 0 10px' };

export default function PrivacyPage() {
  return (
    <main style={{ maxWidth: 640, margin: '0 auto', padding: '32px 20px 60px' }}>
      <h1 style={{ fontSize: 22, fontWeight: 900, marginBottom: 4 }}>Política de Privacidade</h1>
      <p style={{ ...p, color: 'var(--tx3)', fontSize: 11 }}>
        Última atualização: julho de 2026 · Versão beta — documento sujeito a revisão legal antes do lançamento público.
      </p>

      <h2 style={h2}>1. Quem é responsável</h2>
      <p style={p}>
        A OptiFi é, nesta fase de beta fechado, operada a título individual pelo seu criador (o
        &quot;Responsável pelo Tratamento&quot;). Contacto para questões de privacidade:{' '}
        <a href="mailto:synamade12@gmail.com" style={{ color: 'var(--pr)' }}>synamade12@gmail.com</a>.
      </p>

      <h2 style={h2}>2. Que dados tratamos</h2>
      <p style={p}>
        (a) Dados de conta: email, nome e palavra-passe (guardada de forma cifrada e irreversível).
        (b) Dados financeiros que tu próprio importas: os movimentos dos extratos bancários que
        carregas (data, descritivo, valor, categoria), e os dados que registas na app (metas,
        limites, movimentos manuais). O ficheiro do extrato é processado e <b>descartado</b> — só os
        movimentos estruturados ficam guardados. Não temos acesso às tuas contas bancárias.
      </p>

      <h2 style={h2}>3. Para que os usamos e com que base legal</h2>
      <p style={p}>
        Exclusivamente para prestar o serviço: analisar as tuas finanças,
        detetar subscrições e fugas, e gerir metas. Base legal: execução do contrato (art. 6.º/1/b
        RGPD). Não vendemos dados, não fazemos publicidade, não criamos perfis para terceiros.
      </p>

      <h2 style={h2}>4. Onde ficam os dados</h2>
      <p style={p}>
        Na União Europeia: base de dados alojada na Supabase (região Frankfurt, Alemanha) e
        aplicação servida pela Vercel. Ambos atuam como subcontratantes com acordos de tratamento
        de dados (DPA) conformes ao RGPD.
      </p>

      <h2 style={h2}>5. Quanto tempo guardamos</h2>
      <p style={p}>
        Enquanto a tua conta existir. Ao apagares a conta, todos os dados são eliminados de forma
        imediata e irreversível.
      </p>

      <h2 style={h2}>6. Os teus direitos</h2>
      <p style={p}>
        Acesso, retificação, portabilidade, apagamento, limitação e oposição. Os dois mais
        importantes estão na própria app (Perfil → Segurança e dados): <b>exportar os teus dados</b>{' '}
        em JSON e <b>apagar a conta</b>. Para os restantes, escreve-nos. Tens ainda o direito de
        apresentar queixa à CNPD (cnpd.pt).
      </p>

      <h2 style={h2}>7. Cookies</h2>
      <p style={p}>
        Usamos apenas cookies essenciais de sessão (autenticação) e uma preferência de idioma.
        Sem cookies de publicidade ou rastreamento.
      </p>

      <div style={{ marginTop: 28 }}>
        <Link href="/login" style={{ fontSize: 13, color: 'var(--pr)', fontWeight: 700, textDecoration: 'none' }}>
          ← Voltar à OptiFi
        </Link>
      </div>
    </main>
  );
}
