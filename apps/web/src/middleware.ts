import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

type CookieToSet = { name: string; value: string; options?: CookieOptions };

// Rotas acessíveis sem sessão. Tudo o resto exige utilizador autenticado.
const PUBLIC_PATHS = ['/login', '/signup', '/forgot', '/update-password', '/verify', '/auth', '/privacidade', '/termos'];
// Recursos que têm de ser acessíveis sem sessão: o service worker (ficheiro
// estático) e o job de lembretes (protegido pelo próprio CRON_SECRET).
const PUBLIC_EXACT = ['/sw.js', '/api/cron/reminders'];

function isPublic(pathname: string): boolean {
  if (PUBLIC_EXACT.includes(pathname)) return true;
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Obrigatório entre createServerClient e qualquer lógica: refresca a sessão.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (!user && !isPublic(pathname)) {
    // APIs recebem 401 JSON; páginas são redirecionadas para o login.
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  if (user && (pathname === '/login' || pathname === '/signup')) {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }

  // 2FA: quem tem um fator TOTP verificado não passa do nível aal1 —
  // qualquer rota protegida exige completar o desafio em /mfa primeiro.
  if (user && !isPublic(pathname) && pathname !== '/mfa') {
    const hasVerifiedFactor = (user.factors ?? []).some((f) => f.status === 'verified');
    if (hasVerifiedFactor) {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      let aal = 'aal1';
      if (token) {
        try {
          aal = (JSON.parse(atob(token.split('.')[1]!)) as { aal?: string }).aal ?? 'aal1';
        } catch {
          /* token ilegível → trata como aal1 */
        }
      }
      if (aal !== 'aal2') {
        if (pathname.startsWith('/api/')) {
          return NextResponse.json({ error: 'mfa_required' }, { status: 401 });
        }
        const url = request.nextUrl.clone();
        url.pathname = '/mfa';
        return NextResponse.redirect(url);
      }
    }
  }

  // Onboarding: o registo/login aterra em '/'. Se o utilizador ainda não
  // importou nenhum extrato, enviamo-lo direto para o wizard de importação — o
  // passo que dá vida à app — em vez de um Início vazio. Redirecionamento suave
  // (só na home): as outras páginas continuam livres para explorar, e a query
  // extra corre apenas nesta rota.
  if (user && pathname === '/' && request.cookies.get('optifi_demo')?.value !== '1') {
    const { data: firstImport } = await supabase.from('imports').select('id').limit(1);
    if (!firstImport || firstImport.length === 0) {
      const url = request.nextUrl.clone();
      url.pathname = '/atividade';
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
};
