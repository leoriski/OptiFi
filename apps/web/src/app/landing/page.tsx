import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import { OptiFiLogo } from '@/components/AppHeader';
import './landing.css';

export const metadata: Metadata = {
  title: 'OptiFi — vê para onde vai o teu dinheiro',
  description:
    'Importa o extrato do teu banco e a OptiFi mostra as fugas, as subscrições esquecidas, quanto podes gastar até ao fim do mês e um plano de poupança com números. Sem ligar a conta bancária.',
  robots: { index: true, follow: true },
};

// Ecrãs reais da app (perfil de demonstração), capturados em 393×852.
type Shot = { src: string; alt: string };

const SHOTS = {
  home: { src: '/landing/home.png', alt: 'Início da OptiFi: quanto podes poupar por mês' },
  analise: { src: '/landing/analise.png', alt: 'Análise da OptiFi com sugestões de poupança' },
  metas: { src: '/landing/metas.png', alt: 'Metas da OptiFi com dinheiro reservado' },
  cashflow: { src: '/landing/cashflow.png', alt: 'Entradas e saídas do mês na OptiFi' },
  subscricoes: { src: '/landing/subscricoes.png', alt: 'Subscrições detetadas pela OptiFi' },
  plano: { src: '/landing/plano.png', alt: 'Plano de poupança da OptiFi' },
} satisfies Record<string, Shot>;

function Phone({ shot, className, priority }: { shot: Shot; className?: string; priority?: boolean }) {
  return (
    <div className={className ? `lp-phone ${className}` : 'lp-phone'}>
      <div className="lp-island" />
      <div className="lp-phone-screen">
        <Image src={shot.src} alt={shot.alt} width={786} height={1704} priority={priority} />
      </div>
    </div>
  );
}

function Check() {
  return (
    <svg className="lp-check" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="m5 13 4 4L19 7" />
    </svg>
  );
}

const TRUST = [
  {
    title: 'Sem ligar a conta bancária',
    text: 'Não pedimos credenciais do banco. Carregas o extrato que já podes descarregar do teu homebanking.',
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
  },
  {
    title: 'Dados na União Europeia',
    text: 'Base de dados alojada em Frankfurt. O ficheiro do extrato é lido e descartado — ficam só os movimentos.',
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3c2.5 2.7 2.5 15 0 18-2.5-3-2.5-15.3 0-18Z" />
      </svg>
    ),
  },
  {
    title: 'Contas, não conselhos',
    text: 'Todos os números vêm dos teus movimentos, com a conta à vista. Nada é inventado nem vendido a terceiros.',
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="3" width="16" height="18" rx="2" />
        <path d="M8 7h8M8 11h8M8 15h5" />
      </svg>
    ),
  },
];

const STEPS = [
  {
    title: 'Descarrega o extrato',
    text: 'CSV, XLSX ou PDF do teu banco — Revolut, CGD, Millennium, Santander e por aí fora. Um ficheiro, um mês.',
  },
  {
    title: 'A OptiFi lê e organiza',
    text: 'Reconhece o formato sozinha, categoriza os movimentos, separa as transferências e apanha as subscrições.',
  },
  {
    title: 'Segue o plano',
    text: 'Vês quanto podes cortar, quanto podes gastar por semana e o que isso faz às tuas metas. Repetes no mês seguinte.',
  },
];

const FAQ = [
  {
    q: 'Preciso de dar acesso ao meu banco?',
    a: 'Não. A OptiFi nunca se liga à tua conta bancária nem pede credenciais. Descarregas o extrato do homebanking e carrega-lo na app — é o mesmo ficheiro que já podes abrir no Excel.',
  },
  {
    q: 'Que bancos é que funcionam?',
    a: 'O leitor identifica o formato pelo conteúdo do ficheiro, não pelo nome do banco. Está testado com Revolut, Caixa Geral de Depósitos, Millennium BCP, Santander e corretoras como a Trade Republic ou a Trading 212, e aceita CSV, XLSX e PDF.',
  },
  {
    q: 'De onde vêm os valores que a app mostra?',
    a: 'De cálculo determinístico sobre os teus movimentos: soma de entradas e saídas, deteção de cobranças repetidas, comparação com o preço público dos planos das subscrições. Cada cartão explica a conta que fez — e nenhuma sugestão é conselho de investimento.',
  },
  {
    q: 'E se quiser sair?',
    a: 'Exportas tudo em JSON e apagas a conta a partir do Perfil. O apagamento é imediato e irreversível, sem pedidos por email nem períodos de espera.',
  },
  {
    q: 'Quanto custa?',
    a: 'A OptiFi está em beta fechado e é gratuita para quem entra nesta fase. Sem cartão, sem publicidade e sem venda de dados.',
  },
];

