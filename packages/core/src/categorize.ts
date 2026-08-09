import type { CategoryKey } from './types.js';

interface MerchantRule {
  key: CategoryKey;
  patterns: string[];
}

/**
 * Normaliza para comparação: minúsculas, SEM acentos e espaços colapsados.
 * Os extratos vêm em MAIÚSCULAS e sem acentos ("CLINICA", "CAFE", "FARMACIA"),
 * por isso os padrões abaixo são escritos sem acentos e o input é normalizado.
 */
function norm(s: string): string {
  return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
}

// Ordenado — a primeira correspondência ganha. Regras que podem colidir ficam
// antes: 'uber eats' (comida) e 'uber one' (subscrição) precedem 'uber'
// (transporte); a categoria vem sempre do que o descritivo revela.
export const MERCHANT_RULES: MerchantRule[] = [
  // Rendimento verdadeiro. Vem primeiro para que um ordenado pago por
  // transferência ("TRF CRED SEPA+ ORDENADO DE …") nunca seja confundido com
  // uma transferência entre pessoas.
  { key: 'receita', patterns: ['salario', 'vencimento', 'venc ', 'ordenado', 'reembolso', 'subsidio', 'pensao', 'salary', 'payroll', 'trf cred sepa', 'transferencia recebida'] },

  // Transferências entre PESSOAS: dinheiro que apenas circula — nem consumo
  // nem rendimento — em QUALQUER direção. O MB WAY e a transferência imediata
  // são instrumentos pessoa-a-pessoa (um ordenado chega sempre por
  // 'TRF CRED SEPA', nunca por aqui), por isso contam nos dois sentidos.
  { key: 'transferencias', patterns: ['trf.imed. p/', 'trf.imed. de', 'trf imediata p', 'trf. p/o', 'trf p/', 'transferencia p/', 'transferencia para', 'trf mb way', 'trf mbway', 'mb way p/', 'mb way de', 'mb way recebido'] },

  // Alimentação = comida ESSENCIAL (supermercado/mercearia). Comer fora é lazer.
  { key: 'alimentacao', patterns: ['pingo doce', 'continente', 'lidl', 'aldi', 'intermarche', 'minipreco', 'auchan', 'jumbo', 'mercadona', 'el corte ingles', 'supermercado', 'mercado', 'frutaria', 'talho', 'mercearia', 'padaria'] },
  // Restauração / fast-food / delivery = saídas → LAZER (pedido do produto:
  // "se forem saídas para restaurantes isso vai para lazer")
  { key: 'lazer', patterns: ['mcdonald', 'mc donald', 'donalds', 'burger king', 'kfc', 'pizza hut', 'telepizza', 'dominos', 'nando', 'starbucks', 'uber eats', 'ubereats', 'glovo', 'bolt food', 'boltfood', 'h3', 'vitaminas', 'go natural', 'wok', 'sushi', 'kebab', 'doner', 'poke', 'pastelaria', 'confeitaria', 'restaurante', 'restaurant', 'tasca', 'tasquinha', 'churrasqueira', 'marisqueira', 'cervejaria', 'snack', 'bar ', 'cafe', 'pizzaria', 'pizaria', 'hamburgueria', 'gelataria', 'conf ', 'conf.'] },

  // Subscrições (antes de transporte por causa do "uber one")
  { key: 'subscricoes', patterns: ['uber one', 'uber *one', 'one membership', 'bolt plus'] },
  { key: 'subscricoes', patterns: ['itunes', 'itunesappst', 'apple.com', 'apple bill', 'apple store', 'app store', 'appstore', 'icloud', 'apple music', 'apple tv', 'apple one', 'apple', 'aci*apple'] },
  { key: 'subscricoes', patterns: ['netflix', 'hbo', 'max.com', 'disney', 'prime video', 'skyshowtime', 'paramount', 'crunchyroll', 'dazn', 'filmin', 'opto', 'sport tv', 'sporttv', 'youtube'] },
  { key: 'subscricoes', patterns: ['spotify', 'tidal', 'deezer', 'soundcloud'] },
  { key: 'subscricoes', patterns: ['google', 'google storage', 'google one', 'dropbox', 'onedrive', 'microsoft', 'office 365', 'microsoft 365', 'notion', 'canva', 'adobe', 'chatgpt', 'openai', 'linkedin', 'patreon', 'twitch'] },
  { key: 'subscricoes', patterns: ['nordvpn', 'surfshark', 'expressvpn', 'proton'] },
  { key: 'subscricoes', patterns: ['playstation', 'ps plus', 'psn', 'xbox', 'game pass', 'nintendo', 'ea play', 'steam'] },
  { key: 'subscricoes', patterns: ['duolingo', 'babbel', 'amazon prime', 'prime pt'] },
  // Ginásios (é uma subscrição mensal) — cadeias presentes em Portugal
  { key: 'subscricoes', patterns: ['ginasio', 'gym', 'fitness hut', 'fitness up', 'fitness factory', 'holmes place', 'solinca', 'phive', 'vivafit', 'virgin active', 'mcfit', 'basic-fit', 'basic fit', 'fit4', 'get fit', 'bodyscience', 'go fit', 'gofit', 'kalorias', 'crossfit', 'evo fitness', 'up fitness', 'pump ', 'class studio', 'well fitness', 'wellhub', 'gympass'] },

  // Transporte
  { key: 'transporte', patterns: ['uber', 'bolt', 'lime', 'tier', 'cabify', 'free now', 'freenow', 'taxi'] },
  { key: 'transporte', patterns: ['comboios', ' cp ', 'cp ', 'fertagus', 'metro', 'metrobus', 'carris', 'stcp', 'transtejo', 'soflusa', 'rede expressos', 'flixbus', 'transdev', 'barraqueiro'] },
  { key: 'transporte', patterns: ['via verde', 'viaverde', 'parque', 'parking', 'parkia', 'empark', 'saba', 'estacionamento'] },
  { key: 'transporte', patterns: ['galp', 'bp ', 'repsol', 'cepsa', 'prio', 'gasolineira', 'combustivel', 'abastecimento'] },

  // Educação
  { key: 'educacao', patterns: ['isla', 'iscap', 'universidade', 'faculdade', 'instituto politecnico', 'politecnico', 'colegio', 'escola', 'externato', 'propina', 'propinas', 'explicacoes', 'explicacao', 'centro de estudos', 'creche', 'infantario', 'jardim de infancia', 'isep', 'feup', 'fep ', 'ipl', 'ipp ', 'universia', 'udemy', 'coursera'] },

  // Saúde
  { key: 'saude', patterns: ['farmacia', 'wells', 'clinica', 'hospital', 'medico', 'dentaria', 'dentista', 'dental', 'estomatologia', 'analises clinicas', 'laboratorio', 'fisioterapia', 'oculista', 'optica', 'multiopticas', 'consulta', 'saude', 'lusiadas', 'cuf ', 'trofa saude', 'luz saude', 'seguro saude'] },

  // Habitação
  { key: 'habitacao', patterns: ['renda', 'senhorio', 'condominio', 'imobiliaria'] },
  { key: 'habitacao', patterns: ['edp', 'galp energia', 'endesa', 'iberdrola', 'goldenergy', 'luzboa', 'gas natural'] },
  { key: 'habitacao', patterns: ['nos ', 'nos comunicacoes', 'meo', 'nowo', 'vodafone', 'digi '] },
  { key: 'habitacao', patterns: ['aguas', 'epal', 'aguas do porto', 'smas', 'indaqua', 'camara municipal'] },

  // Lazer / compras
  { key: 'lazer', patterns: ['cinema', 'uci', 'nos cinemas', 'cinemas'] },
  { key: 'lazer', patterns: ['fnac', 'worten', 'mediamarkt', 'radio popular'] },
  { key: 'lazer', patterns: ['sport zone', 'decathlon', 'sports direct', 'sportsdirect'] },
  { key: 'lazer', patterns: ['zara', 'h&m', 'primark', 'springfield', 'lefties', 'pull&bear', 'pull and bear', 'bershka', 'stradivarius', 'snipes', 'jd sports', 'sport direct', 'nike', 'adidas'] },
  { key: 'lazer', patterns: ['ticketline', 'blueticket', 'see tickets'] },
];

/** Substring match (sem acentos) contra a lista ordenada; desconhecidos → outros. */
export function categorizeMerchant(name: string): CategoryKey {
  const lower = norm(name);
  for (const rule of MERCHANT_RULES) {
    for (const pat of rule.patterns) {
      if (lower.includes(pat)) return rule.key;
    }
  }
  return 'outros';
}
