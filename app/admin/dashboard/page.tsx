"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "../../../lib/supabase";

interface CoiffeurProfile {
  id: string;
  name: string | null;
  email: string | null;
  specialty: string | null;
  avatar_url: string | null;
  subscription_status: string | null;
  subscription_end: string | null;
  payment_method: string | null;
  is_approved: boolean | null;
  created_at: string | null;
  role: string | null;
  // enrichi côté client
  totalBookings?: number;
  acceptedBookings?: number;
}

interface Payment {
  id: string;
  coiffeur_id: string;
  amount: number;
  period_days: number;
  paid_at: string;
}

interface ManageModal {
  coiffeur: CoiffeurProfile;
  tab: "renew" | "details" | "payments";
}

// ── Helpers ──────────────────────────────────────────────
const daysRemaining = (end: string | null): number | null => {
  if (!end) return null;
  return Math.ceil((new Date(end).getTime() - Date.now()) / 86400000);
};

const daysColor = (days: number | null): string => {
  if (days === null) return "text-zinc-500";
  if (days < 0)  return "text-red-500 font-bold";
  if (days < 5)  return "text-red-400 font-bold";
  if (days < 15) return "text-orange-400 font-semibold";
  return "text-green-400";
};

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const statusBadge = (status: string | null) => {
  const s = status || "trial";
  const map: Record<string, string> = {
    active:    "bg-green-500/20 text-green-400 border-green-500/30",
    trial:     "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    suspended: "bg-red-500/20 text-red-400 border-red-500/30",
    expired:   "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
  };
  return map[s] || map.trial;
};

