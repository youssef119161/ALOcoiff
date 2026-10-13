// Règles d'inscription coiffeur partagées entre le formulaire (/auth/signup)
// et la route serveur (/api/signup) : mêmes contrôles des deux côtés.

export type SignupField =
  | "name" | "nameAr" | "email" | "phone" | "city"
  | "password" | "confirmPassword" | "specialty" | "avatar" | "plan" | "payment";

export type SignupErrorCode =
  | "required" | "choice_required"
  | "email_invalid" | "email_taken" | "phone_invalid"
  | "password_weak" | "password_mismatch"
  | "avatar_required" | "avatar_invalid" | "avatar_too_large" | "avatar_upload"
  | "server_config" | "profile_insert" | "network" | "unknown";

export type SignupFieldErrors = Partial<Record<SignupField, SignupErrorCode>>;

export type SignupResponse =
  | { ok: true }
  | { ok: false; errors?: SignupFieldErrors; formError?: SignupErrorCode };

export const SPECIALTIES = {
  "Homme": "رجال",
  "Femme": "نساء",
  "Homme & Femme": "رجال ونساء",
} as const;
export type Specialty = keyof typeof SPECIALTIES;

export const PLANS = ["mensuel", "annuel"] as const;
export const PAYMENT_METHODS = ["Wafacash", "Baridimob / Poste", "Cash (Direct)"] as const;

export const AVATAR_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;
export const PASSWORD_MIN_LENGTH = 6;
export const TRIAL_DAYS = 30;

export interface SignupInput {
  name: string;
  nameAr: string;
  email: string;
  phone: string;
  city: string;
  password: string;
  specialty: string;
  plan: string;
  paymentMethod: string;
  avatar: { type: string; size: number } | null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validateSignup(input: SignupInput, confirmPassword?: string): SignupFieldErrors {
  const errors: SignupFieldErrors = {};

  if (!input.name.trim()) errors.name = "required";
  if (!input.nameAr.trim()) errors.nameAr = "required";
  if (!input.city.trim()) errors.city = "required";

  if (!input.email) errors.email = "required";
  else if (!EMAIL_RE.test(input.email)) errors.email = "email_invalid";

  const phoneDigits = input.phone.replace(/\D/g, "");
  if (!input.phone.trim()) errors.phone = "required";
  else if (!/^[+\d\s().-]+$/.test(input.phone) || phoneDigits.length < 8 || phoneDigits.length > 15) {
    errors.phone = "phone_invalid";
  }

  if (!input.password) errors.password = "required";
  else if (input.password.length < PASSWORD_MIN_LENGTH) errors.password = "password_weak";

  if (confirmPassword !== undefined && confirmPassword !== input.password) {
    errors.confirmPassword = "password_mismatch";
  }

  if (!(input.specialty in SPECIALTIES)) errors.specialty = "choice_required";
  if (!(PLANS as readonly string[]).includes(input.plan)) errors.plan = "choice_required";
  if (!(PAYMENT_METHODS as readonly string[]).includes(input.paymentMethod)) errors.payment = "choice_required";

  if (!input.avatar) errors.avatar = "avatar_required";
  else if (!AVATAR_TYPES[input.avatar.type]) errors.avatar = "avatar_invalid";
  else if (input.avatar.size > AVATAR_MAX_BYTES) errors.avatar = "avatar_too_large";

  return errors;
}
