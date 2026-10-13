"use client";

import { useState, useRef, useEffect, ReactNode } from "react";
import { motion } from "framer-motion";
import { supabase, uploadFile, portfolioDB } from "../../../lib/supabase";
import { getAuthProfile, destinationFor, PENDING_PATH, LOGIN_PATH } from "../../../lib/authRedirect";
import {
  validateSignup,
  SPECIALTIES,
  type Specialty,
  type SignupField,
  type SignupErrorCode,
  type SignupFieldErrors,
  type SignupResponse,
} from "../../../lib/signupValidation";

type Language = "fr" | "ar";

const translations = {
  fr: {
    title: "Inscription Coiffeur",
    subtitle: "Rejoignez l'équipe RAED COIF",
    name: "Nom complet",
    nameAr: "Nom en arabe",
    email: "Adresse e-mail",
    phone: "Numéro de téléphone",
    password: "Mot de passe",
    confirmPassword: "Confirmer le mot de passe",
    specialty: "Clientèle",
    specialtyAr: "Clientèle en arabe",
    avatar: "Photo de profil",
    avatarRequired: "La photo de profil est obligatoire",
    dragDropAvatar: "Glissez-déposez votre photo ou cliquez",
    video: "Vidéo de présentation (optionnel)",
    dragDropVideo: "Glissez-déposez une vidéo ou cliquez",
    portfolio: "Photos de votre travail (optionnel)",
    dragDropPortfolio: "Glissez-déposez des images ou cliquez",
    signup: "S'inscrire",
    uploading: "Inscription en cours...",
    city: "Ville",
    cityPlaceholder: "Ex : Tunis, Sfax, Sousse…",
    fixErrors: "Veuillez corriger les champs signalés en rouge.",
    successSignup: "Inscription réussie ! Votre essai gratuit de 30 jours est activé. Redirection...",
    errors: {
      required: "Ce champ est obligatoire.",
      choice_required: "Veuillez faire un choix.",
      email_invalid: "Adresse e-mail invalide (ex : nom@domaine.com).",
      email_taken: "Cette adresse e-mail est déjà utilisée.",
      phone_invalid: "Numéro de téléphone invalide (8 à 15 chiffres).",
      password_weak: "Le mot de passe doit contenir au moins 6 caractères.",
      password_mismatch: "Les mots de passe ne correspondent pas.",
      avatar_required: "Veuillez ajouter une photo de profil.",
      avatar_invalid: "Format non supporté. Utilisez une image JPG, PNG ou WebP.",
      avatar_too_large: "La photo ne doit pas dépasser 5 Mo.",
      avatar_upload: "La photo n'a pas pu être envoyée. Aucun compte n'a été créé, vous pouvez réessayer.",
      server_config: "L'inscription est momentanément indisponible. Réessayez plus tard.",
      profile_insert: "Votre inscription n'a pas pu être enregistrée. Aucun compte n'a été créé, vous pouvez réessayer.",
      network: "Connexion impossible. Vérifiez votre réseau et réessayez.",
      unknown: "Une erreur inattendue est survenue. Réessayez.",
    } satisfies Record<SignupErrorCode, string>,
    backLogin: "← Retour à la connexion",
    alreadyAccount: "Déjà un compte ?",
    login: "Se connecter",
  },
  ar: {
    title: "تسجيل مصفف",
    subtitle: "انضم إلى فريق RAED COIF",
    name: "الاسم الكامل",
    nameAr: "الاسم بالعربية",
    email: "البريد الإلكتروني",
    phone: "رقم الهاتف",
    password: "كلمة المرور",
    confirmPassword: "تأكيد كلمة المرور",
    specialty: "الفئة المستهدفة",
    specialtyAr: "الفئة المستهدفة بالعربية",
    avatar: "صورة الملف الشخصي",
    avatarRequired: "صورة الملف الشخصي مطلوبة",
    dragDropAvatar: "اسحب وأفلت صورتك أو انقر",
    video: "فيديو تقديمي (اختياري)",
    dragDropVideo: "اسحب وأفلت فيديو أو انقر",
    portfolio: "صور أعمالك (اختياري)",
    dragDropPortfolio: "اسحب وأفلت الصور أو انقر",
    signup: "سجل",
    uploading: "جاري التسجيل...",
    city: "المدينة",
    cityPlaceholder: "مثال: تونس، صفاقس، سوسة…",
    fixErrors: "يرجى تصحيح الحقول المشار إليها باللون الأحمر.",
    successSignup: "تم التسجيل بنجاح! تم تفعيل فترتك التجريبية المجانية لمدة 30 يومًا. إعادة التوجيه...",
    errors: {
      required: "هذا الحقل مطلوب.",
      choice_required: "يرجى الاختيار.",
      email_invalid: "البريد الإلكتروني غير صالح (مثال: name@domain.com).",
      email_taken: "هذا البريد الإلكتروني مستخدم بالفعل.",
      phone_invalid: "رقم الهاتف غير صالح (من 8 إلى 15 رقمًا).",
      password_weak: "يجب أن تحتوي كلمة المرور على 6 أحرف على الأقل.",
      password_mismatch: "كلمات المرور غير متطابقة.",
      avatar_required: "يرجى إضافة صورة الملف الشخصي.",
      avatar_invalid: "صيغة غير مدعومة. استخدم صورة JPG أو PNG أو WebP.",
      avatar_too_large: "يجب ألا يتجاوز حجم الصورة 5 ميغابايت.",
      avatar_upload: "تعذّر رفع الصورة. لم يتم إنشاء أي حساب، يمكنك المحاولة مجددًا.",
      server_config: "التسجيل غير متاح حاليًا. يرجى المحاولة لاحقًا.",
      profile_insert: "تعذّر حفظ تسجيلك. لم يتم إنشاء أي حساب، يمكنك المحاولة مجددًا.",
      network: "تعذّر الاتصال. تحقق من الشبكة وحاول مجددًا.",
      unknown: "حدث خطأ غير متوقع. يرجى المحاولة مجددًا.",
    } satisfies Record<SignupErrorCode, string>,
    backLogin: "← العودة إلى تسجيل الدخول",
    alreadyAccount: "لديك حساب بالفعل؟",
    login: "تسجيل الدخول",
  },
};

