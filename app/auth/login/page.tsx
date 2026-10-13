"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../../lib/supabase";
import { getAuthProfile, destinationFor } from "../../../lib/authRedirect";
import { motion, AnimatePresence } from "framer-motion";

type Language = "fr" | "ar";

const translations = {
  fr: {
    title: "Connexion Coiffeur",
    subtitle: "Espace Professionnel - RAED COIF",
    email: "Adresse e-mail",
    password: "Mot de passe",
    login: "Se connecter",
    error: "Email ou mot de passe incorrect",
    backHome: "← Retour à l'accueil",
    noAccount: "Pas encore de compte ?",
    signup: "S'inscrire",
    forgotPassword: "Mot de passe oublié ?",
    resetTitle: "Réinitialiser le mot de passe",
    resetSubtitle: "Entrez votre e-mail pour recevoir un lien de réinitialisation.",
    resetEmail: "Adresse e-mail",
    resetSend: "Envoyer le lien",
    resetSending: "Envoi en cours...",
    resetSuccess: "✅ Lien envoyé ! Vérifiez votre boîte mail.",
    resetError: "Impossible d'envoyer l'e-mail. Vérifiez l'adresse.",
    resetCancel: "Annuler",
  },
  ar: {
    title: "تسجيل دخول المصفف",
    subtitle: "المساحة المهنية - RAED COIF",
    email: "البريد الإلكتروني",
    password: "كلمة المرور",
    login: "تسجيل الدخول",
    error: "البريد الإلكتروني أو كلمة المرور غير صحيحة",
    backHome: "← العودة إلى الصفحة الرئيسية",
    noAccount: "ليس لديك حساب؟",
    signup: "سجل",
    forgotPassword: "نسيت كلمة المرور؟",
    resetTitle: "إعادة تعيين كلمة المرور",
    resetSubtitle: "أدخل بريدك الإلكتروني لتلقي رابط إعادة التعيين.",
    resetEmail: "البريد الإلكتروني",
    resetSend: "إرسال الرابط",
    resetSending: "جارٍ الإرسال...",
    resetSuccess: "✅ تم الإرسال! تحقق من بريدك الإلكتروني.",
    resetError: "تعذّر إرسال البريد. تحقق من العنوان.",
    resetCancel: "إلغاء",
  },
};

