// Catálogo de serviços de subscrição conhecidos no mercado português, com
// opções de poupança HONESTAS (portado do protótipo): plano mais barato do
// MESMO serviço, partilha em plano família/grupo, ou alternativa gratuita
// (assumidamente um serviço diferente). Preços de referência (meados de 2026)
// — a UI deve tratá-los como estimativas, não como cotações.

export interface CheaperPlan {
  name: string;
  price: number;
}

export interface ShareOption {
  perPerson: number;
}

export interface FreeAlternative {
  name: string;
  /** true quando é o MESMO serviço em escalão gratuito (ex.: Spotify Free). */
  sameService: boolean;
}

export interface CatalogEntry {
  key: string;
  /** Nome apresentável (limpo) do serviço — o que a app mostra. */
  label: string;
  /** Substrings (minúsculas) que identificam o serviço no descritivo. */
  patterns: string[];
  /** Tipo de serviço — usado para detetar duplicados da mesma categoria. */
  kind: 'streaming' | 'music' | 'vpn' | 'productivity' | 'learning' | 'design' | 'shopping' | 'delivery';
  /** É um serviço de streaming de vídeo (para deteção de sobreposição). */
  streaming: boolean;
  cancelUrl?: string;
  cheaperPlan?: CheaperPlan;
  share?: ShareOption;
  freeAlt?: FreeAlternative;
}

export const SUBSCRIPTION_CATALOG: CatalogEntry[] = [
  {
    key: 'netflix',
    label: 'Netflix',
    kind: 'streaming',
    patterns: ['netflix'],
    streaming: true,
    cancelUrl: 'https://www.netflix.com/cancelplan',
    cheaperPlan: { name: 'Netflix com anúncios', price: 5.49 },
    share: { perPerson: 4.75 },
    freeAlt: { name: 'RTP Play', sameService: false },
  },
  {
    key: 'spotify',
    label: 'Spotify',
    kind: 'music',
    patterns: ['spotify'],
    streaming: false,
    cancelUrl: 'https://www.spotify.com/pt/account/subscription/cancel/',
    share: { perPerson: 3.0 },
    freeAlt: { name: 'Spotify Free', sameService: true },
  },
  {
    key: 'amazon_prime',
    label: 'Prime Video',
    kind: 'shopping',
    patterns: ['amazon prime', 'prime video'],
    streaming: true,
    cancelUrl: 'https://www.amazon.es/gp/primecentral',
    cheaperPlan: { name: 'Prime anual (€49,90/ano)', price: 4.16 },
    share: { perPerson: 4.5 },
  },
  {
    key: 'max',
    label: 'HBO Max',
    kind: 'streaming',
    patterns: ['hbo', 'max.com', ' max'],
    streaming: true,
    cancelUrl: 'https://www.max.com/pt/pt/account',
    cheaperPlan: { name: 'Max Standard com anúncios', price: 5.99 },
    share: { perPerson: 4.5 },
    freeAlt: { name: 'RTP Play', sameService: false },
  },
  {
    key: 'disney',
    label: 'Disney+',
    kind: 'streaming',
    patterns: ['disney'],
    streaming: true,
    cheaperPlan: { name: 'Disney+ Standard com anúncios', price: 5.99 },
    share: { perPerson: 4.5 },
  },
  {
    key: 'youtube',
    label: 'YouTube Premium',
    kind: 'streaming',
    patterns: ['youtube'],
    streaming: true,
    share: { perPerson: 4.33 },
    freeAlt: { name: 'YouTube com anúncios', sameService: true },
  },
  {
    key: 'adobe',
    label: 'Adobe',
    kind: 'design',
    patterns: ['adobe'],
    streaming: false,
    cancelUrl: 'https://account.adobe.com/plans',
    cheaperPlan: { name: 'Plano de app única', price: 12.09 },
    freeAlt: { name: 'GIMP + Inkscape', sameService: false },
  },
  {
    key: 'nordvpn',
    label: 'NordVPN',
    kind: 'vpn',
    patterns: ['nordvpn'],
    streaming: false,
    cancelUrl: 'https://my.nordaccount.com/dashboard/nordvpn/',
    cheaperPlan: { name: 'Plano 2 anos', price: 3.09 },
    share: { perPerson: 2.7 },
    freeAlt: { name: 'Proton VPN Free', sameService: false },
  },
  {
    key: 'notion',
    label: 'Notion',
    kind: 'productivity',
    patterns: ['notion'],
    streaming: false,
    freeAlt: { name: 'Notion Free', sameService: true },
  },
  {
    key: 'duolingo',
    label: 'Duolingo',
    kind: 'learning',
    patterns: ['duolingo'],
    streaming: false,
    cheaperPlan: { name: 'Super anual (€49,99/ano)', price: 4.17 },
    share: { perPerson: 1.67 },
    freeAlt: { name: 'Duolingo Free', sameService: true },
  },
  {
    key: 'uber_one',
    label: 'Uber One',
    kind: 'delivery',
    patterns: ['uber one', 'uber *one', 'one membership'],
    streaming: false,
    // O Uber One é um extra opcional: cancela-o e continuas a usar a Uber/Uber
    // Eats normalmente — poupas o valor todo.
    freeAlt: { name: 'Usar a Uber sem subscrição', sameService: true },
  },
  {
    key: 'apple',
    label: 'Apple / iTunes',
    kind: 'productivity',
    patterns: ['itunes', 'itunesappst', 'apple.com', 'app store', 'appstore', 'apple bill', 'apple music', 'apple one', 'icloud'],
    streaming: false,
    // Sem opção automática: a cobrança Apple pode ser iCloud/Apple Music/One/uma
    // app — o honesto é rever e cancelar o que não se usa (fica como alerta).
  },
];

