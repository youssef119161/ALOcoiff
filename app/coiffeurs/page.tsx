"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "../../lib/supabase";
import { isAdminEmail } from "../../lib/authRules";
import type { User } from "@supabase/supabase-js";

type Language = "fr" | "ar";

interface CoiffeurPublic {
  id: string;
  name: string | null;
  name_ar: string | null;
  specialty: string | null;
  specialty_ar: string | null;
  avatar_url: string | null;
  video_url: string | null;
  city: string | null;
  subscription_status: string | null;
  is_approved: boolean | null;
  email: string | null;
  role: string | null;
}

interface ActiveBooking {
  id: string;
  coiffeur_id: string;
  client_name: string;
  booking_date: string;
  booking_time: string;
  status: string;
  coiffeur?: CoiffeurPublic | null;
}


const isValidVideoUrl = (url: string): boolean => {
  if (!url || url === "undefined" || url === "null") return false;
  try {
    const u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;
    if (url.includes("drive.google.com") || url.includes("dropbox")) return true;
    return [".mp4", ".webm", ".mov", ".ogg"].some(ext => u.pathname.toLowerCase().endsWith(ext));
  } catch { return false; }
};

const sanitizeVideoUrl = (url: string): string => {
  if (!url) return "";
  let u = url.trim();
  if (u.includes("drive.google.com")) {
    const m = u.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (m) return `https://drive.google.com/uc?export=download&id=${m[1]}`;
  }
  if (u.includes("dropbox.com")) {
    u = u.replace("www.dropbox.com", "dl.dropboxusercontent.com").replace("?dl=0", "?dl=1");
    if (!u.includes("?dl=")) u += "?dl=1";
  }
  return u;
};

const FAVORITES_KEY = "raedcoif_favorites";
const loadFavorites = (): Set<string> => {
  if (typeof window === "undefined") return new Set();
  try { return new Set(JSON.parse(localStorage.getItem(FAVORITES_KEY) || "[]")); }
  catch { return new Set(); }
};
const saveFavorites = (favs: Set<string>) => {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify([...favs]));
};

