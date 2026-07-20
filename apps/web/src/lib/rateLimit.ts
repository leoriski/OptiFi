// Rate limiting simples em memória, por chave (utilizador). Suficiente para
// proteger endpoints caros em dev/beta num único processo; em produção
// serverless cada instância tem o seu contador — proteção básica, não
// garantia absoluta (o hard limit real vem das quotas do Supabase).

const buckets = new Map<string, number[]>();

export function rateLimit(key: string, maxHits: number, windowMs: number): boolean {
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= maxHits) {
    buckets.set(key, hits);
    return false;
  }
  hits.push(now);
  buckets.set(key, hits);
  return true;
}