/** Encontra a entrada do catálogo para um nome de subscrição detetada. */
export function matchCatalog(subName: string): CatalogEntry | null {
  const lower = subName.toLowerCase();
  for (const entry of SUBSCRIPTION_CATALOG) {
    if (entry.patterns.some((p) => lower.includes(p))) return entry;
  }
  return null;
}

/**
 * Nome apresentável de um comerciante/subscrição a partir do descritivo cru do
 * banco: se estiver no catálogo, usa o rótulo oficial ("Uber One", "Apple /
 * iTunes"); senão limpa o lixo do POS ("COMPRA ESTRANG*5297", "PAYPAL *",
 * cartões *5297, códigos) e capitaliza. Nunca devolve vazio.
 */
/** Marcadores de lixo de terminal/POS — só aí se limpa e recapitaliza. */
const POS_JUNK = /\b(compra|estrang|estrangeiro|pagamento|pagam|mb\s*way|mbway|paypal|sepa|dd|numerario)\b|\*\d|#\d|\b\d{4,}\b|^\s*\d{1,3}\s+\S/i;

export function prettyMerchant(raw: string): string {
  const entry = matchCatalog(raw || '');
  if (entry) return entry.label;
  const orig = (raw || '').replace(/\s+/g, ' ').trim();
  // Nome já limpo (sem lixo de POS) → mantém tal e qual (não mexe em maiúsculas).
  if (orig === '' || !POS_JUNK.test(orig)) return orig || 'Movimento';
  let s = orig
    .replace(/\*\d+/g, ' ') // cartões / refs *5297
    .replace(/#\d+/g, ' ')
    .replace(/\b(compra|estrang|estrangeiro|pagamento|pagam|pag|trf|mb\s*way|mbway|paypal|sepa|debito directo|debito direto|dd|lev|levantamento|numerario)\b/gi, ' ')
    .replace(/\b\d{4,}\b/g, ' ') // ids/terminais longos
    .replace(/^\s*\d{1,3}\s+/, '') // código curto à cabeça ("18 FITNESS…")
    .replace(/[*#/|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (s === '') s = orig;
  s = s
    .toLowerCase()
    .split(' ')
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(' ');
  return s.slice(0, 32).trim() || 'Movimento';
}

/** Tipo de serviço, incluindo os que não têm entrada no catálogo. */
export type ServiceKind = CatalogEntry['kind'] | 'fitness' | 'gaming';

/**
 * Palavras-chave (minúsculas) para inferir o tipo de serviços FORA do
 * catálogo — é isto que liga "Skydance" ou "Filmin" ao grupo de televisão.
 * As com espaços à volta exigem palavra isolada para evitar falsos positivos.
 */
const KIND_KEYWORDS: [ServiceKind, string[]][] = [
  ['streaming', ['skydance', 'skyshowtime', 'paramount', 'apple tv', 'appletv', 'dazn', 'filmin', 'crunchyroll', 'mubi', 'opto', 'pluto tv', 'sport tv', 'sporttv', 'meo go', 'tv+', ' tv ', 'video', 'stream']],
  ['music', ['tidal', 'deezer', 'apple music', 'music', 'audible']],
  ['vpn', ['vpn', 'surfshark', 'mullvad', 'cyberghost']],
  ['gaming', ['game pass', 'gamepass', 'playstation', 'ps plus', 'psn', 'nintendo', 'xbox', 'ea play']],
  ['fitness', ['gym', 'ginásio', 'ginasio', 'fitness', 'fit4', 'wellhub', 'urban sports', 'holmes place', 'solinca', 'phive', 'vivafit', 'virgin active', 'mcfit', 'basic-fit', 'basic fit', 'kalorias', 'go fit', 'gofit', 'bodyscience', 'crossfit']],
  ['productivity', ['microsoft 365', 'office 365', 'google one', 'dropbox', 'icloud', 'evernote', 'todoist', 'chatgpt', 'openai']],
  ['learning', ['udemy', 'coursera', 'babbel', 'skillshare', 'masterclass']],
  ['design', ['canva', 'figma']],
];

/**
 * Tipo de serviço de uma subscrição, catálogo primeiro, palavras-chave depois.
 * Nota: serviços do catálogo com streaming=true contam como 'streaming' aqui
 * (o Prime Video é 'shopping' no catálogo, mas para duplicados é televisão).
 */
export function inferKind(subName: string): ServiceKind | null {
  const entry = matchCatalog(subName);
  if (entry) return entry.streaming ? 'streaming' : entry.kind;
  const padded = ` ${subName.toLowerCase()} `;
  for (const [kind, keywords] of KIND_KEYWORDS) {
    if (keywords.some((k) => padded.includes(k))) return kind;
  }
  return null;
}
