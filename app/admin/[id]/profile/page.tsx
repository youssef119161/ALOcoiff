"use client";

import { motion } from "framer-motion";
import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { uploadFile, supabase } from "../../../../lib/supabase";
import { useAuth } from "../../../context/AuthContext";

type Language = "fr" | "ar";

const translations = {
  fr: {
    title: "Mon Profil",
    backToDashboard: "← Retour au Tableau de Bord",
    accountInfo: "Informations du compte",
    email: "Adresse e-mail",
    specialty: "Clientèle",
    specialtyAr: "Clientèle (Arabe)",
    save: "Enregistrer les modifications",
    passwordSection: "Changer le mot de passe",
    passwordHint: "Laissez vide si vous ne souhaitez pas changer le mot de passe.",
    oldPassword: "Ancien mot de passe",
    newPassword: "Nouveau mot de passe",
    confirmPassword: "Confirmer le nouveau mot de passe",
    errorMismatch: "Les nouveaux mots de passe ne correspondent pas.",
    errorOldPassword: "L'ancien mot de passe est incorrect.",
    errorShort: "Le nouveau mot de passe doit contenir au moins 6 caractères.",
    errorPassword: "Erreur lors du changement de mot de passe.",
    myShowcase: "Ma Vitrine",
    avatarSection: "Photo de Profil",
    avatarDescription: "Votre photo apparaîtra sur la page des coiffeurs",
    dragDropAvatar: "Glissez-déposez votre photo ou cliquez",
    videoSection: "Vidéo d'accueil",
    pasteUrl: "Collez un lien YouTube ou vidéo MP4",
    dragDropVideo: "Glissez-déposez une vidéo MP4 ou cliquez",
    updateVideo: "Mettre à jour la vidéo",
    currentVideo: "Vidéo actuelle",
    portfolioSection: "Mes Réalisations",
    portfolioDescription: "Ajoutez des photos de vos meilleurs travaux",
    dragDropPortfolio: "Glissez-déposez des images ou cliquez",
    success: "✓ Modifications enregistrées avec succès !",
    uploading: "Téléchargement en cours...",
    uploadingProgress: "Téléchargement : {progress}%",
  },
  ar: {
    title: "ملفي الشخصي",
    backToDashboard: "← العودة إلى لوحة التحكم",
    accountInfo: "معلومات الحساب",
    email: "البريد الإلكتروني",
    specialty: "الفئة المستهدفة",
    specialtyAr: "الفئة المستهدفة (عربي)",
    save: "حفظ التعديلات",
    passwordSection: "تغيير كلمة المرور",
    passwordHint: "اتركها فارغة إذا لم ترد تغيير كلمة المرور.",
    oldPassword: "كلمة المرور القديمة",
    newPassword: "كلمة المرور الجديدة",
    confirmPassword: "تأكيد كلمة المرور الجديدة",
    errorMismatch: "كلمتا المرور الجديدتان غير متطابقتين.",
    errorOldPassword: "كلمة المرور القديمة غير صحيحة.",
    errorShort: "يجب أن تحتوي كلمة المرور الجديدة على 6 أحرف على الأقل.",
    errorPassword: "حدث خطأ أثناء تغيير كلمة المرور.",
    myShowcase: "واجهة العرض",
    avatarSection: "صورة الملف الشخصي",
    avatarDescription: "ستظهر صورتك في صفحة المصففين",
    dragDropAvatar: "اسحب وأفلت صورتك أو انقر",
    videoSection: "فيديو الترحيب",
    pasteUrl: "الصق رابط YouTube أو فيديو MP4",
    dragDropVideo: "اسحب وأفلت فيديو MP4 أو انقر",
    updateVideo: "تحديث الفيديو",
    currentVideo: "الفيديو الحالي",
    portfolioSection: "إنجازاتي",
    portfolioDescription: "أضف صور أفضل أعمالك",
    dragDropPortfolio: "اسحب وأفلت الصور أو انقر",
    success: "✓ تم حفظ التعديلات بنجاح!",
    uploading: "جاري التحميل...",
    uploadingProgress: "التحميل: {progress}%",
  },
};

// Icône œil réutilisable
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