export default function CoiffeursPage() {
  const [lang, setLang] = useState<Language>("fr");
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // ── État pivot : null = on ne sait pas encore, false = pas de booking, true = booking trouvé
  // showExperts est dérivé : on affiche la liste UNIQUEMENT si pageReady && !activeBooking
  const [pageReady, setPageReady] = useState(false);
  const [activeBooking, setActiveBooking] = useState<ActiveBooking | null>(null);

  const [coiffeurs, setCoiffeurs] = useState<CoiffeurPublic[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [dbError, setDbError] = useState("");
  const [videoErrors, setVideoErrors] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [cancelLoading, setCancelLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const isRTL = lang === "ar";
  const fontClass = lang === "ar" ? "font-cairo" : "font-serif";

  // ── 1. Auth listener — met à jour user uniquement, pas de requêtes async ──
  useEffect(() => {
    if (!supabase) { setAuthLoading(false); return; }

    // Lire la session initiale de façon synchrone
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setAuthLoading(false);
    }).catch(() => {
      setAuthLoading(false);
    });

    // Écouter les changements de session (login/logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // ── 2. Séquence STRICTE une fois auth connue ──
  useEffect(() => {
    if (authLoading) return;
    setFavorites(loadFavorites());

    if (!user) {
      setPageReady(true);
      return;
    }

    // AbortController pour annuler proprement si user change ou composant démonté
    const controller = new AbortController();
    const { signal } = controller;

    const init = async () => {
      try {
        const hasBooking = await checkActiveBooking(user, signal);
        if (signal.aborted) return;
        if (!hasBooking) {
          await fetchCoiffeurs(signal);
        }
        if (!signal.aborted) setPageReady(true);
      } catch (err: any) {
        if (signal.aborted || err?.name === "AbortError") return;
        console.error("Erreur init coiffeurs:", err);
        if (!signal.aborted) setPageReady(true);
      }
    };

    init();
    return () => controller.abort();
  }, [authLoading, user]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Helpers ──
  const handleGoogleLogin = async () => {
    if (!supabase) return;
    setGoogleLoading(true);
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/coiffeurs`,
        queryParams: { access_type: "offline", prompt: "consent" },
      },
    });
  };

  const handleLogout = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setUser(null);
    setActiveBooking(null);
    setCoiffeurs([]);
    setPageReady(false);
  };

  /** Retourne true si booking actif trouvé, false sinon. */
  const checkActiveBooking = async (u: User, signal: AbortSignal): Promise<boolean> => {
    if (!supabase) return false;

    try {
      let { data } = await supabase
        .from("bookings")
        .select("*")
        .eq("client_id", u.id)
        .in("status", ["pending", "accepted"])
        .order("created_at", { ascending: false })
        .limit(1);

      if (signal.aborted) return false;

      // Fallback par nom pour anciens bookings sans client_id
      if (!data || data.length === 0) {
        const userName = u.user_metadata?.full_name || u.email || "";
        const fallback = await supabase
          .from("bookings")
          .select("*")
          .eq("client_name", userName)
          .in("status", ["pending", "accepted"])
          .order("created_at", { ascending: false })
          .limit(1);
        if (signal.aborted) return false;
        data = fallback.data;
      }

      if (data && data.length > 0) {
        const booking = data[0] as ActiveBooking;
        const { data: coiffeurData } = await supabase
          .from("profiles")
          .select("id, name, name_ar, avatar_url, specialty, specialty_ar, video_url, city, subscription_status, is_approved, email, role")
          .eq("id", booking.coiffeur_id)
          .single();
        if (signal.aborted) return false;
        booking.coiffeur = coiffeurData;
        setActiveBooking(booking);
        return true;
      }

      setActiveBooking(null);
      return false;
    } catch (err: any) {
      if (err?.name === "AbortError") return false;
      console.error("checkActiveBooking error:", err?.message);
      return false;
    }
  };

  const fetchCoiffeurs = async (signal: AbortSignal) => {
    if (!supabase) { setDbError("Supabase non configuré"); return; }
    setIsLoading(true);
    try {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("is_approved", true)
        .eq("role", "coiffeur")
        .gte("subscription_end", now);
      if (signal.aborted) return;
      if (error) {
        console.error("fetchCoiffeurs error:", error.message);
        setDbError(`Erreur: ${error.message}`);
        return;
      }
      const list = (data || []).filter(
        (p: CoiffeurPublic) => !isAdminEmail(p.email)
      );
      setCoiffeurs(list);
      setDbError("");
    } catch (err: any) {
      if (signal.aborted || err?.name === "AbortError") return;
      console.error("fetchCoiffeurs exception:", err?.message);
      setDbError("Erreur lors du chargement");
    } finally {
      if (!signal.aborted) setIsLoading(false);
    }
  };
  const handleCancelBooking = async () => {
    if (!supabase || !activeBooking) return;
    setCancelLoading(true);
    await supabase.from("bookings").delete().eq("id", activeBooking.id);
    setActiveBooking(null);
    // Booking annulé → charger les experts avec un signal jetable
    const ctrl = new AbortController();
    await fetchCoiffeurs(ctrl.signal);
    setCancelLoading(false);
  };

  const toggleFavorite = (id: string) => {
    setFavorites(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      saveFavorites(next);
      return next;
    });
  };

  const cities = useMemo(() =>
    [...new Set(coiffeurs.map(c => c.city).filter(Boolean))] as string[],
    [coiffeurs]
  );

  const filtered = useMemo(() => {
    let list = [...coiffeurs];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(c => (c.name || "").toLowerCase().includes(q) || (c.name_ar || "").includes(q));
    }
    if (cityFilter) list = list.filter(c => c.city === cityFilter);
    list.sort((a, b) => (favorites.has(a.id) ? 0 : 1) - (favorites.has(b.id) ? 0 : 1));
    return list;
  }, [coiffeurs, search, cityFilter, favorites]);

  // ════════════════════════════════════════════
  // RENDU — ordre strict, pas de chevauchement
  // ════════════════════════════════════════════

  // Spinner global tant qu'on ne sait pas où on en est
  if (!pageReady) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-12 h-12 border-4 border-gold/30 border-t-gold rounded-full" />
      </div>
    );
  }

  // ── Non connecté : page de login ──
  if (!user) {
    return (
      <div className={`min-h-screen flex items-center justify-center p-8 ${fontClass}`} dir={isRTL ? "rtl" : "ltr"}>
        <div className="absolute inset-0 bg-gradient-to-br from-black via-zinc-900 to-black" />
        <div className="absolute top-20 left-20 w-96 h-96 bg-gold/5 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-gold/5 rounded-full blur-3xl" />
        <button onClick={() => setLang(l => l === "fr" ? "ar" : "fr")}
          className="fixed top-8 right-8 z-50 px-4 py-2 bg-gold/10 hover:bg-gold/20 text-gold border border-gold/30 rounded-lg transition-all font-medium">
          {lang === "fr" ? "العربية" : "Français"}
        </button>
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
          className="relative z-10 max-w-md w-full text-center">
          <h2 className="text-gold text-sm tracking-[0.4em] uppercase mb-4">RAED COIF</h2>
          <h1 className="text-5xl font-bold text-white mb-4">{lang === "ar" ? "خبراؤنا" : "Nos Experts"}</h1>
          <p className="text-zinc-400 mb-10 leading-relaxed">
            {lang === "ar" ? "سجّل دخولك لاختيار مصففك والحجز في ثوانٍ" : "Connectez-vous pour choisir votre expert et réserver en quelques secondes"}
          </p>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="bg-zinc-900/70 backdrop-blur-xl border border-gold/20 rounded-3xl p-8 shadow-2xl">
            <div className="w-16 h-16 bg-gold/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-white mb-2">{lang === "ar" ? "ابدأ الحجز" : "Commencer à réserver"}</h3>
            <p className="text-zinc-500 text-sm mb-8">{lang === "ar" ? "حساب Google يكفي للبدء" : "Un compte Google suffit pour commencer"}</p>
            <motion.button onClick={handleGoogleLogin} disabled={googleLoading}
              whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
              className="w-full flex items-center justify-center gap-3 bg-white hover:bg-zinc-100 text-zinc-900 font-bold py-4 px-6 rounded-2xl transition-all shadow-lg disabled:opacity-60">
              {googleLoading ? (
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                  className="w-5 h-5 border-2 border-zinc-400 border-t-zinc-900 rounded-full" />
              ) : (
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
              )}
              {lang === "ar" ? "المتابعة مع Google" : "Continuer avec Google"}
            </motion.button>
            <p className="text-zinc-600 text-xs mt-4">
              {lang === "ar" ? "آمن ومشفر — لا نحتفظ بكلمات المرور" : "Sécurisé — nous ne stockons aucun mot de passe"}
            </p>
          </motion.div>
          <div className="mt-8">
            <a href="/" className="inline-flex items-center gap-2 text-zinc-500 hover:text-gold transition-colors text-sm">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              {lang === "ar" ? "العودة للرئيسية" : "Retour à l'accueil"}
            </a>
          </div>
        </motion.div>
      </div>
    );
  }

  // ── Connecté + booking actif : UNIQUEMENT la carte, rien d'autre ──
  if (activeBooking) {
    const coiffeur = activeBooking.coiffeur;
    const coiffeurName = lang === "ar" ? (coiffeur?.name_ar || coiffeur?.name || "—") : (coiffeur?.name || "—");
    const dateFormatted = new Date(activeBooking.booking_date).toLocaleDateString(
      lang === "ar" ? "ar-TN" : "fr-FR",
      { weekday: "long", day: "numeric", month: "long" }
    );
    const statusColors: Record<string, string> = {
      pending: "text-yellow-400 bg-yellow-500/10 border-yellow-500/30",
      accepted: "text-green-400 bg-green-500/10 border-green-500/30",
    };
    const statusLabels: Record<string, string> = {
      pending: lang === "ar" ? "في الانتظار" : "En attente",
      accepted: lang === "ar" ? "مؤكد" : "Confirmé",
    };

    return (
      <div className={`min-h-screen flex items-center justify-center p-8 ${fontClass}`} dir={isRTL ? "rtl" : "ltr"}>
        <div className="absolute inset-0 bg-gradient-to-br from-black via-zinc-900 to-black" />
        <div className="absolute top-20 left-20 w-96 h-96 bg-gold/5 rounded-full blur-3xl" />
        <button onClick={() => setLang(l => l === "fr" ? "ar" : "fr")}
          className="fixed top-8 right-8 z-50 px-4 py-2 bg-gold/10 hover:bg-gold/20 text-gold border border-gold/30 rounded-lg transition-all font-medium">
          {lang === "fr" ? "العربية" : "Français"}
        </button>
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
          className="relative z-10 max-w-md w-full">
          <div className="text-center mb-8">
            <h2 className="text-gold text-sm tracking-[0.4em] uppercase mb-2">RAED COIF</h2>
            <h1 className="text-3xl font-bold text-white">{lang === "ar" ? "حجزك الحالي" : "Votre réservation"}</h1>
          </div>
          <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }}
            className="bg-zinc-900/80 backdrop-blur-xl border border-gold/30 rounded-3xl p-8 shadow-2xl shadow-gold/10 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-gold/5 to-transparent pointer-events-none" />
            {/* Coiffeur info */}
            <div className="flex items-center gap-4 mb-6 pb-6 border-b border-zinc-800">
              <div className="w-16 h-16 rounded-2xl border-2 border-gold/40 overflow-hidden shrink-0">
                {coiffeur?.avatar_url ? (
                  <img src={coiffeur.avatar_url} alt={coiffeurName} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gold/20 flex items-center justify-center text-gold text-xl font-bold">
                    {(coiffeurName[0] || "?").toUpperCase()}
                  </div>
                )}
              </div>
              <div>
                <p className="text-zinc-400 text-xs mb-1">{lang === "ar" ? "مع الخبير" : "Avec l'expert"}</p>
                <p className="text-white font-bold text-lg">{coiffeurName}</p>
                <p className="text-gold text-sm">{lang === "ar" ? coiffeur?.specialty_ar || coiffeur?.specialty : coiffeur?.specialty}</p>
              </div>
            </div>
            {/* Détails */}
            <div className="space-y-4 mb-6">
              {[
                { icon: "📅", label: lang === "ar" ? "التاريخ" : "Date", value: dateFormatted },
                { icon: "🕐", label: lang === "ar" ? "الوقت" : "Heure", value: activeBooking.booking_time },
              ].map(row => (
                <div key={row.label} className="flex items-center gap-3 bg-zinc-800/50 rounded-xl px-4 py-3">
                  <span className="text-xl">{row.icon}</span>
                  <span className="text-zinc-400 text-sm w-16 shrink-0">{row.label}</span>
                  <span className="text-white font-medium">{row.value}</span>
                </div>
              ))}
              <div className="flex items-center gap-3 bg-zinc-800/50 rounded-xl px-4 py-3">
                <span className="text-xl">📋</span>
                <span className="text-zinc-400 text-sm w-16 shrink-0">{lang === "ar" ? "الحالة" : "Statut"}</span>
                <span className={`text-sm font-semibold px-3 py-0.5 rounded-full border ${statusColors[activeBooking.status] || "text-zinc-400"}`}>
                  {statusLabels[activeBooking.status] || activeBooking.status}
                </span>
              </div>
            </div>
            {/* Actions */}
            <div className="flex gap-3">
              <motion.button
                onClick={async () => {
                  const msg = activeBooking.status === "pending"
                    ? (lang === "ar" ? "هل تريد إلغاء هذا الحجز؟" : "Annuler ce rendez-vous ?")
                    : (lang === "ar" ? "هذا الحجز مؤكد. هل أنت متأكد من الإلغاء؟" : "Ce RDV est confirmé. Annuler quand même ?");
                  if (!confirm(msg)) return;
                  await handleCancelBooking();
                }}
                disabled={cancelLoading}
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                className={`py-3 bg-red-600/20 hover:bg-red-600/30 border border-red-600/40 text-red-400 font-semibold rounded-xl transition-all text-sm disabled:opacity-50 ${activeBooking.status === "pending" ? "flex-1" : "w-full"}`}>
                {cancelLoading ? "..." : (lang === "ar" ? "إلغاء الحجز" : "Annuler le RDV")}
              </motion.button>
              {activeBooking.status === "pending" && (
                <motion.button
                  onClick={async () => {
                    const coiffeurId = activeBooking.coiffeur_id;
                    await handleCancelBooking();
                    window.location.href = `/reservation?coiffeur=${coiffeurId}`;
                  }}
                  disabled={cancelLoading}
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                  className="flex-1 py-3 bg-gold/10 hover:bg-gold/20 border border-gold/30 text-gold font-semibold rounded-xl transition-all text-sm disabled:opacity-50">
                  {lang === "ar" ? "تعديل" : "Modifier"}
                </motion.button>
              )}
            </div>
            {activeBooking.status === "accepted" && (
              <p className="text-zinc-600 text-xs text-center mt-3">
                {lang === "ar" ? "تم تأكيد الحجز — لا يمكن التعديل. يمكنك الإلغاء فقط." : "RDV confirmé — modification impossible. Annulez pour en créer un nouveau."}
              </p>
            )}
          </motion.div>
          <div className="mt-6 flex items-center justify-between">
            <a href="/" className="inline-flex items-center gap-2 text-zinc-500 hover:text-gold transition-colors text-sm">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              {lang === "ar" ? "الرئيسية" : "Accueil"}
            </a>
            <button onClick={handleLogout} className="text-zinc-600 hover:text-zinc-400 text-xs transition-colors">
              {lang === "ar" ? "تسجيل الخروج" : "Déconnexion"}
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // ── Connecté + PAS de booking : liste des experts ──
  // On arrive ici SEULEMENT si activeBooking === null, garanti par la séquence init()
  return (
    <div className={`min-h-screen p-8 ${fontClass}`} dir={isRTL ? "rtl" : "ltr"}>
      <button onClick={() => setLang(l => l === "fr" ? "ar" : "fr")}
        className="fixed top-8 right-8 z-50 px-4 py-2 bg-gold/10 hover:bg-gold/20 text-gold border border-gold/30 rounded-lg transition-all font-medium">
        {lang === "fr" ? "العربية" : "Français"}
      </button>
      <div className="text-center mb-12 max-w-4xl mx-auto">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
          <h2 className="text-gold text-sm tracking-[0.3em] uppercase mb-2">RAED COIF</h2>
          <h1 className="text-5xl font-bold text-white mb-4">{lang === "ar" ? "خبراؤنا" : "Nos Experts"}</h1>
          <p className="text-zinc-400">{lang === "ar" ? "اختر مصفف الشعر المحترف" : "Choisissez votre coiffeur professionnel"}</p>
          <div className="mt-4 flex items-center justify-center gap-3">
            {user.user_metadata?.avatar_url && (
              <img src={user.user_metadata.avatar_url} alt="" className="w-7 h-7 rounded-full border border-gold/30" />
            )}
            <span className="text-zinc-500 text-sm">{user.user_metadata?.full_name || user.email}</span>
            <button onClick={handleLogout} className="text-zinc-600 hover:text-zinc-400 text-xs transition-colors underline">
              {lang === "ar" ? "خروج" : "Déconnexion"}
            </button>
          </div>
        </motion.div>
      </div>
      {dbError && (
        <div className="max-w-4xl mx-auto mb-8 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-center text-sm">
          ⚠️ {dbError}
        </div>
      )}
      {/* Search + Ville Filter */}
      <div className="max-w-7xl mx-auto mb-10 flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder={lang === "ar" ? "ابحث عن مصفف..." : "Rechercher un coiffeur..."}
            className="w-full pl-11 pr-4 py-3 bg-zinc-900/70 border border-zinc-700 focus:border-gold rounded-xl text-white placeholder-zinc-500 focus:outline-none transition-all" />
        </div>
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <select value={cityFilter} onChange={e => setCityFilter(e.target.value)}
            className="pl-9 pr-4 py-3 bg-zinc-900/70 border border-zinc-700 focus:border-gold rounded-xl text-white focus:outline-none transition-all min-w-[180px] appearance-none">
            <option value="">{lang === "ar" ? "كل المدن" : "Toutes les villes"}</option>
            {cities.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="flex justify-center py-20">
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="w-10 h-10 border-4 border-gold/30 border-t-gold rounded-full" />
        </div>
      ) : (
        <motion.div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-7xl mx-auto"
          variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.1 } } }}
          initial="hidden" animate="visible">
          <AnimatePresence>
            {filtered.length === 0 ? (
              <div className="col-span-full text-center py-16">
                {coiffeurs.length === 0 ? (
                  <div className="space-y-2">
                    <p className="text-zinc-400 text-lg">Aucun coiffeur trouvé dans la base de données.</p>
                    <p className="text-zinc-600 text-sm">Vérifiez la console (F12) → <code className="text-gold">CONTENU BRUT DE LA TABLE PROFILES</code></p>
                  </div>
                ) : (
                  <p className="text-zinc-500">{lang === "ar" ? "لا يوجد نتائج" : "Aucun résultat"}</p>
                )}
              </div>
            ) : filtered.map(c => {
              const isFav = favorites.has(c.id);
              const isVerified = c.subscription_status === "active" && c.is_approved;
              const displayName = lang === "ar" ? (c.name_ar || c.name || "") : (c.name || "");
              const displaySpecialty = lang === "ar" ? (c.specialty_ar || c.specialty || "") : (c.specialty || "");
              const hasVideo = c.video_url && isValidVideoUrl(c.video_url) && !videoErrors[c.id];

              return (
                <motion.div key={c.id} layout
                  initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
                  whileHover={{ scale: 1.02 }}
                  className="group relative overflow-hidden rounded-3xl bg-zinc-900/70 backdrop-blur-xl border border-gold/20 hover:border-gold/50 transition-all duration-500 shadow-2xl hover:shadow-gold/20">
                  <button onClick={() => toggleFavorite(c.id)}
                    className="absolute top-4 right-4 z-30 p-2 rounded-full bg-black/40 backdrop-blur-sm transition-all hover:scale-110">
                    <svg className={`w-5 h-5 transition-colors ${isFav ? "text-red-400 fill-red-400" : "text-zinc-400"}`}
                      fill={isFav ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>
                  </button>
                  {isVerified && (
                    <div className="absolute top-4 left-4 z-30 flex items-center gap-1.5 bg-black/60 backdrop-blur-sm border border-gold/40 px-3 py-1 rounded-full">
                      <svg className="w-3.5 h-3.5 text-gold" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span className="text-gold text-xs font-semibold">Expert Vérifié</span>
                    </div>
                  )}
                  <div className="relative h-80 overflow-hidden bg-zinc-900">
                    {!hasVideo && (
                      <div className="absolute inset-0">
                        {c.avatar_url ? (
                          <img src={c.avatar_url} alt={displayName}
                            className="w-full h-full object-cover opacity-70 group-hover:opacity-90 group-hover:scale-105 transition-all duration-700" />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-zinc-900 via-gold/10 to-zinc-900 flex items-center justify-center">
                            <svg className="w-24 h-24 text-gold/30" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                            </svg>
                          </div>
                        )}
                      </div>
                    )}
                    {hasVideo && (
                      <>
                        {c.avatar_url && <img src={c.avatar_url} alt="" className="absolute inset-0 w-full h-full object-cover opacity-30" />}
                        <video key={`v-${c.id}`} src={sanitizeVideoUrl(c.video_url!)}
                          autoPlay loop muted playsInline preload="auto"
                          onError={() => setVideoErrors(p => ({ ...p, [c.id]: true }))}
                          className="absolute inset-0 w-full h-full object-cover opacity-70 group-hover:opacity-90 transition-opacity duration-500" />
                      </>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
                    {c.city && (
                      <div className="absolute bottom-14 left-4 flex items-center gap-1.5 bg-black/50 backdrop-blur-sm px-2.5 py-1 rounded-full">
                        <svg className="w-3 h-3 text-gold shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span className="text-zinc-200 text-xs font-medium">{c.city}</span>
                      </div>
                    )}
                    <div className={`absolute bottom-0 left-0 right-0 p-5 ${isRTL ? "text-right" : "text-left"}`}>
                      <h3 className="text-xl font-bold text-white mb-1">{displayName}</h3>
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Badge cible clientèle */}
                        {c.specialty && (
                          <span className="inline-flex items-center gap-1.5 bg-black/50 backdrop-blur-sm border border-gold/30 px-2.5 py-1 rounded-full">
                            {c.specialty === "Homme" && (
                              <svg className="w-3.5 h-3.5 text-gold shrink-0" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>
                              </svg>
                            )}
                            {c.specialty === "Femme" && (
                              <svg className="w-3.5 h-3.5 text-gold shrink-0" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 2a5 5 0 100 10A5 5 0 0012 2zm0 12c-5.33 0-8 2.67-8 4v1h16v-1c0-1.33-2.67-4-8-4z"/>
                              </svg>
                            )}
                            {c.specialty === "Homme & Femme" && (
                              <svg className="w-3.5 h-3.5 text-gold shrink-0" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M9 12c2.2 0 4-1.8 4-4s-1.8-4-4-4-4 1.8-4 4 1.8 4 4 4zm0 2c-2.7 0-8 1.3-8 4v1h16v-1c0-2.7-5.3-4-8-4z" opacity="0.75"/>
                                <path d="M16 11c1.7 0 3-1.3 3-3s-1.3-3-3-3-3 1.3-3 3 1.3 3 3 3zm0 2c-.8 0-1.5.1-2.2.3C15 14 16 15.1 16 16.5V18h6v-1c0-2-2.7-4-6-4z"/>
                              </svg>
                            )}
                            <span className="text-gold text-xs font-medium">
                              {lang === "ar" ? (c.specialty_ar || c.specialty) : c.specialty}
                            </span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="p-5 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full border-2 border-gold/50 overflow-hidden shrink-0 shadow-lg shadow-gold/20">
                      {c.avatar_url ? (
                        <img src={c.avatar_url} alt={displayName} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-gold/20 flex items-center justify-center text-gold font-bold">
                          {(displayName[0] || "?").toUpperCase()}
                        </div>
                      )}
                    </div>
                    <motion.a href={`/reservation?coiffeur=${c.id}`}
                      whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
                      className="flex-1 bg-gold hover:bg-gold/90 text-black font-bold py-3 px-4 rounded-xl text-center text-sm transition-all shadow-lg hover:shadow-gold/40">
                      {lang === "ar" ? "احجز الآن" : "Réserver cet expert"}
                    </motion.a>
                  </div>
                  <div className="absolute inset-0 rounded-3xl border border-gold/30 pointer-events-none group-hover:border-gold/60 transition-all duration-500" />
                </motion.div>
              );
            })}
          </AnimatePresence>
        </motion.div>
      )}
      <div className="text-center mt-16">
        <a href="/" className="inline-flex items-center gap-2 text-zinc-400 hover:text-gold transition-colors">
          <svg className={`w-5 h-5 ${isRTL ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          {lang === "ar" ? "العودة إلى الصفحة الرئيسية" : "Retour à l'accueil"}
        </a>
      </div>
    </div>
  );
}
