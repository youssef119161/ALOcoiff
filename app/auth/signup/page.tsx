"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { supabase, uploadFile } from "../../../lib/supabase";

type Language = "fr" | "ar";

const translations = {
  fr: {
    title: "Inscription Coiffeur",
    subtitle: "Rejoignez l'équipe RAED COIF",
    name: "Nom complet",
    nameAr: "Nom en arabe",
    email: "Adresse e-mail",
    password: "Mot de passe",
    confirmPassword: "Confirmer le mot de passe",
    specialty: "Spécialité",
    specialtyAr: "Spécialité en arabe",
    avatar: "Photo de profil",
    avatarRequired: "La photo de profil est obligatoire",
    dragDropAvatar: "Glissez-déposez votre photo ou cliquez",
    video: "Vidéo de présentation (optionnel)",
    dragDropVideo: "Glissez-déposez une vidéo ou cliquez",
    portfolio: "Photos de votre travail (optionnel)",
    dragDropPortfolio: "Glissez-déposez des images ou cliquez",
    signup: "S'inscrire",
    uploading: "Inscription en cours...",
    errorPasswordMatch: "Les mots de passe ne correspondent pas",
    errorPasswordLength: "Le mot de passe doit contenir au moins 6 caractères",
    errorAvatarRequired: "Veuillez ajouter une photo de profil",
    errorSignup: "Erreur lors de l'inscription",
    errorStoragePermission: "Permission Storage refusée (RLS). Vérifiez les politiques du bucket.",
    errorEmailInvalid: "Format d'email invalide. Utilisez un email valide (ex: nom@domaine.com)",
    successSignup: "Inscription réussie ! Redirection...",
    backLogin: "← Retour à la connexion",
    alreadyAccount: "Déjà un compte ?",
    login: "Se connecter",
  },
  ar: {
    title: "تسجيل مصفف",
    subtitle: "انضم إلى فريق RAED COIF",
    name: "الاسم الكامل",
    nameAr: "الاسم بالعربية",
    email: "البريد الإلكتروني",
    password: "كلمة المرور",
    confirmPassword: "تأكيد كلمة المرور",
    specialty: "التخصص",
    specialtyAr: "التخصص بالعربية",
    avatar: "صورة الملف الشخصي",
    avatarRequired: "صورة الملف الشخصي مطلوبة",
    dragDropAvatar: "اسحب وأفلت صورتك أو انقر",
    video: "فيديو تقديمي (اختياري)",
    dragDropVideo: "اسحب وأفلت فيديو أو انقر",
    portfolio: "صور أعمالك (اختياري)",
    dragDropPortfolio: "اسحب وأفلت الصور أو انقر",
    signup: "سجل",
    uploading: "جاري التسجيل...",
    errorPasswordMatch: "كلمات المرور غير متطابقة",
    errorPasswordLength: "يجب أن تحتوي كلمة المرور على 6 أحرف على الأقل",
    errorAvatarRequired: "يرجى إضافة صورة الملف الشخصي",
    errorSignup: "خطأ في التسجيل",
    errorStoragePermission: "تم رفض إذن التخزين (RLS). تحقق من سياسات الحاوية.",
    errorEmailInvalid: "تنسيق البريد الإلكتروني غير صالح. استخدم بريدًا إلكترونيًا صالحًا",
    successSignup: "تم التسجيل بنجاح! إعادة التوجيه...",
    backLogin: "← العودة إلى تسجيل الدخول",
    alreadyAccount: "لديك حساب بالفعل؟",
    login: "تسجيل الدخول",
  },
};

