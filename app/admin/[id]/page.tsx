"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";

type Language = "fr" | "ar";
type BookingStatus = "pending" | "accepted" | "rejected";

interface Booking {
  id: string;
  client_name: string;
  client_phone: string;
  booking_date: string;
  booking_time: string;
  comment?: string | null;
  status: BookingStatus;
  created_at?: string;
}

interface CoiffeurProfile {
  id: string;
  name: string | null;
  name_ar: string | null;
  specialty: string | null;
  specialty_ar: string | null;
  avatar_url: string | null;
  role: string | null;
  is_approved: boolean | null;
}

export default function CoiffeurDashboard() {
  const [lang, setLang] = useState<Language>("fr");
  const [profile, setProfile] = useState<CoiffeurProfile | null>(null);
  const [isApproved, setIsApproved] = useState<boolean | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [pageReady, setPageReady] = useState(false);
  const [justApproved, setJustApproved] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const profileRef = useRef<CoiffeurProfile | null>(null);
  const params = useParams();
  const router = useRouter();

  const isRTL = lang === "ar";
  const fontClass = lang === "ar" ? "font-cairo" : "font-serif";

  const showMsg = (text: string, type: "success" | "error" = "success") => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4000);
  };

  // Charge TOUS les statuts pour avoir l'historique complet
  const fetchBookings = useCallback(async (coiffeurId: string) => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from("bookings")
      .select("id, client_name, client_phone, booking_date, booking_time, comment, status, created_at")
      .eq("coiffeur_id", coiffeurId)
      .order("booking_date", { ascending: true })
      .order("booking_time", { ascending: true });

    if (error) {
      console.error("fetchBookings error:", error.message);
      return;
    }
    if (data) setBookings(data as Booking[]);
  }, []);

  // Auth guard via onAuthStateChange — fiable après redirect
  useEffect(() => {
    if (!supabase) { router.replace("/auth/login"); return; }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: string, session: any) => {
        if (!session) {
          if (event === "SIGNED_OUT" || event === "INITIAL_SESSION") {
            router.replace("/auth/login");
          }
          return;
        }

        const { data: prof, error: profError } = await supabase!
          .from("profiles")
          .select("id, name, name_ar, specialty, specialty_ar, avatar_url, role, is_approved")
          .eq("id", session.user.id)
          .single();

        if (profError || !prof) { router.replace("/auth/login"); return; }
        if (prof.role === "admin") { router.replace("/admin/dashboard"); return; }

        const urlId = params.id as string;
        if (prof.id !== urlId && prof.name?.toLowerCase() !== urlId) {
          router.replace(`/admin/${prof.id}`);
          return;
        }

        profileRef.current = prof;
        setProfile(prof);
        setIsApproved(prof.is_approved ?? false);
        // Charger les bookings seulement si approuvé
        if (prof.is_approved) await fetchBookings(prof.id);
        setPageReady(true);
      }
    );

    return () => subscription.unsubscribe();
  }, [params.id, router, fetchBookings]);

  // Realtime — écoute tous les changements sur les bookings de ce coiffeur
  useEffect(() => {
    if (!supabase || !profile) return;

    const channel = supabase
      .channel(`coiffeur-bookings-${profile.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bookings", filter: `coiffeur_id=eq.${profile.id}` },
        (payload) => {
          // Mise à jour optimiste : modifier directement le state sans refetch
          if (payload.eventType === "INSERT") {
            setBookings(prev => [...prev, payload.new as Booking]);
          } else if (payload.eventType === "UPDATE") {
            setBookings(prev =>
              prev.map(b => b.id === payload.new.id ? { ...b, ...payload.new } as Booking : b)
            );
          } else if (payload.eventType === "DELETE") {
            setBookings(prev => prev.filter(b => b.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => { supabase?.removeChannel(channel); };
  }, [profile]);

  // Realtime — écoute l'approbation du compte par l'admin
  useEffect(() => {
    if (!supabase || !profile) return;

    const ch = supabase
      .channel(`profile-approval-${profile.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${profile.id}` },
        async (payload) => {
          const updated = payload.new as any;
          if (updated.is_approved === true && !isApproved) {
            setIsApproved(true);
            setJustApproved(true);
            // Charger les bookings maintenant que le compte est actif
            await fetchBookings(profile.id);
            setTimeout(() => setJustApproved(false), 5000);
          } else if (updated.is_approved === false) {
            setIsApproved(false);
          }
        }
      )
      .subscribe();

    return () => { supabase?.removeChannel(ch); };
  }, [profile, isApproved, fetchBookings]);

  const handleAccept = async (booking: Booking) => {
    if (!supabase || !profile) return;
    setActionLoading(booking.id);

    // Vérifier d'abord qu'il n'y a pas de conflit (même créneau déjà accepté)
    const { data: conflict } = await supabase
      .from("bookings")
      .select("id")
      .eq("coiffeur_id", profile.id)
      .eq("booking_date", booking.booking_date)
      .eq("booking_time", booking.booking_time)
      .eq("status", "accepted")
      .neq("id", booking.id)
      .limit(1);

    if (conflict && conflict.length > 0) {
      showMsg("⚠️ Ce créneau est déjà confirmé pour un autre client", "error");
      setActionLoading(null);
      return;
    }

    const { error } = await supabase
      .from("bookings")
      .update({ status: "accepted" })
      .match({ id: booking.id, coiffeur_id: profile.id }); // double sécurité RLS

    if (error) {
      console.error("Accept error:", error.message, error.code);
      showMsg(`❌ Erreur: ${error.message}`, "error");
    } else {
      showMsg(`✅ RDV de ${booking.client_name} confirmé`);
      // Mise à jour locale immédiate (le realtime peut avoir un délai)
      setBookings(prev => prev.map(b => b.id === booking.id ? { ...b, status: "accepted" } : b));
    }
    setActionLoading(null);
  };

  const handleReject = async (booking: Booking) => {
    if (!supabase || !profile) return;
    const msg = lang === "ar"
      ? `هل تريد رفض حجز ${booking.client_name}؟`
      : `Refuser le RDV de ${booking.client_name} ?`;
    if (!confirm(msg)) return;

    setActionLoading(booking.id);
    const { error } = await supabase
      .from("bookings")
      .update({ status: "rejected" })
      .match({ id: booking.id, coiffeur_id: profile.id });

    if (error) {
      console.error("Reject error:", error.message, error.code);
      showMsg(`❌ Erreur: ${error.message}`, "error");
    } else {
      showMsg(`⛔ RDV de ${booking.client_name} refusé`);
      setBookings(prev => prev.map(b => b.id === booking.id ? { ...b, status: "rejected" } : b));
    }
    setActionLoading(null);
  };

  const handleLogout = async () => {
    if (supabase) await supabase.auth.signOut();
    router.replace("/auth/login");
  };

  if (!pageReady) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-12 h-12 border-4 border-gold/30 border-t-gold rounded-full" />
      </div>
    );
  }

  // ── Compte en attente d'approbation ──
  if (!isApproved) {
    return (
      <div className={`fixed inset-0 bg-black flex items-center justify-center p-8 ${fontClass}`}
        dir={isRTL ? "rtl" : "ltr"}>
        <div className="absolute inset-0 bg-gradient-to-br from-black via-zinc-900 to-black" />
        <div className="absolute top-20 left-20 w-96 h-96 bg-gold/5 rounded-full blur-3xl" />

        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
          className="relative z-10 max-w-md w-full text-center">
          <div className="bg-zinc-900/80 backdrop-blur-xl border border-gold/20 rounded-3xl p-10 shadow-2xl">
            {/* Icône animée */}
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
              {lang === "ar" ? "الحساب قيد المراجعة" : "Compte en attente de validation"}
            </h1>
            <p className="text-zinc-400 text-sm leading-relaxed mb-8">
              {lang === "ar"
                ? "شكرًا على تسجيلك. يراجع المسؤول طلبك حاليًا. ستُفتح لوحة التحكم تلقائيًا عند التفعيل."
                : "Merci pour votre inscription. L'administrateur examine votre dossier. Votre espace s'ouvrira automatiquement dès l'activation."}
            </p>

            {/* Indicateur de connexion realtime */}
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

  const pending  = bookings.filter(b => b.status === "pending");
  const accepted = bookings.filter(b => b.status === "accepted");
  const history  = bookings.filter(b => b.status === "rejected");

  const normalizeTime = (t: string) => t?.length === 8 ? t.substring(0, 5) : t;

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString(lang === "ar" ? "ar-TN" : "fr-FR", {
      weekday: "short", day: "numeric", month: "short",
    });

  // ── Carte de réservation réutilisable ──
  const BookingCard = ({ b, showActions }: { b: Booking; showActions: boolean }) => (
    <motion.div
      key={b.id}
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={`rounded-2xl p-5 border transition-all ${
        b.status === "pending"  ? "bg-zinc-900/70 border-yellow-500/20" :
        b.status === "accepted" ? "bg-green-900/10 border-green-700/30" :
                                  "bg-zinc-900/40 border-zinc-800/50 opacity-60"
      }`}
    >
      <div className="flex flex-col md:flex-row md:items-center gap-4">
        {/* Infos */}
        <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <p className="text-zinc-500 text-xs mb-0.5">{lang === "ar" ? "العميل" : "Client"}</p>
            <p className="text-white font-semibold text-sm">{b.client_name}</p>
          </div>
          <div>
            <p className="text-zinc-500 text-xs mb-0.5">{lang === "ar" ? "الهاتف" : "Tél."}</p>
            <p className="text-white font-mono text-sm">{b.client_phone}</p>
          </div>
          <div>
            <p className="text-zinc-500 text-xs mb-0.5">{lang === "ar" ? "التاريخ" : "Date"}</p>
            <p className="text-white text-sm">{formatDate(b.booking_date)}</p>
          </div>
          <div>
            <p className="text-zinc-500 text-xs mb-0.5">{lang === "ar" ? "الوقت" : "Heure"}</p>
            <p className="text-gold font-bold">{normalizeTime(b.booking_time)}</p>
          </div>
        </div>

        {b.comment && (
          <div className="md:w-44 bg-zinc-800/50 rounded-xl px-3 py-2 text-zinc-400 text-xs italic shrink-0">
            💬 {b.comment}
          </div>
        )}

        {/* Actions ou Badge */}
        <div className="flex gap-2 shrink-0">
          {showActions ? (
            <>
              <a href={`tel:${b.client_phone}`}
                className="p-2.5 bg-blue-600/20 hover:bg-blue-600/40 border border-blue-600/30 text-blue-400 rounded-xl transition-all">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
              </a>
              <motion.button onClick={() => handleAccept(b)} disabled={actionLoading === b.id}
                whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white font-bold rounded-xl text-sm disabled:opacity-40 flex items-center gap-1.5">
                {actionLoading === b.id ? (
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.6, repeat: Infinity, ease: "linear" }}
                    className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
                ) : (
                  <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>{lang === "ar" ? "قبول" : "Accepter"}</>
                )}
              </motion.button>
              <motion.button onClick={() => handleReject(b)} disabled={actionLoading === b.id}
                whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                className="px-4 py-2 bg-red-600/20 hover:bg-red-600/40 border border-red-600/30 text-red-400 font-bold rounded-xl text-sm disabled:opacity-40 flex items-center gap-1.5">
                {actionLoading === b.id ? "..." : (
                  <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>{lang === "ar" ? "رفض" : "Refuser"}</>
                )}
              </motion.button>
            </>
          ) : (
            <span className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl border ${
              b.status === "accepted"
                ? "bg-green-600/20 border-green-600/30 text-green-400"
                : "bg-red-600/20 border-red-600/30 text-red-400"
            }`}>
              {b.status === "accepted"
                ? <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>{lang === "ar" ? "مؤكد" : "Confirmé"}</>
                : <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>{lang === "ar" ? "مرفوض" : "Refusé"}</>
              }
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );

  return (
    <div className={`min-h-screen p-8 ${fontClass}`} dir={isRTL ? "rtl" : "ltr"}>
      {/* Top bar */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-zinc-900/90 backdrop-blur-xl border-b border-gold/20 px-8 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
            <h2 className="text-gold font-bold tracking-wider">RAED COIF</h2>
            <span className="text-zinc-600">|</span>
            <span className="text-white text-sm">{lang === "ar" ? profile?.name_ar || profile?.name : profile?.name}</span>
            {pending.length > 0 && (
              <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }}
                className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full animate-pulse">
                {pending.length}
              </motion.span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setLang(l => l === "fr" ? "ar" : "fr")}
              className="px-4 py-2 bg-gold/10 hover:bg-gold/20 text-gold border border-gold/30 rounded-xl text-sm transition-all">
              {lang === "fr" ? "العربية" : "Français"}
            </button>
            <a href={`/admin/${profile?.id}/profile`}
              className="px-4 py-2 bg-gold/20 hover:bg-gold/30 text-gold border border-gold/40 rounded-xl text-sm transition-all">
              {lang === "ar" ? "ملفي" : "Mon Profil"}
            </a>
            <button onClick={handleLogout}
              className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/40 rounded-xl text-sm transition-all">
              {lang === "ar" ? "خروج" : "Déconnexion"}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto pt-28 pb-16">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
          <h1 className="text-4xl font-bold text-gold">{lang === "ar" ? "لوحة التحكم" : "Tableau de Bord"}</h1>
          <p className="text-zinc-400 mt-1">{lang === "ar" ? profile?.specialty_ar || profile?.specialty : profile?.specialty}</p>
        </motion.div>

        <AnimatePresence>
          {justApproved && (
            <motion.div initial={{ opacity: 0, y: -20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0 }}
              className="mb-6 p-5 bg-green-500/10 border border-green-500/30 rounded-2xl text-center">
              <p className="text-green-400 font-bold text-lg mb-1">
                {lang === "ar" ? "🎉 تم تفعيل حسابك!" : "🎉 Compte activé !"}
              </p>
              <p className="text-green-400/70 text-sm">
                {lang === "ar" ? "مرحبًا بك في RAED COIF. لوحة التحكم جاهزة." : "Bienvenue sur RAED COIF. Votre espace est prêt."}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {message && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className={`mb-6 p-4 rounded-xl text-center text-sm font-medium ${
                message.type === "error"
                  ? "bg-red-500/10 border border-red-500/30 text-red-400"
                  : "bg-gold/10 border border-gold/30 text-gold"
              }`}>
              {message.text}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── À TRAITER ── */}
        <section className="mb-12">
          <div className="flex items-center gap-3 mb-5">
            <h2 className="text-2xl font-bold text-gold">{lang === "ar" ? "طلبات جديدة" : "À traiter"}</h2>
            {pending.length > 0 && (
              <span className="bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 text-sm font-bold px-3 py-0.5 rounded-full">
                {pending.length}
              </span>
            )}
          </div>
          {pending.length === 0 ? (
            <div className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-10 text-center text-zinc-500 text-sm">
              {lang === "ar" ? "لا توجد طلبات جديدة" : "Aucune demande en attente"}
            </div>
          ) : (
            <div className="space-y-3">
              <AnimatePresence>
                {pending.map(b => <BookingCard key={b.id} b={b} showActions={true} />)}
              </AnimatePresence>
            </div>
          )}
        </section>

        {/* ── RDV CONFIRMÉS ── */}
        {accepted.length > 0 && (
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-gold mb-5">{lang === "ar" ? "مواعيد مؤكدة" : "RDV confirmés"}</h2>
            <div className="space-y-3">
              <AnimatePresence>
                {accepted.map(b => <BookingCard key={b.id} b={b} showActions={false} />)}
              </AnimatePresence>
            </div>
          </section>
        )}

        {/* ── HISTORIQUE (refusés) ── */}
        {history.length > 0 && (
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-zinc-500 mb-5">{lang === "ar" ? "السجل" : "Historique"}</h2>
            <div className="space-y-3">
              {history.map(b => <BookingCard key={b.id} b={b} showActions={false} />)}
            </div>
          </section>
        )}

        {/* ── PLANNING 7 JOURS ── */}
        <section>
          <h2 className="text-2xl font-bold text-gold mb-5">{lang === "ar" ? "جدولي الأسبوعي" : "Mon planning"}</h2>
          <div className="bg-zinc-900/70 border border-gold/20 rounded-2xl p-5">
            <div className="grid grid-cols-7 gap-2">
              {Array.from({ length: 7 }).map((_, i) => {
                const d = new Date();
                d.setDate(d.getDate() + i);
                const dateStr = d.toISOString().split("T")[0];
                const dayName = d.toLocaleDateString(lang === "ar" ? "ar-TN" : "fr-FR", { weekday: "short" });
                const dayBookings = accepted.filter(b => b.booking_date === dateStr);
                return (
                  <div key={dateStr}
                    className={`rounded-xl border-2 p-2.5 ${dayBookings.length > 0 ? "border-gold/50 bg-gold/5" : "border-zinc-800 bg-zinc-800/20"}`}>
                    <div className="text-center mb-2">
                      <p className="text-zinc-500 text-xs">{dayName}</p>
                      <p className="text-white font-bold text-lg">{d.getDate()}</p>
                    </div>
                    <div className="space-y-1">
                      {dayBookings.map(b => (
                        <div key={b.id} className="bg-red-600/80 text-white text-xs font-semibold px-1 py-0.5 rounded text-center">
                          {normalizeTime(b.booking_time)}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