export default function LoginPage() {
  const [lang, setLang] = useState<Language>("fr");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Modal "mot de passe oublié"
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetStatus, setResetStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  const { signIn, isLoading } = useAuth();
  const router = useRouter();

  // Session déjà active sur ce navigateur → reconnexion automatique
  const [checkingSession, setCheckingSession] = useState(true);
  useEffect(() => {
    getAuthProfile().then((profile) => {
      if (profile) {
        router.replace(destinationFor(profile));
      } else {
        setCheckingSession(false);
      }
    });
  }, [router]);

  const t = translations[lang];
  const isRTL = lang === "ar";
  const fontClass = lang === "ar" ? "font-cairo" : "font-serif";

  if (isLoading || checkingSession) {
    return (
      <div className="fixed inset-0 min-h-screen bg-black flex items-center justify-center z-50">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          <h1 className="text-gold text-6xl font-bold tracking-wider mb-4">RAED COIF</h1>
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="w-12 h-12 border-4 border-gold/30 border-t-gold rounded-full mx-auto"
          />
        </motion.div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      const result = await signIn(email, password);
      if (!result.success) {
        setError(result.error || t.error);
        setIsSubmitting(false);
      }
    } catch (err) {
      console.warn("⚠️ Erreur lors de la connexion:", err);
      setError(t.error);
      setIsSubmitting(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !resetEmail.trim()) return;
    setResetStatus("sending");
    try {
      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(
        resetEmail.trim().toLowerCase(),
        { redirectTo: `${window.location.origin}/auth/reset-password` }
      );
      if (resetErr) {
        console.error("Reset error:", resetErr.message);
        setResetStatus("error");
      } else {
        setResetStatus("sent");
      }
    } catch (err) {
      console.error("Reset exception:", err);
      setResetStatus("error");
    }
  };

  const closeResetModal = () => {
    setShowResetModal(false);
    setResetEmail("");
    setResetStatus("idle");
  };

  // Icône œil partagée
  const EyeIcon = ({ visible }: { visible: boolean }) =>
    visible ? (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
      </svg>
    ) : (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
      </svg>
    );

  return (
    <div
      className={`min-h-screen flex items-center justify-center p-4 ${fontClass}`}
      dir={isRTL ? "rtl" : "ltr"}
    >
      <button
        onClick={() => setLang(l => l === "fr" ? "ar" : "fr")}
        className="absolute top-8 right-8 px-4 py-2 bg-gold/10 hover:bg-gold/20 text-gold border border-gold/30 rounded-lg transition-all duration-300 font-medium"
      >
        {lang === "fr" ? "العربية" : "Français"}
      </button>

      <div className="w-full max-w-md">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="bg-zinc-900/70 backdrop-blur-xl border border-gold/20 rounded-3xl p-8 shadow-2xl"
        >
          <div className={`mb-8 ${isRTL ? "text-right" : "text-left"}`}>
            <h2 className="text-gold text-sm tracking-[0.3em] uppercase mb-2">RAED COIF</h2>
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

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <label
                htmlFor="email"
                className={`block text-sm font-medium text-zinc-300 mb-2 ${isRTL ? "text-right" : "text-left"}`}
              >
                {t.email}
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 bg-zinc-800/50 border border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold transition-all duration-300 text-white placeholder-zinc-500"
                placeholder={t.email}
              />
            </div>

            {/* Mot de passe + lien oublié */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="password" className="text-sm font-medium text-zinc-300">
                  {t.password}
                </label>
                <button
                  type="button"
                  onClick={() => { setResetEmail(email); setShowResetModal(true); }}
                  className="text-xs text-gold/70 hover:text-gold transition-colors underline underline-offset-2"
                >
                  {t.forgotPassword}
                </button>
              </div>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-4 py-3 pr-12 bg-zinc-800/50 border border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold transition-all duration-300 text-white placeholder-zinc-500"
                  placeholder={t.password}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute inset-y-0 right-3 flex items-center text-zinc-400 hover:text-gold transition-colors"
                  tabIndex={-1}
                  aria-label={showPassword ? "Masquer" : "Afficher"}
                >
                  <EyeIcon visible={showPassword} />
                </button>
              </div>
            </div>

            <motion.button
              type="submit"
              disabled={isSubmitting}
              whileHover={{ scale: isSubmitting ? 1 : 1.02 }}
              whileTap={{ scale: isSubmitting ? 1 : 0.98 }}
              className={`w-full bg-gold hover:bg-gold/90 text-black font-bold py-3 px-4 rounded-xl transition-all duration-300 shadow-lg hover:shadow-gold/50 ${
                isSubmitting ? "opacity-50 cursor-not-allowed" : ""
              }`}
            >
              {isSubmitting ? "..." : t.login}
            </motion.button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-zinc-400 text-sm">
              {t.noAccount}{" "}
              <a href="/auth/signup" className="text-gold hover:underline">{t.signup}</a>
            </p>
          </div>

          <div className="mt-8 pt-6 border-t border-zinc-800">
            <a href="/" className="block text-center text-zinc-400 hover:text-gold transition-colors duration-300">
              {t.backHome}
            </a>
          </div>
        </motion.div>
      </div>

      {/* ── Modal Mot de passe oublié ── */}
      <AnimatePresence>
        {showResetModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeResetModal}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className={`bg-zinc-900 border border-gold/30 rounded-3xl p-8 w-full max-w-md shadow-2xl shadow-gold/10 ${fontClass}`}
              dir={isRTL ? "rtl" : "ltr"}
            >
              {/* Icône */}
              <div className="w-14 h-14 bg-gold/10 border border-gold/30 rounded-2xl flex items-center justify-center mx-auto mb-5">
                <svg className="w-7 h-7 text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
              </div>

              <h2 className="text-xl font-bold text-white text-center mb-1">{t.resetTitle}</h2>
              <p className="text-zinc-400 text-sm text-center mb-6">{t.resetSubtitle}</p>

              {/* État succès */}
              {resetStatus === "sent" ? (
                <div className="text-center space-y-4">
                  <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-xl text-green-400 text-sm">
                    {t.resetSuccess}
                  </div>
                  <button
                    onClick={closeResetModal}
                    className="w-full py-3 bg-gold hover:bg-gold/90 text-black font-bold rounded-xl transition-all"
                  >
                    OK
                  </button>
                </div>
              ) : (
                <form onSubmit={handleResetPassword} className="space-y-4">
                  {resetStatus === "error" && (
                    <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm text-center">
                      {t.resetError}
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-2">
                      {t.resetEmail}
                    </label>
                    <input
                      type="email"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      required
                      placeholder="exemple@email.com"
                      className="w-full px-4 py-3 bg-zinc-800/50 border border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold transition-all text-white placeholder-zinc-500"
                    />
                  </div>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={closeResetModal}
                      className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold rounded-xl transition-all"
                    >
                      {t.resetCancel}
                    </button>
                    <button
                      type="submit"
                      disabled={resetStatus === "sending"}
                      className="flex-1 py-3 bg-gold hover:bg-gold/90 disabled:opacity-50 text-black font-bold rounded-xl transition-all"
                    >
                      {resetStatus === "sending" ? (
                        <span className="flex items-center justify-center gap-2">
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                            className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full"
                          />
                          {t.resetSending}
                        </span>
                      ) : t.resetSend}
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