export default function LandingPage() {
  return (
    <div className="lp">
      <nav className="lp-nav">
        <div className="lp-wrap lp-nav-in">
          <div className="lp-brand">
            <OptiFiLogo size={24} />
            <span>OptiFi</span>
          </div>
          <div className="lp-nav-links">
            <a className="lp-nav-link" href="#funciona">Como funciona</a>
            <a className="lp-nav-link" href="#privacidade">Privacidade</a>
            <Link className="lp-nav-link" href="/login">Entrar</Link>
            <Link className="lp-btn lp-btn-primary" href="/signup">Criar conta</Link>
          </div>
        </div>
      </nav>

      <header className="lp-hero">
        <div className="lp-wrap">
          <span className="lp-badge">Beta fechado · Portugal</span>
          <h1 className="lp-h1">
            Vê para onde vai o teu dinheiro.
            <br />
            <em>E quanto podes poupar já este mês.</em>
          </h1>
          <p className="lp-sub">
            Carregas o extrato do teu banco e a OptiFi devolve a tua vida financeira organizada:
            fugas de dinheiro, subscrições esquecidas, quanto podes gastar até ao fim do mês e um
            plano de cortes com valores concretos.
          </p>
          <div className="lp-cta-row">
            <Link className="lp-btn lp-btn-primary lp-btn-lg" href="/signup">Criar conta grátis</Link>
            <a className="lp-btn lp-btn-ghost lp-btn-lg" href="#funciona">Ver como funciona</a>
          </div>
          <p className="lp-note">Sem ligação ao banco · Sem cartão · Dados alojados na UE</p>

          <div className="lp-phones">
            <Phone shot={SHOTS.analise} className="lp-phone-side" />
            <Phone shot={SHOTS.home} priority />
            <Phone shot={SHOTS.metas} className="lp-phone-side" />
          </div>
          <p className="lp-note">Ecrãs reais da app, com o perfil de demonstração.</p>

          <div className="lp-trust">
            {TRUST.map((t) => (
              <div className="lp-trust-item" key={t.title}>
                <div className="lp-ico">{t.icon}</div>
                <h3>{t.title}</h3>
                <p>{t.text}</p>
              </div>
            ))}
          </div>
        </div>
      </header>

      <main>
        <section className="lp-section" id="funcionalidades">
          <div className="lp-wrap">
            <div className="lp-feature">
              <div>
                <p className="lp-kicker">Quanto podes gastar</p>
                <h2 className="lp-h2">O saldo deixa de ser um número sem contexto</h2>
                <p className="lp-lead">
                  A OptiFi cruza o que entrou, o que saiu e o que já reservaste para as metas, e
                  responde à única pergunta que importa a meio do mês: quanto é que posso gastar
                  sem estragar nada?
                </p>
                <ul className="lp-list">
                  <li><Check /><span>Ritmo seguro por <b>semana e por dia</b>, atualizado a cada movimento que registas.</span></li>
                  <li><Check /><span>Entradas e saídas do mês em curso <b>comparadas com o mês fechado</b>.</span></li>
                  <li><Check /><span>Cartão refeição contado <b>à parte</b> do saldo da conta.</span></li>
                </ul>
              </div>
              <div className="lp-feature-media">
                <Phone shot={SHOTS.cashflow} />
              </div>
            </div>

            <div className="lp-feature lp-reverse">
              <div>
                <p className="lp-kicker">Subscrições</p>
                <h2 className="lp-h2">As que continuas a pagar sem dar por isso</h2>
                <p className="lp-lead">
                  A app apanha as cobranças que se repetem todos os meses, mostra-te o total e
                  pergunta uma coisa de cada vez: ainda usas? Cancelaste? O plano mais barato serve?
                </p>
                <ul className="lp-list">
                  <li><Check /><span>Deteção automática pelo <b>padrão de cobrança</b>, não por uma lista fixa de serviços.</span></li>
                  <li><Check /><span>Alternativas honestas: <b>plano mais barato, partilha ou opção gratuita</b>, com o preço de referência à vista.</span></li>
                  <li><Check /><span>Cancelaste? O valor <b>sai das contas do mês seguinte</b> automaticamente.</span></li>
                </ul>
              </div>
              <div className="lp-feature-media">
                <Phone shot={SHOTS.subscricoes} />
              </div>
            </div>

            <div className="lp-feature">
              <div>
                <p className="lp-kicker">Plano de poupança</p>
                <h2 className="lp-h2">Um plano com números, não com boas intenções</h2>
                <p className="lp-lead">
                  A partir do mês que analisaste, a OptiFi monta uma lista de cortes possíveis, cada
                  um com o valor que liberta por mês — e mostra-te o equivalente anual, para veres o
                  peso real da decisão.
                </p>
                <ul className="lp-list">
                  <li><Check /><span>Cortes ordenados <b>pelo que rendem</b>, com o cálculo explicado em cada linha.</span></li>
                  <li><Check /><span>Regra <b>50/30/20</b> aplicada aos teus números, não a uma média nacional.</span></li>
                  <li><Check /><span>Marcas o que já fizeste e o plano <b>reajusta-se</b>.</span></li>
                </ul>
              </div>
              <div className="lp-feature-media">
                <Phone shot={SHOTS.plano} />
              </div>
            </div>

            <div className="lp-feature lp-reverse">
              <div>
                <p className="lp-kicker">Metas</p>
                <h2 className="lp-h2">Poupar deixa de ser o que sobra ao fim do mês</h2>
                <p className="lp-lead">
                  Defines quanto reservas por mês para cada meta e esse dinheiro sai do &quot;livre
                  para gastar&quot;. A app diz-te, ao ritmo atual, em que mês é que lá chegas.
                </p>
                <ul className="lp-list">
                  <li><Check /><span>Projeção honesta: <b>a data a que chegas</b>, mesmo quando é depois do alvo.</span></li>
                  <li><Check /><span>Lembrete da <b>transferência real</b> — a app não mexe no teu dinheiro.</span></li>
                  <li><Check /><span>Levantar de uma meta é <b>um passo assumido</b>, com registo.</span></li>
                </ul>
              </div>
              <div className="lp-feature-media">
                <Phone shot={SHOTS.metas} />
              </div>
            </div>
          </div>
        </section>

        <section className="lp-section" id="funciona">
          <div className="lp-wrap">
            <p className="lp-kicker">Como funciona</p>
            <h2 className="lp-h2">Três passos, cerca de um minuto por mês</h2>
            <p className="lp-lead">
              Não há sincronizações a correr em segundo plano nem robôs a adivinhar o teu futuro.
              És tu que dás o extrato; a app faz as contas.
            </p>
            <div className="lp-steps">
              {STEPS.map((s, i) => (
                <div className="lp-step" key={s.title}>
                  <div className="lp-step-n">{i + 1}</div>
                  <h3>{s.title}</h3>
                  <p>{s.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="lp-section" id="privacidade">
          <div className="lp-wrap">
            <p className="lp-kicker">Privacidade</p>
            <h2 className="lp-h2">O teu extrato é teu</h2>
            <p className="lp-lead">
              Uma app de finanças pessoais vive da confiança. Estas são as regras — as mesmas que
              estão na política de privacidade, sem letra pequena.
            </p>
            <div className="lp-privacy">
              <div>
                <h3>Nunca pedimos credenciais do banco</h3>
                <p>Não há Open Banking nem acesso à tua conta. Só o ficheiro que tu carregas.</p>
              </div>
              <div>
                <h3>O ficheiro é descartado</h3>
                <p>Depois de lido, guardamos apenas os movimentos estruturados — data, descritivo, valor e categoria.</p>
              </div>
              <div>
                <h3>Servidores na UE</h3>
                <p>Base de dados na região de Frankfurt, com subcontratantes ao abrigo do RGPD.</p>
              </div>
              <div>
                <h3>Sem publicidade e sem venda de dados</h3>
                <p>Não criamos perfis para terceiros. Exportas tudo ou apagas a conta quando quiseres.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="lp-section" id="perguntas">
          <div className="lp-wrap">
            <p className="lp-kicker">Perguntas frequentes</p>
            <h2 className="lp-h2">O que costumam perguntar antes de entrar</h2>
            <div className="lp-faq">
              {FAQ.map((f) => (
                <details key={f.q}>
                  <summary>{f.q}</summary>
                  <p>{f.a}</p>
                </details>
              ))}
            </div>

            <div className="lp-final">
              <h2 className="lp-h2">Começa pelo mês passado</h2>
              <p className="lp-lead">
                Um extrato chega para veres o que se passou e quanto podias ter poupado. Se não
                gostares do que vês, apagas a conta em dois toques.
              </p>
              <div className="lp-cta-row">
                <Link className="lp-btn lp-btn-primary lp-btn-lg" href="/signup">Criar conta grátis</Link>
                <Link className="lp-btn lp-btn-ghost lp-btn-lg" href="/login">Já tenho conta</Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="lp-wrap lp-footer">
        <span>© {new Date().getFullYear()} OptiFi · Beta fechado</span>
        <span>
          <Link href="/privacidade">Privacidade</Link>
          <Link href="/termos">Termos</Link>
          <a href="mailto:synamade12@gmail.com">Contacto</a>
        </span>
      </footer>
    </div>
  );
}
