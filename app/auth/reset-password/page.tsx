"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import { motion } from "framer-motion";

type Language = "fr" | "ar";

const translations = {
  fr: {
    title: "Nouveau mot de passe",
    subtitle: "Choisissez un mot de passe sécurisé",
    newPassword: "Nouveau mot de passe",
    confirmPassword: "Confirmer le mot de passe",
    submit: "Mettre à jour",
    submitting: "Mise à jour...",
    successTitle: "Mot de passe mis à jour !",
    successMsg: "Votre mot de passe a été changé. Vous allez être redirigé vers la connexion.",
    errorMismatch: "Les mots de passe ne correspondent pas.",
    errorShort: "Le mot de passe doit contenir au moins 6 caractères.",
    errorGeneral: "Une erreur est survenue. Réessayez ou demandez un nouveau lien.",
    errorNoSession: "Lien expiré ou invalide. Demandez un nouveau lien de réinitialisation.",
    backLogin: "← Retour à la connexion",
    goLogin: "Aller à la connexion",
  },
  ar: {
    title: "كلمة مرور جديدة",
    subtitle: "اختر كلمة مرور آمنة",
    newPassword: "كلمة المرور الجديدة",
    confirmPassword: "تأكيد كلمة المرور",
    submit: "تحديث",
    submitting: "جارٍ التحديث...",
    successTitle: "تم تحديث كلمة المرور!",
    successMsg: "تم تغيير كلمة مرورك. ستُعاد توجيهتك إلى صفحة تسجيل الدخول.",
    errorMismatch: "كلمتا المرور غير متطابقتين.",
    errorShort: "يجب أن تحتوي كلمة المرور على 6 أحرف على الأقل.",
    errorGeneral: "حدث خطأ. أعد المحاولة أو اطلب رابطًا جديدًا.",
    errorNoSession: "الرابط منتهي الصلاحية أو غير صالح. اطلب رابط إعادة تعيين جديدًا.",
    backLogin: "← العودة إلى تسجيل الدخول",
    goLogin: "الذهاب إلى تسجيل الدخول",
  },
};

