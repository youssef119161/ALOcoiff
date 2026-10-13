"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "../../../lib/supabase";
import { ADMIN_EMAIL, ADMIN_PASSWORD_MIN_LENGTH, LOGIN_PATH } from "../../../lib/authRules";

type Step = "passwords" | "code" | "done";

const ERRORS: Record<string, string> = {
  not_admin: "Action réservée à l'administrateur.",
  invalid_input: "Veuillez remplir tous les champs.",
  current_password_wrong: "L'ancien mot de passe est incorrect.",
  password_too_short: `Le nouveau mot de passe doit contenir au moins ${ADMIN_PASSWORD_MIN_LENGTH} caractères.`,
  password_same: "Le nouveau mot de passe doit être différent de l'ancien.",
  password_weak: "Ce mot de passe est trop faible. Choisissez-en un plus complexe.",
  password_mismatch: "Les deux nouveaux mots de passe ne correspondent pas.",
  code_invalid: "Code invalide ou expiré. Vérifiez l'e-mail ou demandez un nouveau code.",
  rate_limited: "Trop de tentatives. Patientez une minute puis réessayez.",
  server_error: "Une erreur est survenue. Réessayez.",
  network: "Connexion impossible. Vérifiez votre réseau.",
};

const inputClass =
  "w-full px-4 py-3 bg-zinc-800/50 border border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold transition-all text-white";

export function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<Step>("passwords");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const call = async (payload: Record<string, string>) => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword, ...payload }),
      });
      const result = await res.json();
      if (!result.ok) setError(ERRORS[result.code] ?? ERRORS.server_error);
      return result.ok === true;
    } catch {
      setError(ERRORS.network);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const requestCode = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (newPassword.length < ADMIN_PASSWORD_MIN_LENGTH) return setError(ERRORS.password_too_short);
    if (newPassword !== confirmPassword) return setError(ERRORS.password_mismatch);
    if (newPassword === currentPassword) return setError(ERRORS.password_same);
    if (await call({ step: "request" })) {
      setCode("");
      setStep("code");
    }
  };

  const confirmChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (await call({ step: "confirm", code })) {
      setStep("done");
      // Toutes les sessions ont été révoquées côté serveur : reconnexion requise
      await supabase?.auth.signOut({ scope: "local" });
      setTimeout(() => window.location.replace(LOGIN_PATH), 3000);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      onClick={step === "done" ? undefined : onClose}
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="change-password-title"
        className="bg-zinc-900 border border-gold/30 rounded-3xl p-8 w-full max-w-md shadow-2xl shadow-gold/10"
      >
        <h2 id="change-password-title" className="text-xl font-bold text-white mb-1">
          Changer le mot de passe
        </h2>

        {step === "passwords" && (
          <form onSubmit={requestCode} className="space-y-4 mt-5">
            <p className="text-zinc-400 text-sm">
              Un code de confirmation sera envoyé à <span className="text-gold">{ADMIN_EMAIL}</span>.
            </p>
            <div>
              <label htmlFor="current-password" className="block text-sm font-medium text-zinc-300 mb-2">Ancien mot de passe</label>
              <input id="current-password" type="password" autoComplete="current-password" required
                value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label htmlFor="new-password" className="block text-sm font-medium text-zinc-300 mb-2">Nouveau mot de passe</label>
              <input id="new-password" type="password" autoComplete="new-password" required minLength={ADMIN_PASSWORD_MIN_LENGTH}
                value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={inputClass} />
              <p className="text-xs text-zinc-500 mt-1">{ADMIN_PASSWORD_MIN_LENGTH} caractères minimum.</p>
            </div>
            <div>
              <label htmlFor="confirm-password" className="block text-sm font-medium text-zinc-300 mb-2">Confirmer le nouveau mot de passe</label>
              <input id="confirm-password" type="password" autoComplete="new-password" required
                value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className={inputClass} />
            </div>
            {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onClose}
                className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold rounded-xl transition-all">
                Annuler
              </button>
              <button type="submit" disabled={busy}
                className="flex-1 py-3 bg-gold hover:bg-gold/90 disabled:opacity-50 text-black font-bold rounded-xl transition-all">
                {busy ? "Vérification…" : "Recevoir le code"}
              </button>
            </div>
          </form>
        )}

        {step === "code" && (
          <form onSubmit={confirmChange} className="space-y-4 mt-5">
            <p className="text-zinc-400 text-sm">
              Saisissez le code à 6 chiffres envoyé à <span className="text-gold">{ADMIN_EMAIL}</span>.
              Le mot de passe ne sera modifié qu&apos;après cette confirmation.
            </p>
            <div>
              <label htmlFor="email-code" className="block text-sm font-medium text-zinc-300 mb-2">Code de confirmation</label>
              <input id="email-code" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} required
                value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                className={`${inputClass} tracking-[0.5em] text-center text-lg`} />
            </div>
            {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => requestCode()} disabled={busy}
                className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-300 font-semibold rounded-xl transition-all">
                Renvoyer le code
              </button>
              <button type="submit" disabled={busy || code.length !== 6}
                className="flex-1 py-3 bg-gold hover:bg-gold/90 disabled:opacity-50 text-black font-bold rounded-xl transition-all">
                {busy ? "Confirmation…" : "Confirmer"}
              </button>
            </div>
          </form>
        )}

        {step === "done" && (
          <div className="mt-5 p-4 bg-green-500/10 border border-green-500/30 rounded-xl text-green-400 text-sm">
            ✅ Mot de passe modifié. Par sécurité, toutes vos sessions ont été fermées :
            reconnectez-vous avec le nouveau mot de passe.
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
