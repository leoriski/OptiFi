// import-pdf — extrai as LINHAS visuais de um extrato PDF.
//
// O parser de extratos (`parsePdfStatementLines`) vive no monorepo e recebe
// linhas de texto; a extração "bytes → linhas" é que é cara e só corria na web.
// Esta função traz essa extração para junto da base de dados (o telemóvel
// também fica capaz de importar PDF), usando a build serverless do PDF.js da
// Mozilla (`unpdf/pdfjs`), feita para Deno/edge.
//
// AUTH: são exigidos um `Authorization: Bearer <access_token>` do utilizador
// (o mesmo JWT que a app usa para falar com o Supabase). O ficheiro nunca é
// guardado (minimização RGPD): entra, são devolvidas só as linhas, e morre.
//
// DEPLOY: `supabase functions deploy import-pdf --no-verify-jwt`
// (a validação do JWT é feita aqui, com `auth.getUser`).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getDocument } from 'https://esm.sh/unpdf@1.8.1/pdfjs';

const MAX_FILE_BYTES = 8 * 1024 * 1024; // igual ao limite da web e do mobile

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// ── Espelho de `packages/ingest/src/pdf-lines.ts` ──────────────────────────
// As Edge Functions não acedem aos workspaces do monorepo, por isso o
// algoritmo que junta fragmentos em linhas visuais é copiado aqui de
// propósito — quando mudar lá, tem de mudar aqui (o comportamento tem de ser
// o mesmo nas três frentes: web, edge, device).

interface TextFragment {
  x: number;
  y: number;
  str: string;
}

/** Tolerância em pontos: fragmentos a <3pt de altura são a mesma linha. */
const Y_TOLERANCE = 3;

/** Agrupa por Y (topo→fundo) e ordena por X dentro de cada linha. */
function rebuildPdfLines(pages: { items: TextFragment[] }[]): string[] {
  const lines: string[] = [];
  for (const page of pages) {
    const fragments = page.items.filter((f) => f.str.trim() !== '');
    fragments.sort((a, b) => b.y - a.y || a.x - b.x);
    let current: { y: number; parts: { x: number; str: string }[] } | null = null;
    const rows: { x: number; str: string }[][] = [];
    for (const f of fragments) {
      if (current === null || Math.abs(current.y - f.y) > Y_TOLERANCE) {
        current = { y: f.y, parts: [] };
        rows.push(current.parts);
      }
      current.parts.push({ x: f.x, str: f.str });
    }
    for (const parts of rows) {
      lines.push(parts.sort((a, b) => a.x - b.x).map((p) => p.str).join(' ').replace(/\s+/g, ' ').trim());
    }
  }
  return lines;
}

/** Offsets do marcador '%PDF' (alguns ficheiros trazem lixo à frente). */
function pdfContentStart(bytes: Uint8Array): number {
  const limit = Math.min(bytes.length - 4, 2048);
  for (let i = 0; i <= limit; i++) {
    if (bytes[i] === 0x25 && bytes[i + 1] === 0x50 && bytes[i + 2] === 0x44 && bytes[i + 3] === 0x46) return i;
  }
  return -1;
}

// Limite simplificado por utilizador (best-effort: a memória é por instância).
const rate = new Map<string, { count: number; at: number }>();
function rateLimited(userId: string): boolean {
  const now = Date.now();
  const r = rate.get(userId);
  if (!r || now - r.at > 60_000) {
    rate.set(userId, { count: 1, at: now });
    return false;
  }
  r.count += 1;
  return r.count > 10;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  // Só utilizadores autenticados — o token do próprio utilizador, validado
  // contra o Supabase (por isso o deploy usa `--no-verify-jwt`: a validação
  // acontece aqui, com a identidade do utilizador à vista).
  const authHeader = req.headers.get('authorization') ?? '';
  const jwt = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!jwt || !supabaseUrl || !supabaseAnonKey) return json({ error: 'unauthorized' }, 401);

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return json({ error: 'unauthorized' }, 401);
  if (rateLimited(user.id)) return json({ error: 'rate_limited' }, 429);

  // O mobile envia o ficheiro em FormData (o padrão nativo do React Native).
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return json({ error: 'bad_request' }, 400);
  }
  const file = form.get('file');
  if (!(file instanceof File)) return json({ error: 'no_file' }, 400);
  if (file.size === 0 || file.size > MAX_FILE_BYTES) return json({ error: 'file_size' }, 413);

  const bytes = new Uint8Array(await file.arrayBuffer());
  const start = pdfContentStart(bytes);
  if (start < 0) return json({ error: 'not_a_pdf' }, 422);

  // Corta lixo antes do '%PDF' (visto num extrato real do Santander) e extrai
  // os fragmentos com coordenadas — o mesmo acesso aos dados que a web usa.
  const pdfBytes = start === 0 ? bytes : bytes.slice(start);
  let doc;
  try {
    doc = await getDocument({ data: pdfBytes }).promise;
  } catch {
    return json({ error: 'pdf_unreadable' }, 422); // cifrado/digitalizado
  }

  const pages: { items: TextFragment[] }[] = [];
  for (let pageNo = 1; pageNo <= doc.numPages; pageNo++) {
    const page = await doc.getPage(pageNo);
    const content = await page.getTextContent();
    const items: TextFragment[] = [];
    for (const item of content.items) {
      if ('str' in item && (item.str as string).trim() !== '') {
        items.push({ x: item.transform[4] as number, y: item.transform[5] as number, str: item.str as string });
      }
    }
    pages.push({ items });
  }

  return json({ lines: rebuildPdfLines(pages) });
});