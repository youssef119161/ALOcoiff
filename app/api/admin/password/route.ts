import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { ADMIN_EMAIL, ADMIN_PASSWORD_MIN_LENGTH, isAdminEmail } from "../../../../lib/authRules";

export const runtime = "nodejs";

// Changement du mot de passe administrateur en deux étapes :
//   1. "request" : ancien mot de passe vérifié → code à 6 chiffres envoyé par
//      Supabase sur ADMIN_EMAIL.
//   2. "confirm" : ancien mot de passe + code vérifiés par Supabase (verifyOtp)
//      → nouveau mot de passe appliqué, puis TOUTES les sessions révoquées.
// Le code est vérifié côté Supabase à chaque fois (contrairement au nonce de
// reauthenticate(), ignoré quand la session a moins de 24 h).

type ErrorCode =
  | "not_admin" | "invalid_input" | "current_password_wrong"
  | "password_too_short" | "password_same" | "password_weak"
  | "code_invalid" | "rate_limited" | "server_error";

const fail = (code: ErrorCode, status: number) => NextResponse.json({ ok: false, code }, { status });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

// Client jetable, sans persistance : n'affecte jamais la session du navigateur
const tempClient = () =>
  createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

async function currentUserIsAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const supabase = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (list: { name: string; value: string; options: CookieOptions }[]) => {
        list.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
      },
    },
  });
  const { data: { user } } = await supabase.auth.getUser();
  return !!user && isAdminEmail(user.email);
}

async function currentPasswordIsValid(password: string): Promise<boolean> {
  const client = tempClient();
  const { error } = await client.auth.signInWithPassword({ email: ADMIN_EMAIL, password });
  if (error) return false;
  // Révoque immédiatement la session de vérification
  await client.auth.signOut({ scope: "local" });
  return true;
}

const isRateLimited = (error: { status?: number; code?: string } | null) =>
  !!error && (error.status === 429 || error.code === "over_email_send_rate_limit" || error.code === "over_request_rate_limit");

export async function POST(request: Request) {
  if (!supabaseUrl || !anonKey) return fail("server_error", 500);
  if (!(await currentUserIsAdmin())) return fail("not_admin", 403);

  let body: { step?: string; currentPassword?: string; newPassword?: string; code?: string };
  try {
    body = await request.json();
  } catch {
    return fail("invalid_input", 400);
  }

  const currentPassword = String(body.currentPassword ?? "");
  const newPassword = String(body.newPassword ?? "");
  if (!currentPassword || !newPassword) return fail("invalid_input", 400);
  if (newPassword.length < ADMIN_PASSWORD_MIN_LENGTH) return fail("password_too_short", 400);
  if (newPassword === currentPassword) return fail("password_same", 400);

  if (!(await currentPasswordIsValid(currentPassword))) return fail("current_password_wrong", 400);

  // ── Étape 1 : envoi du code de confirmation par e-mail ──
  if (body.step === "request") {
    const { error } = await tempClient().auth.signInWithOtp({
      email: ADMIN_EMAIL,
      options: { shouldCreateUser: false },
    });
    if (error) {
      console.error("❌ /api/admin/password envoi du code:", error.code, error.message);
      return fail(isRateLimited(error) ? "rate_limited" : "server_error", isRateLimited(error) ? 429 : 500);
    }
    return NextResponse.json({ ok: true });
  }

  // ── Étape 2 : code vérifié → nouveau mot de passe ──
  if (body.step === "confirm") {
    const code = String(body.code ?? "").trim();
    if (!/^\d{6}$/.test(code)) return fail("code_invalid", 400);

    const client = tempClient();
    const { data, error: otpError } = await client.auth.verifyOtp({ email: ADMIN_EMAIL, token: code, type: "email" });
    if (otpError || !data.session) {
      return fail(isRateLimited(otpError) ? "rate_limited" : "code_invalid", isRateLimited(otpError) ? 429 : 400);
    }

    const { error: updateError } = await client.auth.updateUser({ password: newPassword });
    if (updateError) {
      console.error("❌ /api/admin/password mise à jour:", updateError.code, updateError.message);
      await client.auth.signOut({ scope: "local" });
      if (updateError.code === "same_password") return fail("password_same", 400);
      if (updateError.code === "weak_password") return fail("password_weak", 400);
      return fail("server_error", 500);
    }

    // Révoque toutes les sessions de l'admin (y compris une session volée)
    await client.auth.signOut({ scope: "global" });
    return NextResponse.json({ ok: true });
  }

  return fail("invalid_input", 400);
}
