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
    newPassword: "Nouveau mot de passe",
    specialty: "Spécialité",
    specialtyAr: "Spécialité (Arabe)",
    save: "Enregistrer les modifications",
    myShowcase: "Ma Vitrine",
    avatarSection: "Photo de Profil",
    avatarDescription: "Votre photo apparaîtra sur la page des coiffeurs",
    dragDropAvatar: "Glissez-déposez votre photo ou cliquez",
    updateAvatar: "Mettre à jour la photo",
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
    newPassword: "كلمة المرور الجديدة",
    specialty: "التخصص",
    specialtyAr: "التخصص (عربي)",
    save: "حفظ التعديلات",
    myShowcase: "واجهة العرض",
    avatarSection: "صورة الملف الشخصي",
    avatarDescription: "ستظهر صورتك في صفحة المصففين",
    dragDropAvatar: "اسحب وأفلت صورتك أو انقر",
    updateAvatar: "تحديث الصورة",
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

// Utility: Sanitize and normalize video URLs
const sanitizeVideoUrl = (url: string): string => {
  if (!url || url.trim() === '') return '';
  
  let cleanUrl = url.trim();
  
  // Google Drive: Convert to direct download link
  if (cleanUrl.includes('drive.google.com')) {
    const fileIdMatch = cleanUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (fileIdMatch) {
      cleanUrl = `https://drive.google.com/uc?export=download&id=${fileIdMatch[1]}`;
    }
  }
  
  // Dropbox: Convert to direct download link
  if (cleanUrl.includes('dropbox.com')) {
    cleanUrl = cleanUrl.replace('www.dropbox.com', 'dl.dropboxusercontent.com');
    cleanUrl = cleanUrl.replace('?dl=0', '?dl=1');
    if (!cleanUrl.includes('?dl=')) {
      cleanUrl += '?dl=1';
    }
  }
  
  // Remove any trailing parameters that might cause issues
  cleanUrl = cleanUrl.split('?')[0] + (cleanUrl.includes('?') ? '?' + cleanUrl.split('?')[1] : '');
  
  return cleanUrl;
};

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

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [specialtyAr, setSpecialtyAr] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [videoDragOver, setVideoDragOver] = useState(false);
  const [avatarDragOver, setAvatarDragOver] = useState(false);
  const [portfolioDragOver, setPortfolioDragOver] = useState(false);

  // Subscription state
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

    // Vérification directe Supabase — ne dépend pas de AuthContext/localStorage
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user) { router.push("/auth/login"); return; }

      const { data: prof } = await supabase!
        .from("profiles")
        .select("id, name, email, specialty, specialty_ar, video_url, subscription_status, subscription_end, role")
        .eq("id", session.user.id)
        .single();

      if (!prof) { router.push("/auth/login"); return; }

      // Vérifier que l'URL correspond à ce coiffeur
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

  // Loading screen - show while auth is loading OR page is initializing
  if (authLoading || isLoading) {
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

  if (!currentUser) {
    return null;
  }

  // --- Subscription helpers ---
  const getDaysRemaining = (): number | null => {
    if (!subscriptionEnd) return null;
    const diff = new Date(subscriptionEnd).getTime() - Date.now();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  const isExpired = (): boolean => {
    const days = getDaysRemaining();
    return days !== null && days < 0;
  };

  const SubscriptionBanner = () => {
    const days = getDaysRemaining();
    const status = subscriptionStatus || 'trial';

    // Pas de banner pour l'admin
    if (status === 'admin') return null;
    if (days === null) return null;
    if (isExpired()) return null;

    const isTrial = status === 'trial';
    const isWarning = days <= 7;

    const bgClass = isTrial
      ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400'
      : isWarning
      ? 'bg-red-500/10 border-red-500/30 text-red-400'
      : 'bg-green-500/10 border-green-500/30 text-green-400';

    const icon = isTrial ? '⏳' : isWarning ? '⚠️' : '✅';
    const label = isTrial
      ? `Période d'essai gratuite — ${days} jour${days > 1 ? 's' : ''} restant${days > 1 ? 's' : ''}`
      : `Abonnement actif — ${days} jour${days > 1 ? 's' : ''} restant${days > 1 ? 's' : ''}`;

    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`mb-8 px-6 py-4 rounded-2xl border flex items-center gap-3 text-sm font-medium ${bgClass}`}
      >
        <span className="text-lg">{icon}</span>
        <span>{label}</span>
      </motion.div>
    );
  };

  // Full-screen expiry block — jamais affiché pour l'admin
  if (isExpired() && subscriptionStatus !== 'admin') {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center z-50 p-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-zinc-900/90 backdrop-blur-xl border border-red-500/30 rounded-3xl p-12 max-w-lg w-full text-center"
        >
          <div className="text-6xl mb-6">🔒</div>
          <h1 className="text-3xl font-bold text-red-400 mb-4">Abonnement expiré</h1>
          <p className="text-zinc-400 mb-8 leading-relaxed">
            Votre accès a expiré. Contactez l'administrateur pour renouveler votre abonnement.
          </p>
          <a
            href="/"
            className="inline-block px-8 py-3 bg-gold hover:bg-gold/80 text-black font-bold rounded-xl transition-all"
          >
            Retour à l'accueil
          </a>
        </motion.div>
      </div>
    );
  }
  // --- End subscription helpers ---

  const toggleLanguage = () => {
    setLang(lang === "fr" ? "ar" : "fr");
  };

  const showSuccess = () => {
    setSuccessMessage(t.success);
    setTimeout(() => setSuccessMessage(""), 3000);
  };

  const handleUpdateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    const updates: any = { email, specialty, specialtyAr };
    if (password) {
      updates.password = password;
    }
    await updateProfile(currentUser.id, updates);
    showSuccess();
    setPassword("");
  };

  const handleUpdateVideoUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (videoUrl && videoUrl.trim() !== '') {
      setUploading(true);
      console.log('📹 Sauvegarde de l\'URL vidéo pour:', currentUser.id, 'URL:', videoUrl);
      
      try {
        // Accepter directement les liens YouTube, Vimeo, ou tout autre lien vidéo
        // Pas de sanitization pour YouTube - garder l'URL originale
        const finalUrl = videoUrl.trim();
        
        // Update via AuthContext which handles Supabase + localStorage
        await updateVideo(currentUser.id, finalUrl);
        setVideoUrl(finalUrl);
        
        console.log('✅ URL vidéo sauvegardée avec succès');
        showSuccess();
      } catch (error: any) {
        console.error('❌ Erreur lors de la sauvegarde:', error);
        alert('Erreur Base de Données : ' + (error?.message || 'Erreur inconnue'));
      } finally {
        setUploading(false);
      }
    } else {
      alert('Veuillez entrer une URL valide');
    }
  };

  const handleVideoDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setVideoDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    const videoFile = files.find(f => f.type.startsWith('video/'));
    if (videoFile) {
      await uploadVideoFile(videoFile);
    }
  };

  const handleVideoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files[0]) {
      await uploadVideoFile(files[0]);
    }
  };

  const uploadVideoFile = async (file: File) => {
    setUploading(true);
    setUploadProgress(0);
    console.log('📤 Upload de fichier vidéo:', file.name, 'Taille:', file.size);
    
    try {
      // Simuler la progression (Supabase ne fournit pas de progression native)
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);
      
      // Chemin simplifié sans sous-dossier
      const path = `video-${currentUser.id}-${Date.now()}.${file.name.split('.').pop()}`;
      const { url, error } = await uploadFile(file, 'avatars', path);
      
      clearInterval(progressInterval);
      
      if (url) {
        setUploadProgress(100);
        console.log('✅ Fichier uploadé, URL:', url);
        
        // Update via AuthContext which handles Supabase + localStorage
        await updateVideo(currentUser.id, url);
        setVideoUrl(url);
        
        console.log('✅ Vidéo sauvegardée avec succès');
        
        // Afficher le succès immédiatement
        showSuccess();
      } else {
        console.error('❌ Erreur upload:', error);
        alert(`Erreur d'upload: ${error}`);
      }
    } catch (error: any) {
      console.error('❌ Erreur lors de l\'upload:', error);
      alert('Erreur d\'upload : ' + (error?.message || 'Erreur inconnue'));
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleAvatarDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setAvatarDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    const imageFile = files.find(f => f.type.startsWith('image/'));
    if (imageFile) {
      await uploadAvatarFile(imageFile);
    }
  };

  const handleAvatarSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files[0]) {
      await uploadAvatarFile(files[0]);
    }
  };

  const uploadAvatarFile = async (file: File) => {
    setUploading(true);
    try {
      // Chemin simplifié sans sous-dossier
      const path = `avatar-${currentUser.id}-${Date.now()}.${file.name.split('.').pop()}`;
      const { url, error } = await uploadFile(file, 'avatars', path);
      if (url) {
        // Mise à jour de l'avatar dans la table profiles
        await updateAvatar(currentUser.id, url);
        
        // Afficher le succès immédiatement
        showSuccess();
      } else {
        alert(`Erreur: ${error}`);
      }
    } catch (error: any) {
      console.error('❌ Erreur upload avatar:', error);
      alert(`Erreur d'upload: ${error?.message || 'Erreur inconnue'}`);
    } finally {
      setUploading(false);
    }
  };

  const handlePortfolioDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setPortfolioDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    const imageFiles = files.filter(f => f.type.startsWith('image/'));
    for (const imageFile of imageFiles) {
      await uploadPortfolioFile(imageFile);
    }
  };

  const handlePortfolioSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      for (let i = 0; i < files.length; i++) {
        await uploadPortfolioFile(files[i]);
      }
    }
  };

  const uploadPortfolioFile = async (file: File) => {
    setUploading(true);
    try {
      const path = `portfolio-${currentUser.id}-${Date.now()}.${file.name.split('.').pop()}`;
      const { url, error } = await uploadFile(file, 'portfolio', path);
      if (url) {
        await addPortfolioImage(currentUser.id, url);
        showSuccess();
      } else {
        alert(`Erreur: ${error}`);
      }
    } catch (error: any) {
      console.error('❌ Erreur upload portfolio:', error);
      alert(`Erreur d'upload: ${error?.message || 'Erreur inconnue'}`);
    } finally {
      setUploading(false);
    }
  };

  const handleRemovePortfolioImage = async (image: string) => {
    if (confirm(lang === "ar" ? "هل تريد حذف هذه الصورة؟" : "Voulez-vous supprimer cette photo ?")) {
      await removePortfolioImage(currentUser.id, image);
      showSuccess();
    }
  };

  return (
    <div className={`min-h-screen p-10 md:p-12 ${fontClass}`} dir={isRTL ? "rtl" : "ltr"}>
      <div className="fixed top-0 left-0 right-0 z-50 bg-zinc-900/90 backdrop-blur-xl border-b border-gold/20 px-10 md:px-12 py-6">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <h2 className="text-gold text-xl font-bold tracking-wider">RAED COIF</h2>
          <button onClick={toggleLanguage} className="px-5 py-2.5 bg-gold/10 hover:bg-gold/20 text-gold border border-gold/30 rounded-xl transition-all duration-300 font-medium text-sm">
            {lang === "fr" ? "العربية" : "Français"}
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto pt-32 pb-16">
        {/* Subscription Banner */}
        <SubscriptionBanner />

        {/* Back Button - Prominent */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }} 
          animate={{ opacity: 1, x: 0 }}
          className="mb-8"
        >
          <a 
            href={`/admin/${currentUser.id}`} 
            className="inline-flex items-center gap-3 px-6 py-3 bg-gold/10 hover:bg-gold/20 border-2 border-gold/30 hover:border-gold text-gold rounded-xl transition-all duration-300 text-lg font-semibold shadow-lg hover:shadow-gold/30"
          >
            <svg className={`w-6 h-6 ${isRTL ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="leading-luxury">{t.backToDashboard}</span>
          </a>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-12">
          <h1 className="text-6xl font-bold text-gold mb-6 leading-luxury">{t.title}</h1>
        </motion.div>

        {successMessage && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8 p-6 bg-green-500/20 border border-green-500/50 rounded-2xl text-green-400 text-center text-lg">
            {successMessage}
          </motion.div>
        )}

        {uploading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-8 p-6 bg-gold/20 border border-gold/50 rounded-2xl text-gold text-center text-lg">
            <div className="mb-2">{uploadProgress > 0 ? t.uploadingProgress.replace('{progress}', uploadProgress.toString()) : t.uploading}</div>
            {uploadProgress > 0 && (
              <div className="w-full bg-zinc-800 rounded-full h-2 mt-3">
                <div 
                  className="bg-gold h-2 rounded-full transition-all duration-300" 
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            )}
          </motion.div>
        )}

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mb-16">
          <h2 className="text-4xl font-bold text-gold mb-8 leading-luxury">{t.accountInfo}</h2>
          <div className="h-px bg-gradient-to-r from-gold/50 via-gold to-gold/50 mb-8"></div>
          <form onSubmit={handleUpdateAccount} className="bg-zinc-900/70 backdrop-blur-xl border border-gold/20 rounded-3xl p-10">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
              <div>
                <label className="block text-base font-medium text-zinc-300 mb-3 leading-luxury">{t.email}</label>
                <input type="email" value={email || ''} onChange={(e) => setEmail(e.target.value)} className="w-full px-5 py-4 bg-zinc-800/50 border border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold transition-all text-white text-lg" />
              </div>
              <div>
                <label className="block text-base font-medium text-zinc-300 mb-3 leading-luxury">{t.newPassword}</label>
                <input type="password" value={password || ''} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="w-full px-5 py-4 bg-zinc-800/50 border border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold transition-all text-white placeholder-zinc-500 text-lg" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
              <div>
                <label className="block text-base font-medium text-zinc-300 mb-3 leading-luxury">{t.specialty}</label>
                <input type="text" value={specialty || ''} onChange={(e) => setSpecialty(e.target.value)} className="w-full px-5 py-4 bg-zinc-800/50 border border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold transition-all text-white text-lg" />
              </div>
              <div>
                <label className="block text-base font-medium text-zinc-300 mb-3 leading-luxury">{t.specialtyAr}</label>
                <input type="text" value={specialtyAr || ''} onChange={(e) => setSpecialtyAr(e.target.value)} className="w-full px-5 py-4 bg-zinc-800/50 border border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold transition-all text-white font-cairo text-lg" dir="rtl" />
              </div>
            </div>
            <motion.button type="submit" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="w-full bg-gold hover:bg-gold/90 text-black font-bold py-4 rounded-xl transition-all text-lg">
              {t.save}
            </motion.button>
          </form>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="mb-16">
          <h2 className="text-5xl font-bold text-gold mb-8 leading-luxury">{t.myShowcase}</h2>
          <div className="h-px bg-gradient-to-r from-gold/50 via-gold to-gold/50 mb-12"></div>

          <div className="mb-16">
            <h3 className="text-3xl font-bold text-white mb-6 leading-luxury">{t.videoSection}</h3>
            <div className="bg-zinc-900/70 backdrop-blur-xl border border-gold/20 rounded-3xl p-10">
              <div className="mb-8">
                <p className="text-zinc-400 mb-4 text-lg leading-luxury">{t.currentVideo}</p>
                <div className="rounded-2xl overflow-hidden bg-black">
                  {currentUser?.video && currentUser.video.trim() !== '' && currentUser.video !== 'undefined' && currentUser.video !== 'null' ? (
                    <video 
                      key={`profile-video-${currentUser.id}-${currentUser.video.substring(0, 20)}`}
                      src={currentUser.video} 
                      autoPlay
                      loop
                      muted
                      playsInline
                      controls={false}
                      onError={(e) => {
                        console.log("Vidéo en attente de configuration");
                        const target = e.currentTarget;
                        target.style.display = 'none';
                      }}
                      className="w-full h-80 object-cover" 
                    />
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

              <div onDrop={handleVideoDrop} onDragOver={(e) => { e.preventDefault(); setVideoDragOver(true); }} onDragLeave={() => setVideoDragOver(false)} onClick={() => videoInputRef.current?.click()} className={`drag-drop-zone ${videoDragOver ? 'drag-over' : ''} cursor-pointer p-12 rounded-2xl text-center transition-all duration-300 mb-6 ${videoDragOver ? 'bg-gold/10' : 'bg-zinc-800/30'}`}>
                <svg className="w-16 h-16 mx-auto mb-4 text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <p className="text-gold text-lg mb-2 leading-luxury">{t.dragDropVideo}</p>
                <p className="text-zinc-500 text-sm leading-luxury">MP4, WebM, MOV (Max 100MB)</p>
                <input ref={videoInputRef} type="file" accept="video/*" onChange={handleVideoSelect} className="hidden" />
              </div>

              <form onSubmit={handleUpdateVideoUrl} className="space-y-4">
                <div>
                  <label className="block text-base font-medium text-zinc-300 mb-3 leading-luxury">{t.pasteUrl}</label>
                  <input type="url" value={videoUrl || ''} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://example.com/video.mp4" className="w-full px-5 py-4 bg-zinc-800/50 border border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold transition-all text-white placeholder-zinc-500 text-lg" />
                  <p className="text-zinc-500 text-sm mt-2 leading-luxury">
                    💡 Utilisez un lien direct (finit par .mp4) ou un lien Dropbox/Google Drive partagé.
                  </p>
                </div>
                <motion.button type="submit" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="w-full bg-gold hover:bg-gold/90 text-black font-bold py-4 rounded-xl transition-all text-lg">
                  {t.updateVideo}
                </motion.button>
              </form>
            </div>
          </div>

          <div className="mb-16">
            <h3 className="text-3xl font-bold text-white mb-6 leading-luxury">{t.avatarSection}</h3>
            <div className="bg-zinc-900/70 backdrop-blur-xl border border-gold/20 rounded-3xl p-10">
              <p className="text-zinc-400 mb-6 text-lg leading-luxury">{t.avatarDescription}</p>
              
              {currentUser?.avatar && (
                <div className="mb-6 flex justify-center">
                  <img 
                    src={currentUser.avatar} 
                    alt="Avatar actuel" 
                    className="w-48 h-48 object-cover rounded-full border-4 border-gold/30 shadow-lg"
                  />
                </div>
              )}

              <div 
                onDrop={handleAvatarDrop} 
                onDragOver={(e) => { e.preventDefault(); setAvatarDragOver(true); }} 
                onDragLeave={() => setAvatarDragOver(false)} 
                onClick={() => avatarInputRef.current?.click()} 
                className={`cursor-pointer p-12 rounded-2xl text-center transition-all duration-300 ${avatarDragOver ? 'bg-gold/10 border-gold' : 'bg-zinc-800/30 border-zinc-700'} border-2 border-dashed`}
              >
                <svg className="w-16 h-16 mx-auto mb-4 text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <p className="text-gold text-lg mb-2 leading-luxury">{t.dragDropAvatar}</p>
                <p className="text-zinc-500 text-sm leading-luxury">JPG, PNG, WebP (Max 5MB)</p>
                <input ref={avatarInputRef} type="file" accept="image/*" onChange={handleAvatarSelect} className="hidden" />
              </div>
            </div>
          </div>

          <div className="mb-16">
            <h3 className="text-3xl font-bold text-white mb-6 leading-luxury">{t.portfolioSection}</h3>
            <div className="bg-zinc-900/70 backdrop-blur-xl border border-gold/20 rounded-3xl p-10">
              <p className="text-zinc-400 mb-6 text-lg leading-luxury">{t.portfolioDescription}</p>
              
              {currentUser?.portfolio && currentUser.portfolio.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-6 mb-8">
                  {currentUser.portfolio.map((image, index) => (
                    <div key={`portfolio-${currentUser.id}-${index}-${image.substring(0, 20)}`} className="relative group">
                      <img src={image} alt={`Portfolio ${index + 1}`} className="w-full h-56 object-cover rounded-2xl" />
                      <button 
                        onClick={() => handleRemovePortfolioImage(image)} 
                        className="absolute top-3 right-3 bg-red-600 hover:bg-red-700 text-white p-3 rounded-xl opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div 
                onDrop={handlePortfolioDrop} 
                onDragOver={(e) => { e.preventDefault(); setPortfolioDragOver(true); }} 
                onDragLeave={() => setPortfolioDragOver(false)} 
                onClick={() => portfolioInputRef.current?.click()} 
                className={`cursor-pointer p-12 rounded-2xl text-center transition-all duration-300 ${portfolioDragOver ? 'bg-gold/10 border-gold' : 'bg-zinc-800/30 border-zinc-700'} border-2 border-dashed`}
              >
                <svg className="w-16 h-16 mx-auto mb-4 text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="text-gold text-lg mb-2 leading-luxury">{t.dragDropPortfolio}</p>
                <p className="text-zinc-500 text-sm leading-luxury">JPG, PNG, WebP (Max 5MB chacune)</p>
                <input ref={portfolioInputRef} type="file" accept="image/*" multiple onChange={handlePortfolioSelect} className="hidden" />
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
