"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { supabase } from "../lib/supabase";

type Language = "fr" | "ar";

const translations = {
  fr: {
    title: "RAED COIF",
    subtitle: "L'Excellence au Service de Votre Style",
    description: "Découvrez nos services de coiffure professionnelle avec des experts passionnés",
    clientSpace: "Espace Client",
    clientDesc: "Choisissez votre expert et réservez",
    coiffeurSpace: "Espace Coiffeur",
    coiffeurDesc: "Connexion professionnelle",
    signupSpace: "Devenir Coiffeur",
    signupDesc: "Rejoignez notre équipe",
  },
  ar: {
    title: "RAED COIF",
    subtitle: "التميز في خدمة أسلوبك",
    description: "اكتشف خدمات تصفيف الشعر الاحترافية مع خبراء متحمسين",
    clientSpace: "مساحة العميل",
    clientDesc: "اختر خبيرك واحجز موعدك",
    coiffeurSpace: "مساحة المصفف",
    coiffeurDesc: "تسجيل دخول المحترفين",
    signupSpace: "كن مصفف شعر",
    signupDesc: "انضم إلى فريقنا",
  },
};

export default function LandingPage() {
  const [lang, setLang] = useState<Language>("fr");

  const t = translations[lang];
  const isRTL = lang === "ar";
  const fontClass = lang === "ar" ? "font-cairo" : "font-serif";

  // Redirection auto si déjà connecté en tant que coiffeur ou admin
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user) return;
      const { data: profile } = await supabase!
        .from("profiles")
        .select("id, role")
        .eq("id", session.user.id)
        .single();
      if (!profile) return;
      if (profile.role === "admin") {
        window.location.replace("/admin/dashboard");
      } else {
        // Coiffeur → son espace
        window.location.replace(`/admin/${profile.id}`);
      }
    });
  }, []);

  const toggleLanguage = () => {
    setLang(lang === "fr" ? "ar" : "fr");
  };

  return (
    <div
      className={`min-h-screen flex items-center justify-center p-8 ${fontClass} relative overflow-hidden`}
      dir={isRTL ? "rtl" : "ltr"}
    >
      {/* Background Effects */}
      <div className="absolute inset-0 bg-gradient-to-br from-black via-zinc-900 to-black"></div>
      <div className="absolute top-20 left-20 w-96 h-96 bg-gold/5 rounded-full blur-3xl"></div>
      <div className="absolute bottom-20 right-20 w-96 h-96 bg-gold/5 rounded-full blur-3xl"></div>

      {/* Language Toggle */}
      <button
        onClick={toggleLanguage}
        className="absolute top-8 right-8 z-50 px-5 py-2.5 bg-gold/10 hover:bg-gold/20 text-gold border border-gold/30 rounded-xl transition-all duration-300 font-medium"
      >
        {lang === "fr" ? "العربية" : "Français"}
      </button>

      {/* Main Content */}
      <div className="relative z-10 max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center mb-16"
        >
          <h1 className="text-7xl md:text-8xl font-bold text-gold mb-6 tracking-wider leading-luxury">
            {t.title}
          </h1>
          <p className="text-2xl md:text-3xl text-white mb-4 leading-luxury">
            {t.subtitle}
          </p>
          <p className="text-lg text-zinc-400 leading-luxury">
            {t.description}
          </p>
        </motion.div>

        {/* Action Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Client Space */}
          <motion.a
            href="/coiffeurs"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            whileHover={{ scale: 1.05, y: -10 }}
            whileTap={{ scale: 0.98 }}
            className="group relative bg-zinc-900/70 backdrop-blur-xl border-2 border-gold/20 hover:border-gold rounded-3xl p-8 transition-all duration-500 shadow-2xl hover:shadow-gold/30"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-gold/5 to-transparent rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <div className="relative z-10">
              <div className="w-16 h-16 bg-gold/10 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-gold/20 transition-all duration-300">
                <svg className="w-8 h-8 text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-gold mb-3 leading-luxury">
                {t.clientSpace}
              </h3>
              <p className="text-zinc-400 leading-luxury">
                {t.clientDesc}
              </p>
              <div className="mt-6 flex items-center text-gold group-hover:translate-x-2 transition-transform duration-300">
                <span className="mr-2">→</span>
                <span className="text-sm font-semibold">Voir les experts</span>
              </div>
            </div>
          </motion.a>

          {/* Coiffeur Login */}
          <motion.a
            href="/auth/login"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            whileHover={{ scale: 1.05, y: -10 }}
            whileTap={{ scale: 0.98 }}
            className="group relative bg-zinc-900/70 backdrop-blur-xl border-2 border-gold/20 hover:border-gold rounded-3xl p-8 transition-all duration-500 shadow-2xl hover:shadow-gold/30"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-gold/5 to-transparent rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <div className="relative z-10">
              <div className="w-16 h-16 bg-gold/10 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-gold/20 transition-all duration-300">
                <svg className="w-8 h-8 text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-gold mb-3 leading-luxury">
                {t.coiffeurSpace}
              </h3>
              <p className="text-zinc-400 leading-luxury">
                {t.coiffeurDesc}
              </p>
              <div className="mt-6 flex items-center text-gold group-hover:translate-x-2 transition-transform duration-300">
                <span className="mr-2">→</span>
                <span className="text-sm font-semibold">Connexion</span>
              </div>
            </div>
          </motion.a>

          {/* Signup */}
          <motion.a
            href="/auth/signup"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            whileHover={{ scale: 1.05, y: -10 }}
            whileTap={{ scale: 0.98 }}
            className="group relative bg-gradient-to-br from-gold/20 to-gold/5 backdrop-blur-xl border-2 border-gold hover:border-gold rounded-3xl p-8 transition-all duration-500 shadow-2xl hover:shadow-gold/50"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-gold/10 to-transparent rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <div className="relative z-10">
              <div className="w-16 h-16 bg-gold/20 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-gold/30 transition-all duration-300">
                <svg className="w-8 h-8 text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-gold mb-3 leading-luxury">
                {t.signupSpace}
              </h3>
              <p className="text-zinc-300 leading-luxury">
                {t.signupDesc}
              </p>
              <div className="mt-6 flex items-center text-gold group-hover:translate-x-2 transition-transform duration-300">
                <span className="mr-2">→</span>
                <span className="text-sm font-semibold">S'inscrire</span>
              </div>
            </div>
          </motion.a>
        </div>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="text-center mt-16"
        >
          <p className="text-zinc-500 text-sm">
            © 2024 RAED COIF - Tous droits réservés
          </p>
        </motion.div>
      </div>
    </div>
  );
}