export default function ProfilePage() {
  const [lang, setLang] = useState<Language>("fr");
  const [isLoading, setIsLoading] = useState(true);
  const params = useParams();
  const router = useRouter();
  const {
    currentUser,
    isLoading: authLoading,
    updateProfile,
    updateVideo,
    updateAvatar,
    addPortfolioImage,
    removePortfolioImage,
  } = useAuth();

  // Champs info compte
  const [email, setEmail] = useState("");
  const [specialty, setSpecialty] = useState<"Homme" | "Femme" | "Homme & Femme" | "">("");
  const [specialtyAr, setSpecialtyAr] = useState("");

  // Champs mot de passe sécurisés
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  // Upload / UI
  const [videoUrl, setVideoUrl] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [videoDragOver, setVideoDragOver] = useState(false);
  const [avatarDragOver, setAvatarDragOver] = useState(false);
  const [portfolioDragOver, setPortfolioDragOver] = useState(false);

  // Abonnement
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null);
  const [subscriptionEnd, setSubscriptionEnd] = useState<string | null>(null);

  const videoInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const portfolioInputRef = useRef<HTMLInputElement>(null);

  const t = translations[lang];
  const isRTL = lang === "ar";
  const fontClass = lang === "ar" ? "font-cairo" : "font-serif";

  useEffect(() => {
    if (!supabase) { router.push("/"); return; }

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user) { router.push("/auth/login"); return; }

      const { data: prof } = await supabase!
        .from("profiles")
        .select("id, name, email, specialty, specialty_ar, video_url, subscription_status, subscription_end, role")
        .eq("id", session.user.id)
        .single();

      if (!prof) { router.push("/auth/login"); return; }

      const urlId = params.id as string;
      if (prof.id !== urlId && prof.name?.toLowerCase() !== urlId) {
        router.push(`/admin/${prof.id}/profile`);
        return;
      }

      setEmail(prof.email || "");
      setSpecialty(prof.specialty || "");
      setSpecialtyAr(prof.specialty_ar || "");
      setVideoUrl(prof.video_url || "");

      if (prof.role === "admin") {
        setSubscriptionStatus("admin");
        setSubscriptionEnd(null);
      } else {
        setSubscriptionStatus(prof.subscription_status || "trial");
        setSubscriptionEnd(prof.subscription_end || null);
      }

      setIsLoading(false);
    });
  }, [params.id, router]);

  if (authLoading || isLoading) {
    return (
      <div className="fixed inset-0 min-h-screen bg-black flex items-center justify-center z-50">
        <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5 }} className="text-center">
          <h1 className="text-gold text-6xl font-bold tracking-wider mb-4">RAED COIF</h1>
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="w-12 h-12 border-4 border-gold/30 border-t-gold rounded-full mx-auto" />
        </motion.div>
      </div>
    );
  }

  if (!currentUser) return null;

  // ── Helpers abonnement ──
  const getDaysRemaining = (): number | null => {
    if (!subscriptionEnd) return null;
    return Math.ceil((new Date(subscriptionEnd).getTime() - Date.now()) / 86400000);
  };
  const isExpired = (): boolean => { const d = getDaysRemaining(); return d !== null && d < 0; };

  const SubscriptionBanner = () => {
    const days = getDaysRemaining();
    const status = subscriptionStatus || "trial";
    if (status === "admin" || days === null || isExpired()) return null;
    const isTrial = status === "trial";
    const isWarning = days <= 7;
    const bgClass = isTrial
      ? "bg-yellow-500/10 border-yellow-500/30 text-yellow-400"
      : isWarning ? "bg-red-500/10 border-red-500/30 text-red-400"
      : "bg-green-500/10 border-green-500/30 text-green-400";
    const icon = isTrial ? "⏳" : isWarning ? "⚠️" : "✅";
    const label = isTrial
      ? `Période d'essai gratuite — ${days} jour${days > 1 ? "s" : ""} restant${days > 1 ? "s" : ""}`
      : `Abonnement actif — ${days} jour${days > 1 ? "s" : ""} restant${days > 1 ? "s" : ""}`;
    return (
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
        className={`mb-8 px-6 py-4 rounded-2xl border flex items-center gap-3 text-sm font-medium ${bgClass}`}>
        <span className="text-lg">{icon}</span><span>{label}</span>
      </motion.div>
    );
  };

  if (isExpired() && subscriptionStatus !== "admin") {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center z-50 p-8">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
          className="bg-zinc-900/90 backdrop-blur-xl border border-red-500/30 rounded-3xl p-12 max-w-lg w-full text-center">
          <div className="text-6xl mb-6">🔒</div>
          <h1 className="text-3xl font-bold text-red-400 mb-4">Abonnement expiré</h1>
          <p className="text-zinc-400 mb-8 leading-relaxed">Votre accès a expiré. Contactez l'administrateur pour renouveler.</p>
          <a href="/" className="inline-block px-8 py-3 bg-gold hover:bg-gold/80 text-black font-bold rounded-xl transition-all">Retour à l'accueil</a>
        </motion.div>
      </div>
    );
  }

  const showSuccess = () => { setSuccessMessage(t.success); setTimeout(() => setSuccessMessage(""), 3000); };

  // ── Formulaire compte + mot de passe ──
  const handleUpdateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");

    // Mise à jour email + spécialités
    await updateProfile(currentUser.id, { email, specialty, specialtyAr: specialtyAr });

    // Changement de mot de passe seulement si l'un des champs est rempli
    if (oldPassword || newPassword || confirmPassword) {
      if (newPassword !== confirmPassword) {
        setPasswordError(t.errorMismatch);
        return;
      }
      if (newPassword.length < 6) {
        setPasswordError(t.errorShort);
        return;
      }
      if (!supabase) { setPasswordError(t.errorPassword); return; }

      // Vérifier l'ancien mot de passe via re-connexion silencieuse
      const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password: oldPassword });
      if (signInErr) {
        setPasswordError(t.errorOldPassword);
        return;
      }

      // Mettre à jour le mot de passe
      const { error: updateErr } = await supabase.auth.updateUser({ password: newPassword });
      if (updateErr) {
        setPasswordError(t.errorPassword + " " + updateErr.message);
        return;
      }

      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
    }

    showSuccess();
  };

  // ── Upload vidéo URL ──
  const handleUpdateVideoUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!videoUrl?.trim()) { alert("Veuillez entrer une URL valide"); return; }
    setUploading(true);
    try {
      await updateVideo(currentUser.id, videoUrl.trim());
      showSuccess();
    } catch (err: any) {
      alert("Erreur : " + (err?.message || "Erreur inconnue"));
    } finally { setUploading(false); }
  };

  // ── Upload vidéo fichier ──
  const handleVideoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) await uploadVideoFile(e.target.files[0]);
  };
  const handleVideoDrop = async (e: React.DragEvent) => {
    e.preventDefault(); setVideoDragOver(false);
    const f = Array.from(e.dataTransfer.files).find(f => f.type.startsWith("video/"));
    if (f) await uploadVideoFile(f);
  };
  const uploadVideoFile = async (file: File) => {
    setUploading(true); setUploadProgress(0);
    try {
      const interval = setInterval(() => setUploadProgress(p => p >= 90 ? (clearInterval(interval), 90) : p + 10), 200);
      const path = `video-${currentUser.id}-${Date.now()}.${file.name.split(".").pop()}`;
      const { url, error } = await uploadFile(file, "avatars", path);
      clearInterval(interval);
      if (url) { setUploadProgress(100); await updateVideo(currentUser.id, url); setVideoUrl(url); showSuccess(); }
      else alert(`Erreur d'upload: ${error}`);
    } catch (err: any) { alert("Erreur : " + (err?.message || "Erreur inconnue")); }
    finally { setUploading(false); setUploadProgress(0); }
  };

  // ── Upload avatar ──
  const handleAvatarSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) await uploadAvatarFile(e.target.files[0]);
  };
  const handleAvatarDrop = async (e: React.DragEvent) => {
    e.preventDefault(); setAvatarDragOver(false);
    const f = Array.from(e.dataTransfer.files).find(f => f.type.startsWith("image/"));
    if (f) await uploadAvatarFile(f);
  };
  const uploadAvatarFile = async (file: File) => {
    setUploading(true);
    try {
      const path = `avatar-${currentUser.id}-${Date.now()}.${file.name.split(".").pop()}`;
      const { url, error } = await uploadFile(file, "avatars", path);
      if (url) { await updateAvatar(currentUser.id, url); showSuccess(); }
      else alert(`Erreur: ${error}`);
    } catch (err: any) { alert("Erreur : " + (err?.message || "Erreur inconnue")); }
    finally { setUploading(false); }
  };

  // ── Upload portfolio ──
  const handlePortfolioSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) for (let i = 0; i < e.target.files.length; i++) await uploadPortfolioFile(e.target.files[i]);
  };
  const handlePortfolioDrop = async (e: React.DragEvent) => {
    e.preventDefault(); setPortfolioDragOver(false);
    for (const f of Array.from(e.dataTransfer.files).filter(f => f.type.startsWith("image/"))) await uploadPortfolioFile(f);
  };
  const uploadPortfolioFile = async (file: File) => {
    setUploading(true);
    try {
      const path = `portfolio-${currentUser.id}-${Date.now()}.${file.name.split(".").pop()}`;
      const { url, error } = await uploadFile(file, "portfolio", path);
      if (url) { await addPortfolioImage(currentUser.id, url); showSuccess(); }
      else alert(`Erreur: ${error}`);
    } catch (err: any) { alert("Erreur : " + (err?.message || "Erreur inconnue")); }
    finally { setUploading(false); }
  };

  const handleRemovePortfolioImage = async (image: string) => {
    if (confirm(lang === "ar" ? "هل تريد حذف هذه الصورة؟" : "Voulez-vous supprimer cette photo ?")) {
      await removePortfolioImage(currentUser.id, image);
      showSuccess();
    }
  };

  // ── Champ password helper ──
  const PwField = ({
    label, value, onChange, show, onToggle, autoComplete,
  }: {
    label: string; value: string; onChange: (v: string) => void;
    show: boolean; onToggle: () => void; autoComplete?: string;
  }) => (
    <div>
      <label className="block text-sm font-medium text-zinc-300 mb-2">{label}</label>
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={e => { onChange(e.target.value); setPasswordError(""); }}
          placeholder="••••••••"
          autoComplete={autoComplete}
          className="w-full px-4 py-3 pr-12 bg-zinc-800/50 border border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold transition-all text-white placeholder-zinc-500"
        />
        <button type="button" onClick={onToggle} tabIndex={-1}
          className="absolute inset-y-0 right-3 flex items-center text-zinc-400 hover:text-gold transition-colors">
          <EyeIcon visible={show} />
        </button>
      </div>
    </div>
  );

  return (
    <div className={`min-h-screen p-10 md:p-12 ${fontClass}`} dir={isRTL ? "rtl" : "ltr"}>
      {/* Navbar */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-zinc-900/90 backdrop-blur-xl border-b border-gold/20 px-10 md:px-12 py-6">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <h2 className="text-gold text-xl font-bold tracking-wider">RAED COIF</h2>
          <button onClick={() => setLang(l => l === "fr" ? "ar" : "fr")}
            className="px-5 py-2.5 bg-gold/10 hover:bg-gold/20 text-gold border border-gold/30 rounded-xl transition-all duration-300 font-medium text-sm">
            {lang === "fr" ? "العربية" : "Français"}
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto pt-32 pb-16">
        <SubscriptionBanner />

        {/* Bouton retour */}
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="mb-8">
          <a href={`/admin/${currentUser.id}`}
            className="inline-flex items-center gap-3 px-6 py-3 bg-gold/10 hover:bg-gold/20 border-2 border-gold/30 hover:border-gold text-gold rounded-xl transition-all duration-300 text-lg font-semibold shadow-lg hover:shadow-gold/30">
            <svg className={`w-6 h-6 ${isRTL ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
            {t.backToDashboard}
          </a>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-12">
          <h1 className="text-6xl font-bold text-gold mb-6">{t.title}</h1>
        </motion.div>

        {successMessage && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
            className="mb-8 p-6 bg-green-500/20 border border-green-500/50 rounded-2xl text-green-400 text-center text-lg">
            {successMessage}
          </motion.div>
        )}

        {uploading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="mb-8 p-6 bg-gold/20 border border-gold/50 rounded-2xl text-gold text-center text-lg">
            <div className="mb-2">
              {uploadProgress > 0 ? t.uploadingProgress.replace("{progress}", uploadProgress.toString()) : t.uploading}
            </div>
            {uploadProgress > 0 && (
              <div className="w-full bg-zinc-800 rounded-full h-2 mt-3">
                <div className="bg-gold h-2 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
              </div>
            )}
          </motion.div>
        )}

        {/* ══ Informations du compte ══ */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mb-16">
          <h2 className="text-4xl font-bold text-gold mb-8">{t.accountInfo}</h2>
          <div className="h-px bg-gradient-to-r from-gold/50 via-gold to-gold/50 mb-8" />

          <form onSubmit={handleUpdateAccount} className="bg-zinc-900/70 backdrop-blur-xl border border-gold/20 rounded-3xl p-10">
            {/* Email */}
            <div className="mb-8">
              <label className="block text-base font-medium text-zinc-300 mb-3">{t.email}</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                className="w-full px-5 py-4 bg-zinc-800/50 border border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold transition-all text-white text-lg" />
            </div>

            {/* Clientèle cible */}
            <div className="mb-10">
              <label className="block text-base font-medium text-zinc-300 mb-4">{t.specialty}</label>
              <div className="grid grid-cols-3 gap-4">
                {(["Homme", "Femme", "Homme & Femme"] as const).map((option) => {
                  const labelsAr: Record<string, string> = { "Homme": "رجال", "Femme": "نساء", "Homme & Femme": "رجال ونساء" };
                  const isSelected = specialty === option;
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => { setSpecialty(option); setSpecialtyAr(labelsAr[option]); }}
                      className={`p-5 rounded-2xl border-2 transition-all duration-300 flex flex-col items-center gap-2 ${
                        isSelected
                          ? "border-gold bg-gold/15 shadow-lg shadow-gold/20"
                          : "border-zinc-700 bg-zinc-800/30 hover:border-gold/50 hover:bg-zinc-800/60"
                      }`}
                    >
                      {/* Icône SVG */}
                      {option === "Homme" && (
                        <svg className={`w-9 h-9 ${isSelected ? "text-gold" : "text-zinc-400"}`} fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>
                        </svg>
                      )}
                      {option === "Femme" && (
                        <svg className={`w-9 h-9 ${isSelected ? "text-gold" : "text-zinc-400"}`} fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 2a5 5 0 100 10A5 5 0 0012 2zm0 12c-5.33 0-8 2.67-8 4v1h16v-1c0-1.33-2.67-4-8-4z"/>
                          <path d="M10.5 14.5v4m3-4v4M9 17h6" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round"/>
                        </svg>
                      )}
                      {option === "Homme & Femme" && (
                        <svg className={`w-9 h-9 ${isSelected ? "text-gold" : "text-zinc-400"}`} fill="currentColor" viewBox="0 0 24 24">
                          <path d="M9 12c2.2 0 4-1.8 4-4s-1.8-4-4-4-4 1.8-4 4 1.8 4 4 4zm0 2c-2.7 0-8 1.3-8 4v1h16v-1c0-2.7-5.3-4-8-4z" opacity="0.7"/>
                          <path d="M16 11c1.7 0 3-1.3 3-3s-1.3-3-3-3-3 1.3-3 3 1.3 3 3 3zm0 2c-.8 0-1.5.1-2.2.3C15 14 16 15.1 16 16.5V18h6v-1c0-2-2.7-4-6-4z"/>
                        </svg>
                      )}
                      <span className={`text-base font-semibold ${isSelected ? "text-gold" : "text-zinc-300"}`}>
                        {option}
                      </span>
                      <span className={`text-sm font-cairo ${isSelected ? "text-gold/70" : "text-zinc-500"}`}>
                        {labelsAr[option]}
                      </span>
                      {isSelected && (
                        <div className="w-5 h-5 bg-gold rounded-full flex items-center justify-center mt-1">
                          <svg className="w-3 h-3 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── Section mot de passe ── */}
            <div className="border-t border-zinc-700/50 pt-8 mb-8">
              <h3 className="text-xl font-bold text-gold mb-1">{t.passwordSection}</h3>
              <p className="text-zinc-500 text-sm mb-6">{t.passwordHint}</p>

              {passwordError && (
                <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
                  className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
                  {passwordError}
                </motion.div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <PwField
                  label={t.oldPassword}
                  value={oldPassword}
                  onChange={setOldPassword}
                  show={showOld}
                  onToggle={() => setShowOld(v => !v)}
                  autoComplete="current-password"
                />
                <PwField
                  label={t.newPassword}
                  value={newPassword}
                  onChange={setNewPassword}
                  show={showNew}
                  onToggle={() => setShowNew(v => !v)}
                  autoComplete="new-password"
                />
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">{t.confirmPassword}</label>
                  <div className="relative">
                    <input
                      type={showConfirm ? "text" : "password"}
                      value={confirmPassword}
                      onChange={e => { setConfirmPassword(e.target.value); setPasswordError(""); }}
                      placeholder="••••••••"
                      autoComplete="new-password"
                      className={`w-full px-4 py-3 pr-12 bg-zinc-800/50 border rounded-xl focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold transition-all text-white placeholder-zinc-500 ${
                        confirmPassword && newPassword !== confirmPassword ? "border-red-500/60"
                        : confirmPassword && newPassword === confirmPassword ? "border-green-500/60"
                        : "border-zinc-700"
                      }`}
                    />
                    <button type="button" onClick={() => setShowConfirm(v => !v)} tabIndex={-1}
                      className="absolute inset-y-0 right-3 flex items-center text-zinc-400 hover:text-gold transition-colors">
                      <EyeIcon visible={showConfirm} />
                    </button>
                  </div>
                  {confirmPassword && (
                    <p className={`text-xs mt-1 ${newPassword === confirmPassword ? "text-green-400" : "text-red-400"}`}>
                      {newPassword === confirmPassword
                        ? (lang === "fr" ? "✓ Les mots de passe correspondent" : "✓ كلمتا المرور متطابقتان")
                        : (lang === "fr" ? "✗ Ne correspondent pas" : "✗ غير متطابقتان")}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <motion.button type="submit" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              className="w-full bg-gold hover:bg-gold/90 text-black font-bold py-4 rounded-xl transition-all text-lg">
              {t.save}
            </motion.button>
          </form>
        </motion.div>

        {/* ══ Ma Vitrine ══ */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="mb-16">
          <h2 className="text-5xl font-bold text-gold mb-8">{t.myShowcase}</h2>
          <div className="h-px bg-gradient-to-r from-gold/50 via-gold to-gold/50 mb-12" />

          {/* Vidéo */}
          <div className="mb-16">
            <h3 className="text-3xl font-bold text-white mb-6">{t.videoSection}</h3>
            <div className="bg-zinc-900/70 backdrop-blur-xl border border-gold/20 rounded-3xl p-10">
              <div className="mb-8">
                <p className="text-zinc-400 mb-4 text-lg">{t.currentVideo}</p>
                <div className="rounded-2xl overflow-hidden bg-black">
                  {currentUser?.video && currentUser.video.trim() !== "" && currentUser.video !== "undefined" ? (
                    <video src={currentUser.video} autoPlay loop muted playsInline controls={false}
                      onError={e => { (e.currentTarget as HTMLVideoElement).style.display = "none"; }}
                      className="w-full h-80 object-cover" />
                  ) : (
                    <div className="w-full h-80 flex items-center justify-center bg-gradient-to-br from-zinc-900 via-gold/10 to-zinc-900">
                      <div className="text-center">
                        <svg className="w-20 h-20 mx-auto mb-4 text-gold/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        <p className="text-gold/50">Aucune vidéo</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Drop zone vidéo */}
              <div onDrop={handleVideoDrop} onDragOver={e => { e.preventDefault(); setVideoDragOver(true); }}
                onDragLeave={() => setVideoDragOver(false)} onClick={() => videoInputRef.current?.click()}
                className={`cursor-pointer p-12 rounded-2xl text-center transition-all duration-300 mb-6 border-2 border-dashed ${videoDragOver ? "bg-gold/10 border-gold" : "bg-zinc-800/30 border-zinc-700"}`}>
                <svg className="w-16 h-16 mx-auto mb-4 text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <p className="text-gold text-lg mb-2">{t.dragDropVideo}</p>
                <p className="text-zinc-500 text-sm">MP4, WebM, MOV (Max 100MB)</p>
                <input ref={videoInputRef} type="file" accept="video/*" onChange={handleVideoSelect} className="hidden" />
              </div>

              {/* URL vidéo */}
              <form onSubmit={handleUpdateVideoUrl} className="space-y-4">
                <div>
                  <label className="block text-base font-medium text-zinc-300 mb-3">{t.pasteUrl}</label>
                  <input type="url" value={videoUrl} onChange={e => setVideoUrl(e.target.value)}
                    placeholder="https://example.com/video.mp4"
                    className="w-full px-5 py-4 bg-zinc-800/50 border border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold transition-all text-white placeholder-zinc-500 text-lg" />
                  <p className="text-zinc-500 text-sm mt-2">💡 Lien direct .mp4 ou Dropbox/Google Drive partagé.</p>
                </div>
                <motion.button type="submit" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  className="w-full bg-gold hover:bg-gold/90 text-black font-bold py-4 rounded-xl transition-all text-lg">
                  {t.updateVideo}
                </motion.button>
              </form>
            </div>
          </div>

          {/* Avatar */}
          <div className="mb-16">
            <h3 className="text-3xl font-bold text-white mb-6">{t.avatarSection}</h3>
            <div className="bg-zinc-900/70 backdrop-blur-xl border border-gold/20 rounded-3xl p-10">
              <p className="text-zinc-400 mb-6 text-lg">{t.avatarDescription}</p>
              {currentUser?.avatar && (
                <div className="mb-6 flex justify-center">
                  <img src={currentUser.avatar} alt="Avatar" className="w-48 h-48 object-cover rounded-full border-4 border-gold/30 shadow-lg" />
                </div>
              )}
              <div onDrop={handleAvatarDrop} onDragOver={e => { e.preventDefault(); setAvatarDragOver(true); }}
                onDragLeave={() => setAvatarDragOver(false)} onClick={() => avatarInputRef.current?.click()}
                className={`cursor-pointer p-12 rounded-2xl text-center transition-all duration-300 border-2 border-dashed ${avatarDragOver ? "bg-gold/10 border-gold" : "bg-zinc-800/30 border-zinc-700"}`}>
                <svg className="w-16 h-16 mx-auto mb-4 text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <p className="text-gold text-lg mb-2">{t.dragDropAvatar}</p>
                <p className="text-zinc-500 text-sm">JPG, PNG, WebP (Max 5MB)</p>
                <input ref={avatarInputRef} type="file" accept="image/*" onChange={handleAvatarSelect} className="hidden" />
              </div>
            </div>
          </div>

          {/* Portfolio */}
          <div className="mb-16">
            <h3 className="text-3xl font-bold text-white mb-6">{t.portfolioSection}</h3>
            <div className="bg-zinc-900/70 backdrop-blur-xl border border-gold/20 rounded-3xl p-10">
              <p className="text-zinc-400 mb-6 text-lg">{t.portfolioDescription}</p>
              {currentUser?.portfolio && currentUser.portfolio.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-6 mb-8">
                  {currentUser.portfolio.map((image, index) => (
                    <div key={`portfolio-${index}-${image.substring(0, 20)}`} className="relative group">
                      <img src={image} alt={`Portfolio ${index + 1}`} className="w-full h-56 object-cover rounded-2xl" />
                      <button onClick={() => handleRemovePortfolioImage(image)}
                        className="absolute top-3 right-3 bg-red-600 hover:bg-red-700 text-white p-3 rounded-xl opacity-0 group-hover:opacity-100 transition-all">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div onDrop={handlePortfolioDrop} onDragOver={e => { e.preventDefault(); setPortfolioDragOver(true); }}
                onDragLeave={() => setPortfolioDragOver(false)} onClick={() => portfolioInputRef.current?.click()}
                className={`cursor-pointer p-12 rounded-2xl text-center transition-all duration-300 border-2 border-dashed ${portfolioDragOver ? "bg-gold/10 border-gold" : "bg-zinc-800/30 border-zinc-700"}`}>
                <svg className="w-16 h-16 mx-auto mb-4 text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="text-gold text-lg mb-2">{t.dragDropPortfolio}</p>
                <p className="text-zinc-500 text-sm">JPG, PNG, WebP (Max 5MB chacune)</p>
                <input ref={portfolioInputRef} type="file" accept="image/*" multiple onChange={handlePortfolioSelect} className="hidden" />
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