function ResetPasswordContent() {
  const [lang, setLang] = useState<Language>("fr");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error" | "no-session">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [sessionReady, setSessionReady] = useState(false);
  const router = useRouter();

  const t = translations[lang];
  const isRTL = lang === "ar";
  const fontClass = lang === "ar" ? "font-cairo" : "font-serif";

  // Supabase envoie le token via le fragment #access_token=...&type=recovery
  // onAuthStateChange intercepte automatiquement ce fragment et crée la session
  useEffect(() => {
    if (!supabase) { setStatus("no-session"); return; }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" && session) {
        setSessionReady(true);
      }
    });

    // Vérifier si une session existe déjà (rechargement de page)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setSessionReady(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (newPassword.length < 6) {
      setErrorMsg(t.errorShort);
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg(t.errorMismatch);
      return;
    }
    if (!supabase) { setStatus("no-session"); return; }

    setStatus("submitting");

    const { error } = await supabase.auth.updateUser({ password: newPassword });

    if (error) {
      console.error("updateUser error:", error.message);
      setErrorMsg(t.errorGeneral);
      setStatus("error");
    } else {
      setStatus("success");
      // Déconnecter proprement puis rediriger
      setTimeout(async () => {
        await supabase!.auth.signOut();
        router.replace("/auth/login");
      }, 3000);
    }
  };

  return (
    <div
      className={`min-h-screen flex items-center justify-center p-4 ${fontClass}`}
      dir={isRTL ? "rtl" : "ltr"}
    >
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-black via-zinc-900 to-black" />
      <div className="absolute top-20 left-20 w-96 h-96 bg-gold/5 rounded-full blur-3xl" />
      <div className="absolute bottom-20 right-20 w-96 h-96 bg-gold/5 rounded-full blur-3xl" />

      {/* Lang toggle */}
      <button
        onClick={() => setLang(l => l === "fr" ? "ar" : "fr")}
        className="fixed top-8 right-8 z-50 px-4 py-2 bg-gold/10 hover:bg-gold/20 text-gold border border-gold/30 rounded-lg transition-all font-medium"
      >
        {lang === "fr" ? "العربية" : "Français"}
      </button>

      <div className="relative z-10 w-full max-w-md">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="bg-zinc-900/80 backdrop-blur-xl border border-gold/20 rounded-3xl p-8 shadow-2xl"
        >
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-14 h-14 bg-gold/10 border border-gold/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h2 className="text-gold text-xs tracking-[0.4em] uppercase mb-1">RAED COIF</h2>
            <h1 className="text-3xl font-bold text-white mb-1">{t.title}</h1>
            <p className="text-zinc-400 text-sm">{t.subtitle}</p>
          </div>

          {/* Lien invalide / expiré */}
          {status === "no-session" && (
            <div className="text-center space-y-4">
              <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
                {t.errorNoSession}
              </div>
              <a
                href="/auth/login"
                className="block w-full py-3 bg-gold hover:bg-gold/90 text-black font-bold rounded-xl transition-all text-center"
              >
                {t.goLogin}
              </a>
            </div>
          )}

          {/* Succès */}
          {status === "success" && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center space-y-4"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 400, delay: 0.1 }}
                className="w-16 h-16 bg-green-500/20 border-2 border-green-500/50 rounded-full flex items-center justify-center mx-auto"
              >
                <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </motion.div>
              <h3 className="text-xl font-bold text-white">{t.successTitle}</h3>
              <p className="text-zinc-400 text-sm">{t.successMsg}</p>
              <div className="flex justify-center">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  className="w-5 h-5 border-2 border-gold/30 border-t-gold rounded-full"
                />
              </div>
            </motion.div>
          )}

          {/* Formulaire */}
          {status !== "no-session" && status !== "success" && (
            <>
              {!sessionReady && (
                <div className="text-center py-6">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    className="w-8 h-8 border-4 border-gold/30 border-t-gold rounded-full mx-auto mb-3"
                  />
                  <p className="text-zinc-500 text-sm">Vérification du lien...</p>
                </div>
              )}

              {sessionReady && (
                <form onSubmit={handleSubmit} className="space-y-4">
                  {errorMsg && (
                    <motion.div
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm text-center"
                    >
                      {errorMsg}
                    </motion.div>
                  )}

                  {/* Nouveau mot de passe */}
                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-2">
                      {t.newPassword}
                    </label>
                    <div className="relative">
                      <input
                        type={showNew ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        required
                        placeholder="••••••••"
                        className="w-full px-4 py-3 pr-12 bg-zinc-800/50 border border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold transition-all text-white placeholder-zinc-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNew(v => !v)}
                        className="absolute inset-y-0 right-3 flex items-center text-zinc-400 hover:text-gold transition-colors"
                        tabIndex={-1}
                      >
                        {showNew ? (
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
                  </div>

                  {/* Confirmation */}
                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-2">
                      {t.confirmPassword}
                    </label>
                    <div className="relative">
                      <input
                        type={showConfirm ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        placeholder="••••••••"
                        className="w-full px-4 py-3 pr-12 bg-zinc-800/50 border border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold transition-all text-white placeholder-zinc-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirm(v => !v)}
                        className="absolute inset-y-0 right-3 flex items-center text-zinc-400 hover:text-gold transition-colors"
                        tabIndex={-1}
                      >
                        {showConfirm ? (
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
                  </div>

                  <motion.button
                    type="submit"
                    disabled={status === "submitting"}
                    whileHover={{ scale: status === "submitting" ? 1 : 1.02 }}
                    whileTap={{ scale: status === "submitting" ? 1 : 0.98 }}
                    className="w-full bg-gold hover:bg-gold/90 disabled:opacity-50 text-black font-bold py-3 rounded-xl transition-all shadow-lg"
                  >
                    {status === "submitting" ? (
                      <span className="flex items-center justify-center gap-2">
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                          className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full"
                        />
                        {t.submitting}
                      </span>
                    ) : t.submit}
                  </motion.button>
                </form>
              )}
            </>
          )}

          {/* Lien retour */}
          {status !== "success" && (
            <div className="mt-6 text-center">
              <a
                href="/auth/login"
                className="text-zinc-500 hover:text-gold text-sm transition-colors"
              >
                {t.backLogin}
              </a>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-yellow-500/30 border-t-yellow-500 rounded-full animate-spin" />
      </div>
    }>
      <ResetPasswordContent />
    </Suspense>
  );
}