// Message d'erreur affiché sous le champ concerné
function FieldError({ message, children }: { message?: string; children?: ReactNode }) {
  if (!message) return null;
  return (
    <motion.p
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      role="alert"
      className="mt-2 text-sm text-red-400 flex items-start gap-1.5"
    >
      <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
      <span>{message}{children}</span>
    </motion.p>
  );
}

export default function SignupPage() {
  const [lang, setLang] = useState<Language>("fr");
  const [name, setName] = useState("");
  const [nameAr, setNameAr] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [specialty, setSpecialty] = useState<Specialty | "">("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string>("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [portfolioFiles, setPortfolioFiles] = useState<File[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [avatarDragOver, setAvatarDragOver] = useState(false);
  const [videoDragOver, setVideoDragOver] = useState(false);
  const [portfolioDragOver, setPortfolioDragOver] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<'mensuel' | 'annuel' | ''>('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<SignupFieldErrors>({});

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const portfolioInputRef = useRef<HTMLInputElement>(null);

  const t = translations[lang];
  const fieldMessage = (field: SignupField) => {
    const code = fieldErrors[field];
    return code ? t.errors[code] : undefined;
  };
  const borderFor = (field: SignupField) => (fieldErrors[field] ? "border-red-500/60" : "border-zinc-700");
  const clearFieldError = (field: SignupField) =>
    setFieldErrors(prev => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  const isRTL = lang === "ar";
  const fontClass = lang === "ar" ? "font-cairo" : "font-serif";

  // Rediriger si déjà connecté
  useEffect(() => {
    getAuthProfile().then((profile) => {
      if (profile) window.location.replace(destinationFor(profile));
    });
  }, []);

  const toggleLanguage = () => {
    setLang(lang === "fr" ? "ar" : "fr");
  };

  const selectAvatar = (file: File | undefined) => {
    if (!file || !file.type.startsWith('image/')) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
    clearFieldError("avatar");
  };

  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    selectAvatar(e.target.files?.[0]);
  };

  const handleAvatarDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setAvatarDragOver(false);
    selectAvatar(e.dataTransfer.files[0]);
  };

  const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('video/')) {
      setVideoFile(file);
    }
  };

  const handleVideoDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setVideoDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('video/')) {
      setVideoFile(file);
    }
  };

  const handlePortfolioSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const imageFiles = files.filter(f => f.type.startsWith('image/'));
    setPortfolioFiles(prev => [...prev, ...imageFiles]);
  };

  const handlePortfolioDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setPortfolioDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    const imageFiles = files.filter(f => f.type.startsWith('image/'));
    setPortfolioFiles(prev => [...prev, ...imageFiles]);
  };

  const removePortfolioImage = (index: number) => {
    setPortfolioFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Vidéo et portfolio sont facultatifs : envoyés après l'ouverture de session,
  // un échec ici n'invalide pas l'inscription (modifiables ensuite depuis le profil).
  const uploadOptionalMedia = async (userId: string) => {
    if (!supabase) return;

    if (videoFile) {
      const videoPath = `video-${userId}-${Date.now()}.${videoFile.name.split('.').pop()}`;
      const { url, error: ve } = await uploadFile(videoFile, 'videos', videoPath);
      if (url && !ve) {
        const { error } = await supabase.from('profiles').update({ video_url: url }).eq('id', userId);
        if (error) console.warn('⚠️ Vidéo non enregistrée:', error.message);
      } else {
        console.warn('⚠️ Upload vidéo ignoré:', ve);
      }
    }

    for (const file of portfolioFiles) {
      const path = `portfolio-${userId}-${Date.now()}-${Math.random().toString(36).substring(7)}.${file.name.split('.').pop()}`;
      const { url, error: pe } = await uploadFile(file, 'portfolio', path);
      if (url && !pe) await portfolioDB.add(userId, url);
      else console.warn('⚠️ Upload portfolio ignoré:', pe);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    const cleanEmail = email.trim().toLowerCase();
    const input = {
      name: name.trim(),
      nameAr: nameAr.trim(),
      email: cleanEmail,
      phone: phone.trim(),
      city: city.trim(),
      password,
      specialty,
      plan: selectedPlan,
      paymentMethod,
      avatar: avatarFile,
    };

    const errors = validateSignup(input, confirmPassword);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setError(t.fixErrors);
      return;
    }
    if (!supabase || !avatarFile) {
      setError(t.errors.server_config);
      return;
    }

    setIsSubmitting(true);
    let redirecting = false;
    try {
      // ── 1. Compte Auth + avatar + profil, en une seule opération serveur ──
      // En cas d'échec, le serveur annule tout : aucun compte fantôme.
      const body = new FormData();
      body.append('name', input.name);
      body.append('nameAr', input.nameAr);
      body.append('email', input.email);
      body.append('phone', input.phone);
      body.append('city', input.city);
      body.append('password', input.password);
      body.append('specialty', input.specialty);
      body.append('plan', input.plan);
      body.append('paymentMethod', input.paymentMethod);
      body.append('avatar', avatarFile);

      let result: SignupResponse;
      try {
        const res = await fetch('/api/signup', { method: 'POST', body });
        result = await res.json();
      } catch {
        setError(t.errors.network);
        return;
      }

      if (!result.ok) {
        if (result.errors) setFieldErrors(result.errors);
        setError(result.formError ? t.errors[result.formError] : t.fixErrors);
        return;
      }

      // ── 2. Ouverture de session (persistée sur ce navigateur) ──
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: input.email,
        password: input.password,
      });
      if (signInError || !signInData.user) {
        // Le compte existe bien : il suffit de se connecter
        redirecting = true;
        window.location.replace(LOGIN_PATH);
        return;
      }

      setSuccess(t.successSignup);

      // ── 3. Médias facultatifs ──
      await uploadOptionalMedia(signInData.user.id);

      // ── 4. Espace coiffeur : compte non approuvé → page d'attente ──
      redirecting = true;
      window.location.replace(PENDING_PATH);
    } catch (err) {
      console.error('❌ Inscription échouée:', err);
      setError(t.errors.unknown);
    } finally {
      // Bouton laissé désactivé pendant la redirection (évite un double envoi)
      if (!redirecting) setIsSubmitting(false);
    }
  };

  return (
    <div
      className={`min-h-screen p-8 ${fontClass}`}
      dir={isRTL ? "rtl" : "ltr"}
    >
      <button
        onClick={toggleLanguage}
        className="fixed top-8 right-8 z-50 px-4 py-2 bg-gold/10 hover:bg-gold/20 text-gold border border-gold/30 rounded-lg transition-all duration-300 font-medium"
      >
        {lang === "fr" ? "العربية" : "Français"}
      </button>

      <div className="max-w-4xl mx-auto pt-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="bg-zinc-900/70 backdrop-blur-xl border border-gold/20 rounded-3xl p-8 shadow-2xl"
        >
          <div className={`mb-8 ${isRTL ? "text-right" : "text-left"}`}>
            <h2 className="text-gold text-sm tracking-[0.3em] uppercase mb-2">
              RAED COIF
            </h2>
            <h1 className="text-4xl font-bold text-gold mb-2">{t.title}</h1>
            <p className="text-zinc-400 text-sm">{t.subtitle}</p>
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm text-center"
            >
              {error}
            </motion.div>
          )}

          {success && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 p-4 bg-green-500/10 border border-green-500/30 rounded-xl text-green-400 text-sm text-center"
            >
              {success}
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Informations de base */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  {t.name}
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => { setName(e.target.value); clearFieldError("name"); }}
                  required
                  autoComplete="name"
                  className={`w-full px-4 py-3 bg-zinc-800/50 border ${borderFor("name")} rounded-xl focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold transition-all text-white`}
                />
                <FieldError message={fieldMessage("name")} />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  {t.nameAr}
                </label>
                <input
                  type="text"
                  value={nameAr}
                  onChange={(e) => { setNameAr(e.target.value); clearFieldError("nameAr"); }}
                  required
                  dir="rtl"
                  className={`w-full px-4 py-3 bg-zinc-800/50 border ${borderFor("nameAr")} rounded-xl focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold transition-all text-white font-cairo`}
                />
                <FieldError message={fieldMessage("nameAr")} />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                {t.email}
              </label>
              <input
                type="text"
                value={email}
                onChange={(e) => { setEmail(e.target.value); clearFieldError("email"); }}
                required
                autoComplete="email"
                className={`w-full px-4 py-3 bg-zinc-800/50 border ${borderFor("email")} rounded-xl focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold transition-all text-white`}
                placeholder="exemple@email.com"
              />
              <FieldError message={fieldMessage("email")}>
                {fieldErrors.email === "email_taken" && (
                  <>
                    {" "}
                    <a href={LOGIN_PATH} className="underline hover:text-red-300 transition-colors">
                      {t.login}
                    </a>
                  </>
                )}
              </FieldError>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                {t.phone}
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => { setPhone(e.target.value); clearFieldError("phone"); }}
                required
                autoComplete="tel"
                className={`w-full px-4 py-3 bg-zinc-800/50 border ${borderFor("phone")} rounded-xl focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold transition-all text-white`}
                placeholder="+216 XX XXX XXX"
              />
              <FieldError message={fieldMessage("phone")} />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                {t.city}
              </label>
              <input
                type="text"
                value={city}
                onChange={(e) => { setCity(e.target.value); clearFieldError("city"); }}
                required
                autoComplete="address-level2"
                className={`w-full px-4 py-3 bg-zinc-800/50 border ${borderFor("city")} rounded-xl focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold transition-all text-white`}
                placeholder={t.cityPlaceholder}
              />
              <FieldError message={fieldMessage("city")} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  {t.password}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); clearFieldError("password"); }}
                    required
                    autoComplete="new-password"
                    className={`w-full px-4 py-3 pr-12 bg-zinc-800/50 border ${borderFor("password")} rounded-xl focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold transition-all text-white`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute inset-y-0 right-3 flex items-center text-zinc-400 hover:text-gold transition-colors"
                    tabIndex={-1}
                    aria-label={showPassword ? "Masquer" : "Afficher"}
                  >
                    {showPassword ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
                <FieldError message={fieldMessage("password")} />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  {t.confirmPassword}
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => { setConfirmPassword(e.target.value); clearFieldError("confirmPassword"); }}
                    required
                    autoComplete="new-password"
                    className={`w-full px-4 py-3 pr-12 bg-zinc-800/50 border ${borderFor("confirmPassword")} rounded-xl focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold transition-all text-white`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(v => !v)}
                    className="absolute inset-y-0 right-3 flex items-center text-zinc-400 hover:text-gold transition-colors"
                    tabIndex={-1}
                    aria-label={showConfirmPassword ? "Masquer" : "Afficher"}
                  >
                    {showConfirmPassword ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
                <FieldError message={fieldMessage("confirmPassword")} />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-3">
                {t.specialty} <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-3 gap-3">
                {(Object.keys(SPECIALTIES) as Specialty[]).map((option) => {
                  const isSelected = specialty === option;
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => { setSpecialty(option); clearFieldError("specialty"); }}
                      className={`p-4 rounded-2xl border-2 transition-all duration-300 flex flex-col items-center gap-2 ${
                        isSelected
                          ? "border-gold bg-gold/15 shadow-lg shadow-gold/20"
                          : "border-zinc-700 bg-zinc-800/30 hover:border-gold/50 hover:bg-zinc-800/60"
                      }`}
                    >
                      {/* Icône SVG */}
                      {option === "Homme" && (
                        <svg className={`w-8 h-8 ${isSelected ? "text-gold" : "text-zinc-400"}`} fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>
                        </svg>
                      )}
                      {option === "Femme" && (
                        <svg className={`w-8 h-8 ${isSelected ? "text-gold" : "text-zinc-400"}`} fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 2a5 5 0 100 10A5 5 0 0012 2zm0 12c-5.33 0-8 2.67-8 4v1h16v-1c0-1.33-2.67-4-8-4z"/>
                          <path d="M10.5 14.5v4m3-4v4M9 17h6" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round"/>
                        </svg>
                      )}
                      {option === "Homme & Femme" && (
                        <svg className={`w-8 h-8 ${isSelected ? "text-gold" : "text-zinc-400"}`} fill="currentColor" viewBox="0 0 24 24">
                          <path d="M9 12c2.2 0 4-1.8 4-4s-1.8-4-4-4-4 1.8-4 4 1.8 4 4 4zm0 2c-2.7 0-8 1.3-8 4v1h16v-1c0-2.7-5.3-4-8-4z" opacity="0.7"/>
                          <path d="M16 11c1.7 0 3-1.3 3-3s-1.3-3-3-3-3 1.3-3 3 1.3 3 3 3zm0 2c-.8 0-1.5.1-2.2.3C15 14 16 15.1 16 16.5V18h6v-1c0-2-2.7-4-6-4z"/>
                        </svg>
                      )}
                      <span className={`text-sm font-semibold ${isSelected ? "text-gold" : "text-zinc-300"}`}>
                        {option}
                      </span>
                      <span className={`text-xs font-cairo ${isSelected ? "text-gold/70" : "text-zinc-500"}`}>
                        {SPECIALTIES[option]}
                      </span>
                      {isSelected && (
                        <div className="w-4 h-4 bg-gold rounded-full flex items-center justify-center">
                          <svg className="w-2.5 h-2.5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
              <FieldError message={fieldMessage("specialty")} />
              {!specialty && !fieldErrors.specialty && (
                <p className="text-xs text-zinc-500 mt-2">
                  {lang === "ar" ? "يرجى اختيار الفئة المستهدفة" : "Veuillez choisir votre clientèle cible"}
                </p>
              )}
            </div>

            {/* Avatar (obligatoire) */}
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                {t.avatar} <span className="text-red-500">*</span>
              </label>
              <p className="text-xs text-zinc-500 mb-3">{t.avatarRequired}</p>
              
              {avatarPreview && (
                <div className="mb-4 flex justify-center">
                  <img 
                    src={avatarPreview} 
                    alt="Avatar preview" 
                    className="w-32 h-32 object-cover rounded-full border-4 border-gold/30"
                  />
                </div>
              )}

              <div
                onDrop={handleAvatarDrop}
                onDragOver={(e) => { e.preventDefault(); setAvatarDragOver(true); }}
                onDragLeave={() => setAvatarDragOver(false)}
                onClick={() => avatarInputRef.current?.click()}
                className={`cursor-pointer p-8 rounded-xl text-center transition-all duration-300 border-2 border-dashed ${
                  avatarDragOver ? 'bg-gold/10 border-gold' : `bg-zinc-800/30 ${borderFor("avatar")}`
                }`}
              >
                <svg className="w-12 h-12 mx-auto mb-3 text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <p className="text-gold text-sm">{t.dragDropAvatar}</p>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleAvatarSelect}
                  className="hidden"
                />
              </div>
              <FieldError message={fieldMessage("avatar")} />
            </div>

            {/* Vidéo (optionnel) */}
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                {t.video}
              </label>
              
              {videoFile && (
                <p className="text-sm text-green-400 mb-2">✓ {videoFile.name}</p>
              )}

              <div
                onDrop={handleVideoDrop}
                onDragOver={(e) => { e.preventDefault(); setVideoDragOver(true); }}
                onDragLeave={() => setVideoDragOver(false)}
                onClick={() => videoInputRef.current?.click()}
                className={`cursor-pointer p-8 rounded-xl text-center transition-all duration-300 border-2 border-dashed ${
                  videoDragOver ? 'bg-gold/10 border-gold' : 'bg-zinc-800/30 border-zinc-700'
                }`}
              >
                <svg className="w-12 h-12 mx-auto mb-3 text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <p className="text-gold text-sm">{t.dragDropVideo}</p>
                <input
                  ref={videoInputRef}
                  type="file"
                  accept="video/*"
                  onChange={handleVideoSelect}
                  className="hidden"
                />
              </div>
            </div>

            {/* Portfolio (optionnel) */}
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                {t.portfolio}
              </label>
              
              {portfolioFiles.length > 0 && (
                <div className="grid grid-cols-4 gap-2 mb-4">
                  {portfolioFiles.map((file, index) => (
                    <div key={index} className="relative group">
                      <img
                        src={URL.createObjectURL(file)}
                        alt={`Portfolio ${index + 1}`}
                        className="w-full h-24 object-cover rounded-lg"
                      />
                      <button
                        type="button"
                        onClick={() => removePortfolioImage(index)}
                        className="absolute top-1 right-1 bg-red-600 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div
                onDrop={handlePortfolioDrop}
                onDragOver={(e) => { e.preventDefault(); setPortfolioDragOver(true); }}
                onDragLeave={() => setPortfolioDragOver(false)}
                onClick={() => portfolioInputRef.current?.click()}
                className={`cursor-pointer p-8 rounded-xl text-center transition-all duration-300 border-2 border-dashed ${
                  portfolioDragOver ? 'bg-gold/10 border-gold' : 'bg-zinc-800/30 border-zinc-700'
                }`}
              >
                <svg className="w-12 h-12 mx-auto mb-3 text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="text-gold text-sm">{t.dragDropPortfolio}</p>
                <input
                  ref={portfolioInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handlePortfolioSelect}
                  className="hidden"
                />
              </div>
            </div>

            {/* Choix du Forfait */}
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-4">
                {lang === 'ar' ? 'اختر باقتك' : 'Choisissez votre accès'} <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Pack Mensuel */}
                <div
                  onClick={() => { setSelectedPlan('mensuel'); clearFieldError("plan"); }}
                  className={`cursor-pointer rounded-2xl p-6 border-2 transition-all duration-300 ${
                    selectedPlan === 'mensuel'
                      ? 'border-gold bg-gold/10 shadow-lg shadow-gold/20'
                      : 'border-zinc-700 bg-zinc-800/30 hover:border-gold/50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-2xl">📅</span>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                      selectedPlan === 'mensuel' ? 'border-gold bg-gold' : 'border-zinc-600'
                    }`}>
                      {selectedPlan === 'mensuel' && <div className="w-2 h-2 rounded-full bg-black" />}
                    </div>
                  </div>
                  <h3 className="text-gold font-bold text-lg mb-1">Pack Mensuel</h3>
                  <p className="text-zinc-400 text-sm leading-relaxed">Accès complet · Support 24/7 · 30 jours</p>
                </div>

                {/* Pack Annuel */}
                <div
                  onClick={() => { setSelectedPlan('annuel'); clearFieldError("plan"); }}
                  className={`cursor-pointer rounded-2xl p-6 border-2 transition-all duration-300 relative overflow-hidden ${
                    selectedPlan === 'annuel'
                      ? 'border-gold bg-gold/10 shadow-lg shadow-gold/20'
                      : 'border-zinc-700 bg-zinc-800/30 hover:border-gold/50'
                  }`}
                >
                  <div className="absolute top-3 right-3 bg-gold text-black text-xs font-bold px-2 py-0.5 rounded-full">
                    {lang === 'ar' ? 'وفّر 20%' : 'Économisez 20%'}
                  </div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-2xl">👑</span>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                      selectedPlan === 'annuel' ? 'border-gold bg-gold' : 'border-zinc-600'
                    }`}>
                      {selectedPlan === 'annuel' && <div className="w-2 h-2 rounded-full bg-black" />}
                    </div>
                  </div>
                  <h3 className="text-gold font-bold text-lg mb-1">Pack Annuel</h3>
                  <p className="text-zinc-400 text-sm leading-relaxed">Le meilleur choix pour votre salon · 365 jours</p>
                </div>
              </div>
              <FieldError message={fieldMessage("plan")} />
            </div>

            {/* Méthode de Paiement */}
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                {lang === 'ar' ? 'كيف تريد الدفع؟' : 'Comment souhaitez-vous régler votre abonnement ?'} <span className="text-red-500">*</span>
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => { setPaymentMethod(e.target.value); clearFieldError("payment"); }}
                className={`w-full px-4 py-3 bg-zinc-800/50 border ${borderFor("payment")} rounded-xl focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold transition-all text-white appearance-none cursor-pointer`}
              >
                <option value="" disabled className="bg-zinc-900">
                  {lang === 'ar' ? '— اختر طريقة الدفع —' : '— Choisir une méthode —'}
                </option>
                <option value="Wafacash" className="bg-zinc-900">💳 Wafacash</option>
                <option value="Baridimob / Poste" className="bg-zinc-900">📮 Baridimob / Poste</option>
                <option value="Cash (Direct)" className="bg-zinc-900">💵 Cash (Direct)</option>
              </select>
              <FieldError message={fieldMessage("payment")} />
              {paymentMethod && (
                <p className="text-xs text-zinc-500 mt-2">
                  {lang === 'ar'
                    ? 'سيتم التواصل معك لتأكيد الدفع وتفعيل حسابك.'
                    : "L'admin vous contactera pour confirmer le paiement et activer votre compte."}
                </p>
              )}
            </div>

            <motion.button
              type="submit"
              disabled={isSubmitting}
              whileHover={{ scale: isSubmitting ? 1 : 1.02 }}
              whileTap={{ scale: isSubmitting ? 1 : 0.98 }}
              className={`w-full bg-gold hover:bg-gold/90 text-black font-bold py-4 px-4 rounded-xl transition-all duration-300 shadow-lg hover:shadow-gold/50 ${
                isSubmitting ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {isSubmitting ? t.uploading : t.signup}
            </motion.button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-zinc-400 text-sm">
              {t.alreadyAccount}{" "}
              <a href="/auth/login" className="text-gold hover:underline">
                {t.login}
              </a>
            </p>
          </div>

          <div className="mt-8 pt-6 border-t border-zinc-800">
            <a
              href="/"
              className="block text-center text-zinc-400 hover:text-gold transition-colors duration-300"
            >
              {t.backLogin}
            </a>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

