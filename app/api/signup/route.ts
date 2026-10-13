import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  validateSignup,
  SPECIALTIES,
  AVATAR_TYPES,
  TRIAL_DAYS,
  type Specialty,
  type SignupResponse,
} from "../../../lib/signupValidation";

export const runtime = "nodejs";

const reply = (body: SignupResponse, status: number) => NextResponse.json(body, { status });

// Inscription coiffeur "tout ou rien" : compte Auth → avatar → profil.
// Exécutée côté serveur avec la clé service_role pour pouvoir annuler
// (supprimer le compte Auth et l'avatar) si une étape échoue — ce que le
// navigateur ne peut pas faire. Aucun utilisateur fantôme dans auth.users.
export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error("❌ /api/signup : SUPABASE_SERVICE_ROLE_KEY manquante dans .env.local");
    return reply({ ok: false, formError: "server_config" }, 500);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return reply({ ok: false, formError: "unknown" }, 400);
  }

  const text = (key: string) => String(form.get(key) ?? "").trim();
  const avatarEntry = form.get("avatar");
  const avatar = avatarEntry instanceof File && avatarEntry.size > 0 ? avatarEntry : null;

  const input = {
    name: text("name"),
    nameAr: text("nameAr"),
    email: text("email").toLowerCase(),
    phone: text("phone"),
    city: text("city"),
    password: String(form.get("password") ?? ""),
    specialty: text("specialty"),
    plan: text("plan"),
    paymentMethod: text("paymentMethod"),
    avatar,
  };

  const errors = validateSignup(input);
  if (Object.keys(errors).length > 0 || !avatar) {
    return reply({ ok: false, errors }, 400);
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // ── 1. Compte Auth (confirmé d'office : le coiffeur est connecté juste après) ──
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: { name: input.name, role: "coiffeur" },
  });

  if (createError || !created?.user) {
    const code = createError?.code ?? "";
    const msg = createError?.message?.toLowerCase() ?? "";
    if (code === "email_exists" || code === "user_already_exists" || msg.includes("already")) {
      return reply({ ok: false, errors: { email: "email_taken" } }, 409);
    }
    if (code === "weak_password") {
      return reply({ ok: false, errors: { password: "password_weak" } }, 400);
    }
    if (code === "email_address_invalid") {
      return reply({ ok: false, errors: { email: "email_invalid" } }, 400);
    }
    console.error("❌ /api/signup createUser:", createError?.code, createError?.message);
    return reply({ ok: false, formError: "unknown" }, 500);
  }

  const userId = created.user.id;
  let avatarPath: string | null = null;

  // Annule tout ce qui a été créé pour cette inscription
  const rollback = async () => {
    if (avatarPath) {
      const { error } = await admin.storage.from("avatars").remove([avatarPath]);
      if (error) console.error("⚠️ Rollback avatar impossible:", avatarPath, error.message);
    }
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) console.error("⚠️ Rollback compte impossible — à supprimer manuellement:", userId, error.message);
  };

  try {
    // ── 2. Avatar : nom de fichier unique dérivé de l'UID ──
    const path = `avatar-${userId}.${AVATAR_TYPES[avatar.type]}`;
    const { error: uploadError } = await admin.storage
      .from("avatars")
      .upload(path, avatar, { contentType: avatar.type, upsert: true });

    if (uploadError) {
      console.error("❌ /api/signup upload avatar:", uploadError.message);
      await rollback();
      return reply({ ok: false, errors: { avatar: "avatar_upload" } }, 500);
    }
    avatarPath = path;
    const avatarUrl = admin.storage.from("avatars").getPublicUrl(path).data.publicUrl;

    // ── 3. Profil complet, essai gratuit activé, en attente de validation ──
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + TRIAL_DAYS);

    const { error: profileError } = await admin.from("profiles").upsert(
      {
        id: userId,
        name: input.name,
        name_ar: input.nameAr,
        email: input.email,
        phone: input.phone,
        city: input.city,
        specialty: input.specialty,
        specialty_ar: SPECIALTIES[input.specialty as Specialty],
        avatar_url: avatarUrl,
        video_url: null,
        subscription_status: "trial",
        subscription_end: trialEnd.toISOString(),
        payment_method: `${input.plan} - ${input.paymentMethod}`,
        is_approved: false,
        role: "coiffeur",
      },
      { onConflict: "id" }
    );

    if (profileError) {
      console.error("❌ /api/signup profil:", profileError.code, profileError.message, profileError.hint);
      await rollback();
      // 23505 = violation d'unicité (e-mail déjà présent dans profiles)
      if (profileError.code === "23505") {
        return reply({ ok: false, errors: { email: "email_taken" } }, 409);
      }
      return reply({ ok: false, formError: "profile_insert" }, 500);
    }
  } catch (err) {
    console.error("❌ /api/signup exception:", err);
    await rollback();
    return reply({ ok: false, formError: "unknown" }, 500);
  }

  return reply({ ok: true }, 201);
}
