import { supabase } from "./supabase";
import { AUTH_PROFILE_COLUMNS, buildAuthProfile, type AuthProfile } from "./authRules";

// Point unique de décision "où envoyer cet utilisateur ?" côté client —
// mêmes règles que le middleware (lib/authRules.ts).
export * from "./authRules";

// Valide la session auprès de Supabase Auth (getUser, comme le middleware :
// sinon client et serveur pourraient diverger et boucler entre login et admin),
// puis relit le profil en base : is_approved et l'abonnement sont vérifiés à
// chaque reconnexion, jamais pris depuis un cache local.
export async function getAuthProfile(): Promise<AuthProfile | null> {
  if (!supabase) return null;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select(AUTH_PROFILE_COLUMNS)
    .eq("id", user.id)
    .maybeSingle();

  return buildAuthProfile(user, data);
}
