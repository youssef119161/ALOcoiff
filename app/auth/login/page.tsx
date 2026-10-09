"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../context/AuthContext";
import { motion } from "framer-motion";

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
  },
};

export default function LoginPage() {
  const [lang, setLang] = useState<Language>("fr");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { signIn, isLoading } = useAuth();
  const router = useRouter();

  const t = translations[lang];
  const isRTL = lang === "ar";
  const fontClass = lang === "ar" ? "font-cairo" : "font-serif";

  if (isLoading) {
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

  const toggleLanguage = () => {
    setLang(lang === "fr" ? "ar" : "fr");
  };

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
      console.warn('⚠️ Erreur lors de la connexion:', err);
      setError(t.error);
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className={`min-h-screen flex items-center justify-center p-4 ${fontClass}`}
      dir={isRTL ? "rtl" : "ltr"}
    >
      <button
        onClick={toggleLanguage}
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

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className={`block text-sm font-medium text-zinc-300 mb-2 ${
                  isRTL ? "text-right" : "text-left"
                }`}
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

            <div>
              <label
                htmlFor="password"
                className={`block text-sm font-medium text-zinc-300 mb-2 ${
                  isRTL ? "text-right" : "text-left"
                }`}
              >
                {t.password}
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-3 bg-zinc-800/50 border border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold transition-all duration-300 text-white placeholder-zinc-500"
                placeholder={t.password}
              />
            </div>

            <motion.button
              type="submit"
              disabled={isSubmitting}
              whileHover={{ scale: isSubmitting ? 1 : 1.02 }}
              whileTap={{ scale: isSubmitting ? 1 : 0.98 }}
              className={`w-full bg-gold hover:bg-gold/90 text-black font-bold py-3 px-4 rounded-xl transition-all duration-300 transform shadow-lg hover:shadow-gold/50 ${
                isSubmitting ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {isSubmitting ? '...' : t.login}
            </motion.button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-zinc-400 text-sm">
              {t.noAccount}{" "}
              <a href="/auth/signup" className="text-gold hover:underline">
                {t.signup}
              </a>
            </p>
          </div>

          <div className="mt-8 pt-6 border-t border-zinc-800">
            <a
              href="/"
              className="block text-center text-zinc-400 hover:text-gold transition-colors duration-300"
            >
              {t.backHome}
            </a>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
