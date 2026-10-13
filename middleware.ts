import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import {
  AUTH_PROFILE_COLUMNS,
  ADMIN_DASHBOARD_PATH,
  LOGIN_PATH,
  PENDING_PATH,
  buildAuthProfile,
  canAccessCoiffeurSpace,
  destinationFor,
  isAdmin,
} from "./lib/authRules";

// Contrôle d'accès serveur, avant tout rendu :
//   /admin, /admin/dashboard → l'administrateur unique (ADMIN_EMAIL) uniquement
//   /admin/{id}[/…]          → le coiffeur {id}, connecté, approuvé, abonnement valide
//   /auth/pending            → tout utilisateur connecté (page d'attente)
// Non connecté → /auth/login.
export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return NextResponse.next();

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet: { name: string; value: string; options: CookieOptions }[]) => {
        // Propage les jetons rafraîchis à la requête ET à la réponse
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // getUser() valide le jeton auprès de Supabase Auth (getSession ne le ferait pas)
  const { data: { user } } = await supabase.auth.getUser();

  const redirectTo = (path: string) => {
    const target = request.nextUrl.clone();
    target.pathname = path;
    target.search = "";
    const redirect = NextResponse.redirect(target);
    // Conserver les cookies de session éventuellement rafraîchis
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  };

  if (!user) return redirectTo(LOGIN_PATH);

  const { data } = await supabase
    .from("profiles")
    .select(AUTH_PROFILE_COLUMNS)
    .eq("id", user.id)
    .maybeSingle();
  const profile = buildAuthProfile(user, data);

  // Session valide mais aucun profil (inscription incomplète, client Google…)
  if (!profile) return redirectTo(LOGIN_PATH);

  const { pathname } = request.nextUrl;

  if (pathname === PENDING_PATH) {
    const destination = destinationFor(profile);
    return destination === PENDING_PATH ? response : redirectTo(destination);
  }

  const segments = pathname.split("/").filter(Boolean); // ["admin", espace?, ...reste]
  const space = segments[1];

  // ── /admin et /admin/dashboard : administrateur unique ──
  if (!space || space === "dashboard") {
    if (!isAdmin(profile)) return redirectTo(destinationFor(profile));
    // /admin n'a pas de page : envoyer l'admin sur son dashboard
    return space ? response : redirectTo(ADMIN_DASHBOARD_PATH);
  }

  // ── /admin/{id}/… : espace coiffeur (l'admin est renvoyé à son dashboard) ──
  if (!canAccessCoiffeurSpace(profile)) return redirectTo(destinationFor(profile));

  // Un coiffeur ne voit que son propre espace (l'URL peut porter l'id ou le nom)
  const ownsSpace = space === profile.id || space.toLowerCase() === profile.name?.toLowerCase();
  if (!ownsSpace) {
    return redirectTo(["", "admin", profile.id, ...segments.slice(2)].join("/"));
  }

  return response;
}

export const config = {
  matcher: ["/admin", "/admin/:path*", "/auth/pending"],
};