export default function AdminDashboard() {
  const [coiffeurs, setCoiffeurs]       = useState<CoiffeurProfile[]>([]);
  const [totalBookings, setTotalBookings] = useState(0);
  const [authChecked, setAuthChecked]   = useState(false);
  const [isLoading, setIsLoading]       = useState(true);
  const [message, setMessage]           = useState("");
  const [newSignups, setNewSignups]     = useState<CoiffeurProfile[]>([]);
  const [notifOpen, setNotifOpen]       = useState(false);
  const [seenIds, setSeenIds]           = useState<Set<string>>(new Set());
  const [manageModal, setManageModal]   = useState<ManageModal | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  // Renew form
  const [renewDays, setRenewDays]       = useState(30);
  const [renewAmount, setRenewAmount]   = useState("");
  // Payments history
  const [payments, setPayments]         = useState<Payment[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [editingPayment, setEditingPayment] = useState<string | null>(null);
  const [editAmount, setEditAmount]     = useState("");
  const [editDays, setEditDays]         = useState("");
  const notifRef = useRef<HTMLDivElement>(null);

  const showMsg = (msg: string) => { setMessage(msg); setTimeout(() => setMessage(""), 4000); };

  // ── Fetch bookings stats per coiffeur ──────────────────
  const enrichWithStats = useCallback(async (list: CoiffeurProfile[]): Promise<CoiffeurProfile[]> => {
    if (!supabase || list.length === 0) return list;
    const ids = list.map(c => c.id);
    const { data } = await supabase
      .from("bookings")
      .select("coiffeur_id, status")
      .in("coiffeur_id", ids);

    const statsMap: Record<string, { total: number; accepted: number }> = {};
    (data || []).forEach((b: any) => {
      if (!statsMap[b.coiffeur_id]) statsMap[b.coiffeur_id] = { total: 0, accepted: 0 };
      statsMap[b.coiffeur_id].total++;
      if (b.status === "accepted") statsMap[b.coiffeur_id].accepted++;
    });

    return list.map(c => ({
      ...c,
      totalBookings:    statsMap[c.id]?.total    ?? 0,
      acceptedBookings: statsMap[c.id]?.accepted ?? 0,
    }));
  }, []);

  // ── Main fetch ─────────────────────────────────────────
  const fetchData = useCallback(async () => {
    if (!supabase) return;

    const [profilesRes, bookingsRes] = await Promise.all([
      // Récupère tout sauf l'admin — couvre role='coiffeur', role=null, role=''
      supabase
        .from("profiles")
        .select("*")
        .neq("role", "admin")
        .order("created_at", { ascending: false }),
      supabase.from("bookings").select("id", { count: "exact", head: true }),
    ]);

    if (profilesRes.error) {
      console.error("❌ fetchData profiles error:", profilesRes.error.message, "| code:", profilesRes.error.code);
    }

    if (profilesRes.data) {
      console.log(`✅ Profils chargés: ${profilesRes.data.length}`, profilesRes.data.map(p => ({ id: p.id, name: p.name, role: p.role })));
      const enriched = await enrichWithStats(profilesRes.data);
      setCoiffeurs(enriched);
      setNewSignups(enriched.filter(c => !c.is_approved));
    }

    if (bookingsRes.count !== null) setTotalBookings(bookingsRes.count);
    setIsLoading(false);
  }, [enrichWithStats]);

  // ── Auth guard ─────────────────────────────────────────
  useEffect(() => {
    if (!supabase) { window.location.replace("/auth/login"); return; }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event: string, session: any) => {
      if (!session) {
        if (event === "SIGNED_OUT" || event === "INITIAL_SESSION") window.location.replace("/auth/login");
        return;
      }
      // Ne vérifier le rôle que sur les events de connexion, pas les refreshs de token
      if (event !== "SIGNED_IN" && event !== "INITIAL_SESSION" && event !== "TOKEN_REFRESHED") return;
      if (authChecked) return; // déjà vérifié

      const { data: profile } = await supabase!.from("profiles").select("role, name").eq("id", session.user.id).single();
      if (!profile || profile.role !== "admin") {
        window.location.replace(`/admin/${profile?.name?.toLowerCase() || session.user.id}/profile`);
        return;
      }
      setAuthChecked(true);
      fetchData();
    });

    return () => subscription.unsubscribe();
  }, [fetchData]);

  // ── Realtime ───────────────────────────────────────────
  useEffect(() => {
    if (!authChecked || !supabase) return;

    const ch = supabase
      .channel("admin-profiles-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "profiles" },
        (payload) => {
          console.log("🔔 Nouveau profil détecté:", payload.new);
          fetchData();
        }
      )
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles" },
        () => fetchData()
      )
      .subscribe((status) => {
        console.log("📡 Realtime profiles status:", status);
      });

    return () => { supabase?.removeChannel(ch); };
  }, [authChecked, fetchData]);

  // ── Close notif on outside click ───────────────────────
  useEffect(() => {
    const h = (e: MouseEvent) => { if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  // ── Actions ────────────────────────────────────────────
  const handleApprove = async (c: CoiffeurProfile) => {
    if (!supabase) return;
    setActionLoading(c.id);
    const isAnnual = (c.payment_method || "").toLowerCase().includes("annuel");
    const days = isAnnual ? 365 : 30;
    const end = new Date(); end.setDate(end.getDate() + days);
    const { error } = await supabase.from("profiles")
      .update({ is_approved: true, subscription_status: "active", subscription_end: end.toISOString() })
      .eq("id", c.id);
    if (error) showMsg("❌ Erreur approbation");
    else { showMsg(`✅ ${c.name} approuvé (+${days}j)`); fetchData(); }
    setActionLoading(null);
  };

  const handleRevoke = async (c: CoiffeurProfile) => {
    if (!supabase || !confirm(`Révoquer l'accès de ${c.name} ?`)) return;
    setActionLoading(c.id);
    const { error } = await supabase.from("profiles")
      .update({ is_approved: false, subscription_status: "suspended" })
      .eq("id", c.id);
    if (error) showMsg("❌ Erreur révocation");
    else { showMsg(`⛔ ${c.name} suspendu`); fetchData(); setManageModal(null); }
    setActionLoading(null);
  };

  const handleRenew = async () => {
    if (!supabase || !manageModal) return;
    const c = manageModal.coiffeur;
    setActionLoading(c.id);

    try {
      // Calculer la nouvelle date d'expiration
      const base = c.subscription_end && new Date(c.subscription_end) > new Date()
        ? new Date(c.subscription_end)
        : new Date();
      base.setDate(base.getDate() + renewDays);

      // Mettre à jour le profil
      const { error: profileErr } = await supabase
        .from("profiles")
        .update({ is_approved: true, subscription_status: "active", subscription_end: base.toISOString() })
        .eq("id", c.id);

      if (profileErr) {
        console.error("❌ Erreur renouvellement profil:", profileErr.message);
        showMsg("❌ Erreur renouvellement : " + profileErr.message);
        return;
      }

      // Enregistrer le paiement si montant saisi
      if (renewAmount && parseFloat(renewAmount) > 0) {
        try {
          const { error: payErr } = await supabase.from("payments").insert({
            coiffeur_id: c.id,
            amount: parseFloat(renewAmount),
            period_days: renewDays,
            paid_at: new Date().toISOString(),
          });
          if (payErr) {
            console.error("❌ Erreur paiement:", payErr.message, "| code:", payErr.code, "| hint:", payErr.hint);
            // Non bloquant : le renouvellement est fait, on avertit juste
            showMsg(`✅ ${c.name} renouvelé (+${renewDays}j) — ⚠️ Paiement non enregistré: ${payErr.message}`);
          } else {
            showMsg(`✅ ${c.name} renouvelé (+${renewDays}j) — Paiement enregistré`);
          }
        } catch (payEx: any) {
          console.error("❌ Exception paiement:", payEx?.message);
          showMsg(`✅ ${c.name} renouvelé — ⚠️ Paiement non enregistré: ${payEx?.message}`);
        }
      } else {
        showMsg(`✅ ${c.name} renouvelé (+${renewDays}j)`);
      }

      fetchData();
      setManageModal(null);
      setRenewDays(30);
      setRenewAmount("");
    } finally {
      // Toujours débloquer le bouton, même en cas d'erreur
      setActionLoading(null);
    }
  };

  // ── Payments CRUD ─────────────────────────────────────
  const fetchPayments = useCallback(async (coiffeurId: string) => {
    if (!supabase) { setPaymentsLoading(false); return; }
    setPaymentsLoading(true);
    try {
      const { data, error } = await supabase
        .from("payments")
        .select("*")
        .eq("coiffeur_id", coiffeurId)
        .order("paid_at", { ascending: false });

      if (error) {
        console.error("❌ fetchPayments:", error.message, "| code:", error.code);
        // Si la table n'existe pas encore, ne pas bloquer
        setPayments([]);
      } else {
        setPayments((data || []) as Payment[]);
      }
    } catch (e: any) {
      console.error("❌ fetchPayments exception:", e?.message);
      setPayments([]);
    } finally {
      setPaymentsLoading(false);
    }
  }, []);

  const handleEditPayment = async (p: Payment) => {
    if (!supabase) return;
    const newAmount = parseFloat(editAmount);
    const newDays   = parseInt(editDays);
    if (isNaN(newAmount) || isNaN(newDays)) return;

    const { error } = await supabase
      .from("payments")
      .update({ amount: newAmount, period_days: newDays })
      .eq("id", p.id);

    if (error) { showMsg("❌ Erreur modification : " + error.message); return; }
    showMsg("✅ Paiement modifié");
    setEditingPayment(null);
    fetchPayments(p.coiffeur_id);
  };

  const handleDeletePayment = async (p: Payment) => {
    if (!supabase || !confirm(`Supprimer ce paiement de ${p.amount} DT ?`)) return;

    const { error } = await supabase.from("payments").delete().eq("id", p.id);
    if (error) { showMsg("❌ Erreur suppression : " + error.message); return; }

    showMsg("🗑️ Paiement supprimé");
    fetchPayments(p.coiffeur_id);
  };

  const unreadCount = newSignups.filter(c => !seenIds.has(c.id)).length;

  // ── Spinner ────────────────────────────────────────────
  if (!authChecked || isLoading) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-12 h-12 border-4 border-gold/30 border-t-gold rounded-full" />
      </div>
    );
  }

  const activeCount = coiffeurs.filter(c => c.subscription_status === "active" && c.is_approved).length;

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-7xl mx-auto">

        {/* ── Header ── */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-10 flex items-start justify-between">
          <div>
            <p className="text-gold text-xs tracking-[0.4em] uppercase mb-1">RAED COIF</p>
            <h1 className="text-4xl font-bold text-gold">Admin Dashboard</h1>
          </div>
          <div className="flex items-center gap-3">
            {/* Cloche */}
            <div className="relative" ref={notifRef}>
              <button onClick={() => { setNotifOpen(v => !v); setSeenIds(new Set(newSignups.map(c => c.id))); }}
                className="relative p-3 bg-zinc-900/70 border border-gold/20 rounded-2xl hover:border-gold/50 transition-all">
                <svg className="w-5 h-5 text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">{unreadCount}</span>
                )}
              </button>
              <AnimatePresence>
                {notifOpen && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
                    className="absolute right-0 top-14 w-72 bg-zinc-900 border border-gold/20 rounded-2xl shadow-2xl z-50 overflow-hidden">
                    <div className="px-4 py-3 border-b border-zinc-800 text-gold text-sm font-semibold">
                      Inscriptions en attente ({newSignups.length})
                    </div>
                    <div className="max-h-72 overflow-y-auto">
                      {newSignups.length === 0
                        ? <p className="px-4 py-6 text-zinc-500 text-sm text-center">Aucune</p>
                        : newSignups.map(c => (
                          <div key={c.id} className="px-4 py-3 flex items-center gap-3 hover:bg-zinc-800/40 transition-colors">
                            {c.avatar_url
                              ? <img src={c.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover border border-gold/30 shrink-0" />
                              : <div className="w-8 h-8 rounded-full bg-gold/20 flex items-center justify-center text-gold text-xs font-bold shrink-0">{(c.name || "?")[0].toUpperCase()}</div>}
                            <div className="flex-1 min-w-0">
                              <p className="text-white text-sm font-medium truncate">{c.name}</p>
                              <p className="text-zinc-400 text-xs truncate">{c.email}</p>
                            </div>
                            <button onClick={() => { handleApprove(c); setNotifOpen(false); }}
                              className="px-2.5 py-1 bg-gold hover:bg-gold/80 text-black text-xs font-bold rounded-lg transition-all">
                              Approuver
                            </button>
                          </div>
                        ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            {/* Logout */}
            <button onClick={async () => { if (supabase) await supabase.auth.signOut(); window.location.replace("/auth/login"); }}
              className="flex items-center gap-2 px-4 py-3 bg-zinc-900/70 border border-zinc-700 hover:border-red-500/50 hover:bg-red-500/10 text-zinc-400 hover:text-red-400 rounded-2xl transition-all text-sm">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Déconnexion
            </button>
          </div>
        </motion.div>

        {message && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-3 bg-gold/10 border border-gold/30 rounded-xl text-gold text-center text-sm">
            {message}
          </motion.div>
        )}

        {/* ── Stats ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          {[
            { label: "Coiffeurs", value: coiffeurs.length, icon: "👤" },
            { label: "Abonnements actifs", value: activeCount, icon: "✅" },
            { label: "Total réservations", value: totalBookings, icon: "📅" },
            { label: "En attente", value: newSignups.length, icon: "⏳" },
          ].map((s, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
              className="bg-zinc-900/70 border border-gold/20 rounded-2xl p-5">
              <div className="text-2xl mb-1">{s.icon}</div>
              <div className="text-3xl font-bold text-gold">{s.value}</div>
              <div className="text-zinc-400 text-xs mt-1">{s.label}</div>
            </motion.div>
          ))}
        </div>

        {/* ── Pending alert ── */}
        {newSignups.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="mb-8 bg-yellow-500/5 border border-yellow-500/20 rounded-2xl p-5">
            <p className="text-yellow-400 font-semibold mb-3 flex items-center gap-2">
              <span>🔔</span> {newSignups.length} coiffeur{newSignups.length > 1 ? "s" : ""} en attente d'approbation
            </p>
            <div className="flex flex-wrap gap-3">
              {newSignups.map(c => (
                <div key={c.id} className="flex items-center gap-2 bg-zinc-900/60 border border-zinc-800 rounded-xl px-3 py-2">
                  <span className="text-white text-sm font-medium">{c.name}</span>
                  <button onClick={() => handleApprove(c)} disabled={actionLoading === c.id}
                    className="px-2.5 py-1 bg-gold hover:bg-gold/80 text-black text-xs font-bold rounded-lg disabled:opacity-50 transition-all">
                    {actionLoading === c.id ? "..." : "Approuver"}
                  </button>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* ── Table ── */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="bg-zinc-900/70 border border-gold/20 rounded-3xl overflow-hidden">
          <div className="px-8 py-5 border-b border-gold/20 flex items-center justify-between">
            <h2 className="text-xl font-bold text-gold">Gestion des Abonnements</h2>
            <span className="text-zinc-500 text-sm">{coiffeurs.length} coiffeur{coiffeurs.length > 1 ? "s" : ""}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-800 text-left">
                  {["Coiffeur", "Statut", "Jours restants", "Activité", "Fin abonnement", "Actions"].map(h => (
                    <th key={h} className="px-5 py-3 text-xs font-medium text-zinc-400 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {coiffeurs.map(c => {
                  const days = daysRemaining(c.subscription_end);
                  return (
                    <tr key={c.id} className="hover:bg-zinc-800/20 transition-colors">
                      {/* Coiffeur */}
                      <td className="px-5 py-4">
                        <button onClick={() => setManageModal({ coiffeur: c, tab: "details" })}
                          className="flex items-center gap-3 hover:opacity-80 transition-opacity text-left">
                          {c.avatar_url
                            ? <img src={c.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover border border-gold/30 shrink-0" />
                            : <div className="w-9 h-9 rounded-full bg-gold/20 flex items-center justify-center text-gold text-sm font-bold shrink-0">{(c.name || "?")[0].toUpperCase()}</div>}
                          <div>
                            <p className="text-white font-medium text-sm hover:text-gold transition-colors">{c.name || "—"}</p>
                            <p className="text-zinc-500 text-xs">{c.specialty || "—"}</p>
                          </div>
                        </button>
                      </td>
                      {/* Statut */}
                      <td className="px-5 py-4">
                        <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${statusBadge(c.subscription_status)}`}>
                          {c.subscription_status || "trial"}
                        </span>
                      </td>
                      {/* Jours restants */}
                      <td className="px-5 py-4">
                        <span className={`text-sm ${daysColor(days)}`}>
                          {days === null ? "—" : days < 0 ? "Expiré" : `${days}j`}
                        </span>
                      </td>
                      {/* Activité */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <span className="text-zinc-300 text-sm font-medium">{c.totalBookings ?? 0}</span>
                          <span className="text-zinc-600 text-xs">total</span>
                          <span className="text-green-400 text-sm font-medium ml-1">{c.acceptedBookings ?? 0}</span>
                          <span className="text-zinc-600 text-xs">acceptés</span>
                        </div>
                      </td>
                      {/* Fin abonnement */}
                      <td className="px-5 py-4 text-zinc-400 text-sm">{fmtDate(c.subscription_end)}</td>
                      {/* Actions */}
                      <td className="px-5 py-4">
                        <div className="flex gap-2">
                          <button onClick={() => setManageModal({ coiffeur: c, tab: "renew" })}
                            className="px-3 py-1.5 bg-gold/20 hover:bg-gold/30 text-gold border border-gold/30 text-xs font-bold rounded-lg transition-all">
                            Gérer
                          </button>
                          {c.is_approved
                            ? <button onClick={() => handleRevoke(c)} disabled={actionLoading === c.id}
                                className="px-3 py-1.5 bg-red-600/20 hover:bg-red-600/40 text-red-400 border border-red-600/30 text-xs font-bold rounded-lg transition-all disabled:opacity-50">
                                {actionLoading === c.id ? "..." : "Révoquer"}
                              </button>
                            : <button onClick={() => handleApprove(c)} disabled={actionLoading === c.id}
                                className="px-3 py-1.5 bg-green-600/20 hover:bg-green-600/40 text-green-400 border border-green-600/30 text-xs font-bold rounded-lg transition-all disabled:opacity-50">
                                {actionLoading === c.id ? "..." : "Approuver"}
                              </button>
                          }
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {coiffeurs.length === 0 && (
                  <tr><td colSpan={6} className="px-6 py-12 text-center text-zinc-500 text-sm">Aucun coiffeur</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>

      {/* ══════════════════════════════════════════
          MODAL GESTION
      ══════════════════════════════════════════ */}
      <AnimatePresence>
        {manageModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setManageModal(null)}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="bg-zinc-900 border border-gold/30 rounded-3xl p-8 w-full max-w-lg shadow-2xl">

              {/* Header modal */}
              <div className="flex items-center gap-4 mb-6">
                {manageModal.coiffeur.avatar_url
                  ? <img src={manageModal.coiffeur.avatar_url} alt="" className="w-14 h-14 rounded-2xl object-cover border-2 border-gold/40" />
                  : <div className="w-14 h-14 rounded-2xl bg-gold/20 flex items-center justify-center text-gold text-2xl font-bold">{(manageModal.coiffeur.name || "?")[0].toUpperCase()}</div>}
                <div>
                  <h2 className="text-xl font-bold text-white">{manageModal.coiffeur.name}</h2>
                  <p className="text-zinc-400 text-sm">{manageModal.coiffeur.email}</p>
                </div>
                <button onClick={() => setManageModal(null)} className="ml-auto text-zinc-500 hover:text-white transition-colors">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Tabs */}
              <div className="flex gap-2 mb-6">
                {(["renew", "payments", "details"] as const).map(tab => (
                  <button key={tab} onClick={() => {
                    setManageModal(m => m ? { ...m, tab } : null);
                    if (tab === "payments") fetchPayments(manageModal.coiffeur.id);
                  }}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                      manageModal.tab === tab
                        ? "bg-gold text-black"
                        : "bg-zinc-800 text-zinc-400 hover:text-white"
                    }`}>
                    {tab === "renew" ? "Renouveler" : tab === "payments" ? "💳 Paiements" : "Fiche"}
                  </button>
                ))}
              </div>

              {/* ── Tab Renouveler ── */}
              {manageModal.tab === "renew" && (
                <div className="space-y-5">
                  <div>
                    <label className="block text-zinc-400 text-xs mb-2 uppercase tracking-wider">Période à ajouter</label>
                    <div className="flex gap-2">
                      {[30, 90, 180, 365].map(d => (
                        <button key={d} onClick={() => setRenewDays(d)}
                          className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${renewDays === d ? "bg-gold text-black" : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"}`}>
                          {d === 365 ? "1 an" : `${d}j`}
                        </button>
                      ))}
                    </div>
                    <input type="number" value={renewDays} onChange={e => setRenewDays(Number(e.target.value))} min={1}
                      className="mt-2 w-full px-4 py-2.5 bg-zinc-800/50 border border-zinc-700 rounded-xl text-white text-sm focus:border-gold focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-zinc-400 text-xs mb-2 uppercase tracking-wider">Montant reçu (DT)</label>
                    <input type="number" value={renewAmount} onChange={e => setRenewAmount(e.target.value)} placeholder="ex: 50"
                      className="w-full px-4 py-2.5 bg-zinc-800/50 border border-zinc-700 rounded-xl text-white text-sm focus:border-gold focus:outline-none" />
                  </div>
                  {/* Nouvelle date estimée */}
                  <div className="bg-zinc-800/40 rounded-xl px-4 py-3 text-sm">
                    <span className="text-zinc-400">Nouvelle expiration estimée : </span>
                    <span className="text-gold font-semibold">
                      {(() => {
                        const base = manageModal.coiffeur.subscription_end && new Date(manageModal.coiffeur.subscription_end) > new Date()
                          ? new Date(manageModal.coiffeur.subscription_end)
                          : new Date();
                        base.setDate(base.getDate() + renewDays);
                        return fmtDate(base.toISOString());
                      })()}
                    </span>
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button onClick={handleRenew} disabled={actionLoading === manageModal.coiffeur.id}
                      className="flex-1 py-3 bg-gold hover:bg-gold/90 text-black font-bold rounded-xl transition-all disabled:opacity-50">
                      {actionLoading === manageModal.coiffeur.id ? "..." : "✅ Renouveler"}
                    </button>
                    <button onClick={() => handleRevoke(manageModal.coiffeur)} disabled={actionLoading === manageModal.coiffeur.id}
                      className="flex-1 py-3 bg-red-600/20 hover:bg-red-600/40 border border-red-600/30 text-red-400 font-bold rounded-xl transition-all disabled:opacity-50">
                      ⛔ Révoquer
                    </button>
                  </div>
                </div>
              )}

              {/* ── Tab Paiements ── */}
              {manageModal.tab === "payments" && (
                <div>
                  {paymentsLoading ? (
                    <div className="flex justify-center py-8">
                      <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        className="w-8 h-8 border-4 border-gold/30 border-t-gold rounded-full" />
                    </div>
                  ) : payments.length === 0 ? (
                    <p className="text-zinc-500 text-sm text-center py-8">Aucun paiement enregistré</p>
                  ) : (
                    <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                      {payments.map((p, idx) => (
                        <div key={p.id}
                          className={`border rounded-xl p-4 transition-all ${
                            idx === 0
                              ? "bg-green-900/20 border-green-600/40 ring-1 ring-green-500/20"
                              : "bg-zinc-800/50 border-zinc-700/50"
                          }`}>
                          {editingPayment === p.id ? (
                            // ── Mode édition ──
                            <div className="space-y-3">
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="text-zinc-500 text-xs mb-1 block">Montant (DT)</label>
                                  <input type="number" value={editAmount} onChange={e => setEditAmount(e.target.value)}
                                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-600 rounded-lg text-white text-sm focus:border-gold focus:outline-none" />
                                </div>
                                <div>
                                  <label className="text-zinc-500 text-xs mb-1 block">Jours accordés</label>
                                  <input type="number" value={editDays} onChange={e => setEditDays(e.target.value)}
                                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-600 rounded-lg text-white text-sm focus:border-gold focus:outline-none" />
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <button onClick={() => handleEditPayment(p)}
                                  className="flex-1 py-2 bg-gold hover:bg-gold/90 text-black text-xs font-bold rounded-lg transition-all">
                                  Enregistrer
                                </button>
                                <button onClick={() => setEditingPayment(null)}
                                  className="flex-1 py-2 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 text-xs font-bold rounded-lg transition-all">
                                  Annuler
                                </button>
                              </div>
                            </div>
                          ) : (
                            // ── Mode lecture ──
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="flex items-center gap-3">
                                  <span className="text-gold font-bold">{p.amount} DT</span>
                                  <span className="text-zinc-500 text-xs">·</span>
                                  <span className="text-zinc-300 text-sm">{p.period_days} jours</span>
                                  {idx === 0 && (
                                    <span className="text-xs bg-green-500/20 text-green-400 border border-green-500/30 px-2 py-0.5 rounded-full font-medium">
                                      Dernier
                                    </span>
                                  )}
                                </div>
                                <p className="text-zinc-500 text-xs mt-0.5">
                                  {new Date(p.paid_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                                </p>
                              </div>
                              <div className="flex gap-2">
                                <button onClick={() => {
                                  setEditingPayment(p.id);
                                  setEditAmount(String(p.amount));
                                  setEditDays(String(p.period_days));
                                }}
                                  className="p-2 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded-lg transition-all"
                                  title="Modifier">
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                  </svg>
                                </button>
                                <button onClick={() => handleDeletePayment(p)}
                                  className="p-2 bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded-lg transition-all"
                                  title="Supprimer">
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {/* Total */}
                  {payments.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-zinc-800 flex justify-between items-center">
                      <span className="text-zinc-400 text-sm">Total encaissé</span>
                      <span className="text-gold font-bold text-lg">
                        {payments.reduce((sum, p) => sum + p.amount, 0).toFixed(2)} DT
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* ── Tab Fiche complète ── */}
              {manageModal.tab === "details" && (
                <div className="space-y-3">
                  {[
                    { label: "Email",         value: manageModal.coiffeur.email },
                    { label: "Spécialité",    value: manageModal.coiffeur.specialty },
                    { label: "Statut",        value: manageModal.coiffeur.subscription_status },
                    { label: "Fin abonnement",value: fmtDate(manageModal.coiffeur.subscription_end) },
                    { label: "Jours restants",value: (() => { const d = daysRemaining(manageModal.coiffeur.subscription_end); return d === null ? "—" : d < 0 ? "Expiré" : `${d} jours`; })() },
                    { label: "Paiement",      value: manageModal.coiffeur.payment_method || "—" },
                    { label: "Inscrit le",    value: fmtDate(manageModal.coiffeur.created_at) },
                    { label: "Total RDV",     value: String(manageModal.coiffeur.totalBookings ?? 0) },
                    { label: "RDV acceptés",  value: String(manageModal.coiffeur.acceptedBookings ?? 0) },
                  ].map(row => (
                    <div key={row.label} className="flex justify-between items-center py-2.5 border-b border-zinc-800/60">
                      <span className="text-zinc-500 text-sm">{row.label}</span>
                      <span className="text-white text-sm font-medium">{row.value}</span>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
