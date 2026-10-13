"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { supabase } from "../../../lib/supabase";
import {
  getAuthProfile,
  destinationFor,
  isSubscriptionActive,
  PENDING_PATH,
  LOGIN_PATH,
  type AuthProfile,
} from "../../../lib/authRedirect";

type Language = "fr" | "ar";

// Filet de sécurité si le realtime n'est pas activé sur la table profiles
const POLL_INTERVAL_MS = 20000;

export default function PendingApprovalPage() {
  const [lang, setLang] = useState<Language>("fr");
  const [ready, setReady] = useState(false);
  const [trialEnd, setTrialEnd] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const router = useRouter();

  const isRTL = lang === "ar";
  const fontClass = lang === "ar" ? "font-cairo" : "font-serif";

  useEffect(() => {
    if (!supabase) { router.replace(LOGIN_PATH); return; }

    let active = true;
    let channel: ReturnType<NonNullable<typeof supabase>["channel"]> | null = null;
    let poll: ReturnType<typeof setInterval> | null = null;

    const recheck = async () => {
      const profile = await getAuthProfile();
      if (!active) return null;
      const dest = destinationFor(profile);
      if (dest !== PENDING_PATH) { router.replace(dest); return null; }
      return profile;
    };

    recheck().then((profile) => {
      if (!profile || !active) return;

      // Approuvé mais abonnement échu → attente de renouvellement, pas de validation
      setExpired(profile.is_approved === true && !isSubscriptionActive(profile));
      if (profile.subscription_status === "trial" && isSubscriptionActive(profile)) {
        setTrialEnd(profile.subscription_end);
      }
      setReady(true);

      channel = supabase!
        .channel(`pending-approval-${profile.id}`)
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${profile.id}` },
          (payload) => {
            const dest = destinationFor({ ...profile, ...(payload.new as Partial<AuthProfile>) });
            if (dest !== PENDING_PATH) window.location.replace(dest);
          }
        )
        .subscribe();

      poll = setInterval(recheck, POLL_INTERVAL_MS);
    });

    return () => {
      active = false;
      if (channel) supabase?.removeChannel(channel);
      if (poll) clearInterval(poll);
    };
  }, [router]);

  const handleLogout = async () => {
    if (supabase) await supabase.auth.signOut();
    router.replace(LOGIN_PATH);
  };

  if (!ready) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-12 h-12 border-4 border-gold/30 border-t-gold rounded-full" />
      </div>
    );
  }

  return (
    <div className={`fixed inset-0 bg-black flex items-center justify-center p-8 ${fontClass}`}
      dir={isRTL ? "rtl" : "ltr"}>
      <div className="absolute inset-0 bg-gradient-to-br from-black via-zinc-900 to-black" />
      <div className="absolute top-20 left-20 w-96 h-96 bg-gold/5 rounded-full blur-3xl" />

      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
        className="relative z-10 max-w-md w-full text-center">
        <div className="bg-zinc-900/80 backdrop-blur-xl border border-gold/20 rounded-3xl p-10 shadow-2xl">
          <motion.div
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            className="w-20 h-20 bg-gold/10 border-2 border-gold/30 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </motion.div>

          <h2 className="text-gold text-xs tracking-[0.4em] uppercase mb-3">RAED COIF</h2>
          <h1 className="text-2xl font-bold text-white mb-4">
            {expired
              ? (lang === "ar" ? "انتهى اشتراكك" : "Votre abonnement a expiré")
              : (lang === "ar" ? "حسابك قيد المراجعة من طرف المسؤول" : "Votre compte est en cours de validation par l'administrateur")}
          </h1>
          <p className="text-zinc-400 text-sm leading-relaxed mb-8">
            {expired
              ? (lang === "ar"
                ? "يرجى التواصل مع الإدارة لتجديد اشتراكك. ستُفتح لوحة التحكم تلقائيًا عند التجديد."
                : "Contactez l'administrateur pour renouveler votre abonnement. Votre espace se rouvrira automatiquement dès le renouvellement.")
              : (lang === "ar"
                ? "شكرًا على تسجيلك. ستُفتح لوحة التحكم تلقائيًا عند التفعيل."
                : "Merci pour votre inscription. Votre espace s'ouvrira automatiquement dès l'activation.")}
          </p>

          {trialEnd && (
            <div className="mb-6 p-3 bg-gold/10 border border-gold/30 rounded-xl text-gold text-sm">
              {lang === "ar"
                ? `🎁 فترتك التجريبية المجانية مفعّلة حتى ${new Date(trialEnd).toLocaleDateString("ar-TN")}`
                : `🎁 Essai gratuit de 30 jours activé — jusqu'au ${new Date(trialEnd).toLocaleDateString("fr-FR")}`}
            </div>
          )}

          <div className="flex items-center justify-center gap-2 text-xs text-zinc-500 mb-6">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            {lang === "ar" ? "في انتظار التفعيل..." : "En attente d'activation..."}
          </div>

          <div className="flex gap-3">
            <button onClick={() => setLang(l => l === "fr" ? "ar" : "fr")}
              className="flex-1 py-2.5 bg-gold/10 hover:bg-gold/20 text-gold border border-gold/30 rounded-xl text-sm transition-all">
              {lang === "fr" ? "العربية" : "Français"}
            </button>
            <button onClick={handleLogout}
              className="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded-xl text-sm transition-all">
              {lang === "ar" ? "تسجيل الخروج" : "Déconnexion"}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
