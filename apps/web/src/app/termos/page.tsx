import Link from 'next/link';

export const metadata = { title: 'Termos de Utilização — OptiFi' };

const h2: React.CSSProperties = { fontSize: 15, fontWeight: 800, margin: '22px 0 8px' };
const p: React.CSSProperties = { fontSize: 13, lineHeight: 1.65, color: 'var(--tx2)', margin: '0 0 10px' };

export default function TermsPage() {
  return (
    <main style={{ maxWidth: 640, margin: '0 auto', padding: '32px 20px 60px' }}>
      <h1 style={{ fontSize: 22, fontWeight: 900, marginBottom: 4 }}>Termos de Utilização</h1>
      <p style={{ ...p, color: 'var(--tx3)', fontSize: 11 }}>
        Última atualização: julho de 2026 · Versão beta — documento sujeito a revisão legal antes do lançamento público.
      </p>

      <h2 style={h2}>1. O serviço</h2>
      <p style={p}>
        A OptiFi é uma ferramenta de gestão de finanças pessoais: analisa extratos bancários que tu
        importas, ajuda-te a controlar despesas, subscrições, limites e metas de poupança. O
        serviço está em <b>beta fechado</b>: pode ter erros, mudar ou ficar indisponível sem aviso.
      </p>

      <h2 style={h2}>2. Não é aconselhamento financeiro</h2>
      <p style={p}>
        A OptiFi não presta aconselhamento financeiro, de investimento, fiscal ou jurídico. Os
        números e sugestões são estimativas informativas calculadas a partir dos dados que
        importas — as decisões financeiras são sempre tuas. A OptiFi não é uma instituição
        financeira, não movimenta dinheiro e não tem acesso às tuas contas bancárias.
      </p>

      <h2 style={h2}>3. A tua conta</h2>
      <p style={p}>
        És responsável por manter as credenciais seguras (recomendamos ativar a autenticação em
        dois passos no Perfil) e pela veracidade dos dados que importas. A conta é pessoal e
        intransmissível. Podes apagá-la a qualquer momento, com eliminação total dos dados.
      </p>

      <h2 style={h2}>4. Utilização aceitável</h2>
      <p style={p}>
        Não uses o serviço para fins ilegais, para carregar dados de terceiros sem autorização, ou
        para tentar comprometer a segurança da plataforma.
      </p>

      <h2 style={h2}>5. Responsabilidade</h2>
      <p style={p}>
        Na máxima medida permitida por lei, o serviço é fornecido &quot;tal como está&quot;, sem
        garantias. Não nos responsabilizamos por decisões tomadas com base nas análises da app nem
        por indisponibilidades do serviço durante o beta.
      </p>

      <h2 style={h2}>6. Alterações e lei aplicável</h2>
      <p style={p}>
        Podemos atualizar estes termos, notificando-te das alterações relevantes. Aplica-se a lei
        portuguesa; foro da comarca de Lisboa.
      </p>

      <div style={{ marginTop: 28 }}>
        <Link href="/login" style={{ fontSize: 13, color: 'var(--pr)', fontWeight: 700, textDecoration: 'none' }}>
          ← Voltar à OptiFi
        </Link>
      </div>
    </main>
  );
}
