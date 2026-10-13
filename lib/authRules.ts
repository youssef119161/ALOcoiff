// Règles d'accès pures (aucune dépendance navigateur) : partagées entre le
// middleware Next.js (serveur), les routes API et les pages (client).

export const LOGIN_PATH = "/auth/login";
export const PENDING_PATH = "/auth/pending";
export const ADMIN_DASHBOARD_PATH = "/admin/dashboard";

// Seul compte administrateur de la plateforme. L'e-mail est celui du compte
// Supabase Auth (vérifié par Supabase), jamais la colonne profiles.email ni
// profiles.role, qu'un utilisateur pourrait modifier sur sa propre ligne.
export const ADMIN_EMAIL = "youssefalaya85@gmail.com";
export const ADMIN_PASSWORD_MIN_LENGTH = 10;

export function isAdminEmail(email: string | null | undefined): boolean {
  return !!email && email.trim().toLowerCase() === ADMIN_EMAIL;
}

// Colonnes de profiles nécessaires pour décider d'un accès
export const AUTH_PROFILE_COLUMNS = "id, name, role, is_approved, subscription_status, subscription_end";

export interface AuthProfile {
  id: string;
  /** E-mail du compte Auth (source de vérité pour le rôle admin) */
  email: string | null;
  name: string | null;
  role: string | null;
  is_approved: boolean | null;
  subscription_status: string | null;
  subscription_end: string | null;
}

type ProfileRow = Omit<AuthProfile, "email">;

// Assemble le profil d'accès à partir de l'utilisateur Auth et de sa ligne
// profiles. L'admin n'a pas besoin de ligne profiles pour accéder au dashboard.
export function buildAuthProfile(
  user: { id: string; email?: string | null },
  row: ProfileRow | null
): AuthProfile | null {
  const email = user.email ?? null;
  if (row) return { ...row, email };
  if (isAdminEmail(email)) {
    return {
      id: user.id, email, name: null, role: "admin",
      is_approved: true, subscription_status: null, subscription_end: null,
    };
  }
  return null;
}

export function isAdmin(profile: AuthProfile): boolean {
  return isAdminEmail(profile.email);
}

export function isSubscriptionActive(profile: AuthProfile, now = new Date()): boolean {
  return !!profile.subscription_end && new Date(profile.subscription_end) > now;
}

// Un coiffeur n'accède à son espace que s'il est approuvé ET abonné (essai compris)
export function canAccessCoiffeurSpace(profile: AuthProfile): boolean {
  return !isAdmin(profile) && profile.is_approved === true && isSubscriptionActive(profile);
}

export function destinationFor(profile: AuthProfile | null): string {
  if (!profile) return LOGIN_PATH;
  if (isAdmin(profile)) return ADMIN_DASHBOARD_PATH;
  if (!canAccessCoiffeurSpace(profile)) return PENDING_PATH;
  return `/admin/${profile.id}`;
}