export default function SignupPage() {
  const [lang, setLang] = useState<Language>("fr");
  const [name, setName] = useState("");
  const [nameAr, setNameAr] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [specialtyAr, setSpecialtyAr] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string>("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [portfolioFiles, setPortfolioFiles] = useState<File[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [avatarDragOver, setAvatarDragOver] = useState(false);
  const [videoDragOver, setVideoDragOver] = useState(false);
  const [portfolioDragOver, setPortfolioDragOver] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<'mensuel' | 'annuel' | ''>('');
  const [paymentMethod, setPaymentMethod] = useState('');

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const portfolioInputRef = useRef<HTMLInputElement>(null);

  const router = useRouter();

  const t = translations[lang];
  const isRTL = lang === "ar";
  const fontClass = lang === "ar" ? "font-cairo" : "font-serif";

  // Rediriger si déjà connecté
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user) return;
      // Récupérer le rôle pour rediriger au bon endroit
      const { data: profile } = await supabase!
        .from('profiles')
        .select('id, role')
        .eq('id', session.user.id)
        .single();
      if (!profile) return;
      if (profile.role === 'admin') {
        window.location.replace('/admin/dashboard');
      } else {
        window.location.replace(`/admin/${profile.id}`);
      }
    });
  }, []);

  const toggleLanguage = () => {
    setLang(lang === "fr" ? "ar" : "fr");
  };

  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
    }
  };

  const handleAvatarDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setAvatarDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
    }
  };

  const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('video/')) {
      setVideoFile(file);
    }
  };

  const handleVideoDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setVideoDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('video/')) {
      setVideoFile(file);
    }
  };

  const handlePortfolioSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const imageFiles = files.filter(f => f.type.startsWith('image/'));
    setPortfolioFiles(prev => [...prev, ...imageFiles]);
  };

  const handlePortfolioDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setPortfolioDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    const imageFiles = files.filter(f => f.type.startsWith('image/'));
    setPortfolioFiles(prev => [...prev, ...imageFiles]);
  };

  const removePortfolioImage = (index: number) => {
    setPortfolioFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    // Nettoyer l'email des espaces et normaliser
    const cleanEmail = email.trim().toLowerCase();
    console.log("📧 Email testé:", cleanEmail);

    // Validation email simplifiée - juste vérifier que ce n'est pas vide
    if (!cleanEmail) {
      setError(t.errorEmailInvalid);
      return;
    }

    // Validations
    if (password !== confirmPassword) {
      setError(t.errorPasswordMatch);
      return;
    }

    if (password.length < 6) {
      setError(t.errorPasswordLength);
      return;
    }

    if (!avatarFile) {
      setError(t.errorAvatarRequired);
      return;
    }

    if (!selectedPlan) {
      setError(lang === 'ar' ? 'يرجى اختيار الباقة' : 'Veuillez choisir un forfait');
      return;
    }

    if (!paymentMethod) {
      setError(lang === 'ar' ? 'يرجى اختيار طريقة الدفع' : 'Veuillez choisir une méthode de paiement');
      return;
    }

    setIsSubmitting(true);

    try {
      if (!supabase) throw new Error('Supabase non configuré');

      // ── 1. Créer le compte Auth ──────────────────────────────
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
      });

      // Bloquer immédiatement si erreur Auth
      if (authError) {
        console.error('❌ Erreur Auth:', authError.message);
        if (
          authError.message.toLowerCase().includes('already registered') ||
          authError.message.toLowerCase().includes('already been registered') ||
          authError.message.toLowerCase().includes('user already')
        ) {
          throw new Error(
            lang === 'ar'
              ? 'هذا البريد الإلكتروني مسجل بالفعل. يرجى تسجيل الدخول أو استخدام بريد آخر.'
              : 'Cet e-mail est déjà enregistré. Veuillez vous connecter ou utiliser un autre e-mail.'
          );
        }
        if (authError.message.toLowerCase().includes('invalid') || authError.message.toLowerCase().includes('email')) {
          throw new Error(t.errorEmailInvalid);
        }
        throw new Error(authError.message);
      }

      if (!authData.user) throw new Error('Utilisateur non créé');

      // Détecter email déjà existant via identities vides (comportement silencieux Supabase)
      if (authData.user.identities && authData.user.identities.length === 0) {
        throw new Error(
          lang === 'ar'
            ? 'هذا البريد الإلكتروني مسجل بالفعل. يرجى تسجيل الدخول أو استخدام بريد آخر.'
            : 'Cet e-mail est déjà enregistré. Veuillez vous connecter ou utiliser un autre e-mail.'
        );
      }

      const userId = authData.user.id;
      console.log('✅ Compte Auth créé:', userId);

      // Attendre la session si nécessaire
      if (!authData.session) {
        await new Promise(resolve => setTimeout(resolve, 1500));
        const { error: signInError } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
        if (signInError) console.warn('⚠️ Session non établie:', signInError.message);
      }

      // ── 2. Upload avatar (obligatoire) ───────────────────────
      const avatarPath = `avatar-${userId}-${Date.now()}.${avatarFile.name.split('.').pop()}`;
      const { url: avatarUrl, error: avatarError } = await uploadFile(avatarFile, 'avatars', avatarPath);

      if (avatarError || !avatarUrl) {
        console.error('❌ Upload avatar:', avatarError);
        await supabase.auth.signOut().catch(() => {});
        throw new Error(t.errorStoragePermission + ` (${avatarError || 'URL non générée'})`);
      }

      // ── 3. Upload vidéo (optionnel) ──────────────────────────
      let videoUrl = '';
      if (videoFile) {
        const videoPath = `video-${userId}-${Date.now()}.${videoFile.name.split('.').pop()}`;
        const { url, error: ve } = await uploadFile(videoFile, 'videos', videoPath);
        if (!ve && url) videoUrl = url;
        else console.warn('⚠️ Upload vidéo ignoré:', ve);
      }

      // ── 4. Upload portfolio (optionnel) ──────────────────────
      const portfolioUrls: string[] = [];
      for (const file of portfolioFiles) {
        const path = `portfolio-${userId}-${Date.now()}-${Math.random().toString(36).substring(7)}.${file.name.split('.').pop()}`;
        const { url, error: pe } = await uploadFile(file, 'portfolio', path);
        if (!pe && url) portfolioUrls.push(url);
        else console.warn('⚠️ Upload portfolio ignoré:', pe);
      }

      // ── 5. Insérer le profil ─────────────────────────────────
      const profileData = {
        id: userId,
        name,
        name_ar: nameAr,
        email: cleanEmail,
        specialty,
        specialty_ar: specialtyAr,
        avatar_url: avatarUrl,
        video_url: videoUrl || null,
        subscription_status: 'trial',
        payment_method: `${selectedPlan} - ${paymentMethod}`,
        is_approved: false,
        role: 'coiffeur',
      };

      const { error: profileError } = await supabase.from('profiles').insert(profileData).select();

      if (profileError) {
        console.error('❌ Erreur profil:', profileError.message, '| code:', profileError.code, '| hint:', profileError.hint);
        // Nettoyer le compte Auth créé pour éviter un état incohérent
        await supabase.auth.signOut().catch(() => {});
        if (!profileError.message) {
          throw new Error('Erreur RLS : la table profiles bloque l\'insertion. Vérifiez les politiques Supabase.');
        }
        throw new Error(`Erreur profil : ${profileError.message} (${profileError.code})`);
      }

      // ── 6. Portfolio en base ─────────────────────────────────
      if (portfolioUrls.length > 0) {
        const { portfolioDB } = await import('../../../lib/supabase');
        for (const url of portfolioUrls) {
          await portfolioDB.add(userId, url).catch(e => console.warn('⚠️ Portfolio DB:', e));
        }
      }

      setSuccess(t.successSignup);
      // Redirection vers le dashboard avec l'ID Supabase (stable, pas le nom)
      setTimeout(() => { window.location.href = `/admin/${userId}`; }, 1500);

    } catch (err: any) {
      console.error('❌ Inscription échouée:', err?.message);
      setError(err?.message || t.errorSignup);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className={`min-h-screen p-8 ${fontClass}`}
      dir={isRTL ? "rtl" : "ltr"}
    >
      <button
        onClick={toggleLanguage}
        className="fixed top-8 right-8 z-50 px-4 py-2 bg-gold/10 hover:bg-gold/20 text-gold border border-gold/30 rounded-lg transition-all duration-300 font-medium"
      >
        {lang === "fr" ? "العربية" : "Français"}
      </button>

      <div className="max-w-4xl mx-auto pt-20">
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

          {success && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 p-4 bg-green-500/10 border border-green-500/30 rounded-xl text-green-400 text-sm text-center"
            >
              {success}
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Informations de base */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  {t.name}
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoComplete="name"
                  className="w-full px-4 py-3 bg-zinc-800/50 border border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold transition-all text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  {t.nameAr}
                </label>
                <input
                  type="text"
                  value={nameAr}
                  onChange={(e) => setNameAr(e.target.value)}
                  required
                  dir="rtl"
                  className="w-full px-4 py-3 bg-zinc-800/50 border border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold transition-all text-white font-cairo"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                {t.email}
              </label>
              <input
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full px-4 py-3 bg-zinc-800/50 border border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold transition-all text-white"
                placeholder="exemple@email.com"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  {t.password}
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  className="w-full px-4 py-3 bg-zinc-800/50 border border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold transition-all text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  {t.confirmPassword}
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  className="w-full px-4 py-3 bg-zinc-800/50 border border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold transition-all text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  {t.specialty}
                </label>
                <input
                  type="text"
                  value={specialty}
                  onChange={(e) => setSpecialty(e.target.value)}
                  required
                  className="w-full px-4 py-3 bg-zinc-800/50 border border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold transition-all text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  {t.specialtyAr}
                </label>
                <input
                  type="text"
                  value={specialtyAr}
                  onChange={(e) => setSpecialtyAr(e.target.value)}
                  required
                  dir="rtl"
                  className="w-full px-4 py-3 bg-zinc-800/50 border border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold transition-all text-white font-cairo"
                />
              </div>
            </div>

            {/* Avatar (obligatoire) */}
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                {t.avatar} <span className="text-red-500">*</span>
              </label>
              <p className="text-xs text-zinc-500 mb-3">{t.avatarRequired}</p>
              
              {avatarPreview && (
                <div className="mb-4 flex justify-center">
                  <img 
                    src={avatarPreview} 
                    alt="Avatar preview" 
                    className="w-32 h-32 object-cover rounded-full border-4 border-gold/30"
                  />
                </div>
              )}

              <div
                onDrop={handleAvatarDrop}
                onDragOver={(e) => { e.preventDefault(); setAvatarDragOver(true); }}
                onDragLeave={() => setAvatarDragOver(false)}
                onClick={() => avatarInputRef.current?.click()}
                className={`cursor-pointer p-8 rounded-xl text-center transition-all duration-300 border-2 border-dashed ${
                  avatarDragOver ? 'bg-gold/10 border-gold' : 'bg-zinc-800/30 border-zinc-700'
                }`}
              >
                <svg className="w-12 h-12 mx-auto mb-3 text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <p className="text-gold text-sm">{t.dragDropAvatar}</p>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarSelect}
                  className="hidden"
                />
              </div>
            </div>

            {/* Vidéo (optionnel) */}
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                {t.video}
              </label>
              
              {videoFile && (
                <p className="text-sm text-green-400 mb-2">✓ {videoFile.name}</p>
              )}

              <div
                onDrop={handleVideoDrop}
                onDragOver={(e) => { e.preventDefault(); setVideoDragOver(true); }}
                onDragLeave={() => setVideoDragOver(false)}
                onClick={() => videoInputRef.current?.click()}
                className={`cursor-pointer p-8 rounded-xl text-center transition-all duration-300 border-2 border-dashed ${
                  videoDragOver ? 'bg-gold/10 border-gold' : 'bg-zinc-800/30 border-zinc-700'
                }`}
              >
                <svg className="w-12 h-12 mx-auto mb-3 text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <p className="text-gold text-sm">{t.dragDropVideo}</p>
                <input
                  ref={videoInputRef}
                  type="file"
                  accept="video/*"
                  onChange={handleVideoSelect}
                  className="hidden"
                />
              </div>
            </div>

            {/* Portfolio (optionnel) */}
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                {t.portfolio}
              </label>
              
              {portfolioFiles.length > 0 && (
                <div className="grid grid-cols-4 gap-2 mb-4">
                  {portfolioFiles.map((file, index) => (
                    <div key={index} className="relative group">
                      <img
                        src={URL.createObjectURL(file)}
                        alt={`Portfolio ${index + 1}`}
                        className="w-full h-24 object-cover rounded-lg"
                      />
                      <button
                        type="button"
                        onClick={() => removePortfolioImage(index)}
                        className="absolute top-1 right-1 bg-red-600 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                className={`cursor-pointer p-8 rounded-xl text-center transition-all duration-300 border-2 border-dashed ${
                  portfolioDragOver ? 'bg-gold/10 border-gold' : 'bg-zinc-800/30 border-zinc-700'
                }`}
              >
                <svg className="w-12 h-12 mx-auto mb-3 text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="text-gold text-sm">{t.dragDropPortfolio}</p>
                <input
                  ref={portfolioInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handlePortfolioSelect}
                  className="hidden"
                />
              </div>
            </div>

            {/* Choix du Forfait */}
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-4">
                {lang === 'ar' ? 'اختر باقتك' : 'Choisissez votre accès'} <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Pack Mensuel */}
                <div
                  onClick={() => setSelectedPlan('mensuel')}
                  className={`cursor-pointer rounded-2xl p-6 border-2 transition-all duration-300 ${
                    selectedPlan === 'mensuel'
                      ? 'border-gold bg-gold/10 shadow-lg shadow-gold/20'
                      : 'border-zinc-700 bg-zinc-800/30 hover:border-gold/50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-2xl">📅</span>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                      selectedPlan === 'mensuel' ? 'border-gold bg-gold' : 'border-zinc-600'
                    }`}>
                      {selectedPlan === 'mensuel' && <div className="w-2 h-2 rounded-full bg-black" />}
                    </div>
                  </div>
                  <h3 className="text-gold font-bold text-lg mb-1">Pack Mensuel</h3>
                  <p className="text-zinc-400 text-sm leading-relaxed">Accès complet · Support 24/7 · 30 jours</p>
                </div>

                {/* Pack Annuel */}
                <div
                  onClick={() => setSelectedPlan('annuel')}
                  className={`cursor-pointer rounded-2xl p-6 border-2 transition-all duration-300 relative overflow-hidden ${
                    selectedPlan === 'annuel'
                      ? 'border-gold bg-gold/10 shadow-lg shadow-gold/20'
                      : 'border-zinc-700 bg-zinc-800/30 hover:border-gold/50'
                  }`}
                >
                  <div className="absolute top-3 right-3 bg-gold text-black text-xs font-bold px-2 py-0.5 rounded-full">
                    {lang === 'ar' ? 'وفّر 20%' : 'Économisez 20%'}
                  </div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-2xl">👑</span>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                      selectedPlan === 'annuel' ? 'border-gold bg-gold' : 'border-zinc-600'
                    }`}>
                      {selectedPlan === 'annuel' && <div className="w-2 h-2 rounded-full bg-black" />}
                    </div>
                  </div>
                  <h3 className="text-gold font-bold text-lg mb-1">Pack Annuel</h3>
                  <p className="text-zinc-400 text-sm leading-relaxed">Le meilleur choix pour votre salon · 365 jours</p>
                </div>
              </div>
            </div>

            {/* Méthode de Paiement */}
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                {lang === 'ar' ? 'كيف تريد الدفع؟' : 'Comment souhaitez-vous régler votre abonnement ?'} <span className="text-red-500">*</span>
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full px-4 py-3 bg-zinc-800/50 border border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold transition-all text-white appearance-none cursor-pointer"
              >
                <option value="" disabled className="bg-zinc-900">
                  {lang === 'ar' ? '— اختر طريقة الدفع —' : '— Choisir une méthode —'}
                </option>
                <option value="Wafacash" className="bg-zinc-900">💳 Wafacash</option>
                <option value="Baridimob / Poste" className="bg-zinc-900">📮 Baridimob / Poste</option>
                <option value="Cash (Direct)" className="bg-zinc-900">💵 Cash (Direct)</option>
              </select>
              {paymentMethod && (
                <p className="text-xs text-zinc-500 mt-2">
                  {lang === 'ar'
                    ? 'سيتم التواصل معك لتأكيد الدفع وتفعيل حسابك.'
                    : "L'admin vous contactera pour confirmer le paiement et activer votre compte."}
                </p>
              )}
            </div>

            <motion.button
              type="submit"
              disabled={isSubmitting}
              whileHover={{ scale: isSubmitting ? 1 : 1.02 }}
              whileTap={{ scale: isSubmitting ? 1 : 0.98 }}
              className={`w-full bg-gold hover:bg-gold/90 text-black font-bold py-4 px-4 rounded-xl transition-all duration-300 shadow-lg hover:shadow-gold/50 ${
                isSubmitting ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {isSubmitting ? t.uploading : t.signup}
            </motion.button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-zinc-400 text-sm">
              {t.alreadyAccount}{" "}
              <a href="/auth/login" className="text-gold hover:underline">
                {t.login}
              </a>
            </p>
          </div>

          <div className="mt-8 pt-6 border-t border-zinc-800">
            <a
              href="/"
              className="block text-center text-zinc-400 hover:text-gold transition-colors duration-300"
            >
              {t.backLogin}
            </a>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

