"use client";

import { motion } from "framer-motion";
import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "../../../context/AuthContext";
import { uploadFile } from "../../../../lib/supabase";

type Language = "fr" | "ar";

const translations = {
  fr: {
    title: "Mon Portfolio",
    backToDashboard: "← Retour au Tableau de Bord",
    addPhoto: "Ajouter une photo de mon travail",
    dragDrop: "Glissez-déposez des images ou cliquez",
    uploading: "Téléchargement en cours...",
    success: "✓ Photo ajoutée avec succès !",
    noPhotos: "Aucune photo pour le moment",
    deleteConfirm: "Voulez-vous supprimer cette photo ?",
  },
  ar: {
    title: "معرض أعمالي",
    backToDashboard: "← العودة إلى لوحة التحكم",
    addPhoto: "إضافة صورة من أعمالي",
    dragDrop: "اسحب وأفلت الصور أو انقر",
    uploading: "جاري التحميل...",
    success: "✓ تمت إضافة الصورة بنجاح!",
    noPhotos: "لا توجد صور حتى الآن",
    deleteConfirm: "هل تريد حذف هذه الصورة؟",
  },
};

export default function PortfolioPage() {
  const [lang, setLang] = useState<Language>("fr");
  const [isLoading, setIsLoading] = useState(true);
  const { currentUser, addPortfolioImage, removePortfolioImage, isLoading: authLoading } = useAuth();
  const params = useParams();
  const router = useRouter();

  const [uploading, setUploading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const t = translations[lang];
  const isRTL = lang === "ar";
  const fontClass = lang === "ar" ? "font-cairo" : "font-serif";

  useEffect(() => {
    if (authLoading) return;

    const timer = setTimeout(() => {
      setIsLoading(false);
      if (!currentUser) {
        router.push("/");
      } else {
        const urlId = params.id as string;
        const userIdMatch = currentUser.id.toLowerCase() === urlId.toLowerCase();
        const userNameMatch = currentUser.name.toLowerCase() === urlId.toLowerCase();
        
        if (!userIdMatch && !userNameMatch) {
          router.push(`/admin/${currentUser.name.toLowerCase()}/portfolio`);
        }
      }
    }, 500);
    
    return () => clearTimeout(timer);
  }, [currentUser, params.id, router, authLoading]);

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

  if (!currentUser) return null;

  const toggleLanguage = () => setLang(lang === "fr" ? "ar" : "fr");

  const showSuccess = () => {
    setSuccessMessage(t.success);
    setTimeout(() => setSuccessMessage(""), 3000);
  };

  const handleImageDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    const imageFiles = files.filter(f => f.type.startsWith('image/'));
    for (const imageFile of imageFiles) {
      await uploadImageFile(imageFile);
    }
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      for (let i = 0; i < files.length; i++) {
        await uploadImageFile(files[i]);
      }
    }
  };

  const uploadImageFile = async (file: File) => {
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
      console.error('❌ Erreur upload:', error);
      alert(`Erreur d'upload: ${error?.message || 'Erreur inconnue'}`);
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveImage = async (image: string) => {
    if (confirm(t.deleteConfirm)) {
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
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="mb-8">
          <a 
            href={`/admin/${currentUser.id}`} 
            className="inline-flex items-center gap-3 px-6 py-3 bg-gold/10 hover:bg-gold/20 border-2 border-gold/30 hover:border-gold text-gold rounded-xl transition-all duration-300 text-lg font-semibold shadow-lg hover:shadow-gold/30"
          >
            <svg className={`w-6 h-6 ${isRTL ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
            <span>{t.backToDashboard}</span>
          </a>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-12">
          <h1 className="text-6xl font-bold text-gold mb-6">{t.title}</h1>
        </motion.div>

        {successMessage && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8 p-6 bg-green-500/20 border border-green-500/50 rounded-2xl text-green-400 text-center text-lg">
            {successMessage}
          </motion.div>
        )}

        {uploading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-8 p-6 bg-gold/20 border border-gold/50 rounded-2xl text-gold text-center text-lg">
            {t.uploading}
          </motion.div>
        )}

        <div className="bg-zinc-900/70 backdrop-blur-xl border border-gold/20 rounded-3xl p-10 mb-8">
          <h2 className="text-3xl font-bold text-white mb-6">{t.addPhoto}</h2>
          
          <div 
            onDrop={handleImageDrop} 
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }} 
            onDragLeave={() => setDragOver(false)} 
            onClick={() => imageInputRef.current?.click()} 
            className={`cursor-pointer p-12 rounded-2xl text-center transition-all duration-300 mb-6 ${dragOver ? 'bg-gold/10 border-gold' : 'bg-zinc-800/30 border-zinc-700'} border-2 border-dashed`}
          >
            <svg className="w-16 h-16 mx-auto mb-4 text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-gold text-lg mb-2">{t.dragDrop}</p>
            <p className="text-zinc-500 text-sm">JPG, PNG, WebP (Max 5MB chacune)</p>
            <input ref={imageInputRef} type="file" accept="image/*" multiple onChange={handleImageSelect} className="hidden" />
          </div>
        </div>

        <div className="bg-zinc-900/70 backdrop-blur-xl border border-gold/20 rounded-3xl p-10">
          {currentUser?.portfolio && currentUser.portfolio.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {currentUser.portfolio.map((image, index) => (
                <div key={`portfolio-${index}`} className="relative group">
                  <img src={image} alt={`Portfolio ${index + 1}`} className="w-full h-56 object-cover rounded-2xl" />
                  <button 
                    onClick={() => handleRemoveImage(image)} 
                    className="absolute top-3 right-3 bg-red-600 hover:bg-red-700 text-white p-3 rounded-xl opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <svg className="w-24 h-24 mx-auto mb-4 text-gold/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-zinc-400 text-xl">{t.noPhotos}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
