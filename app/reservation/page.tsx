"use client";

import { motion } from "framer-motion";
import { useState, useEffect, Suspense } from "react";
import { useBooking } from "../context/BookingContext";
import { useSearchParams, useRouter } from "next/navigation";
import { clientDB, supabase } from "../../lib/supabase";
import type { FormEvent } from "react";

type Language = "fr" | "ar";

const translations = {
  fr: {
    title: "Réservation",
    subtitle: "Planifiez votre rendez-vous",
    services: "Services",
    selectService: "Sélectionnez un service",
    selectDate: "Choisissez une date",
    selectTime: "Choisissez un horaire",
    personalInfo: "Informations personnelles",
    fullName: "Nom complet",
    phone: "Numéro de téléphone",
    confirmButton: "Confirmer la réservation",
    duration: "Durée",
    price: "Prix",
    available: "Disponible",
    booked: "Réservé",
    portfolio: "Réalisations de",
    portfolioSubtitle: "Découvrez mes meilleures créations",
  },
  ar: {
    title: "الحجز",
    subtitle: "حدد موعدك",
    services: "الخدمات",
    selectService: "اختر خدمة",
    selectDate: "اختر التاريخ",
    selectTime: "اختر الوقت",
    personalInfo: "المعلومات الشخصية",
    fullName: "الاسم الكامل",
    phone: "رقم الهاتف",
    confirmButton: "تأكيد الحجز",
    duration: "المدة",
    price: "السعر",
    available: "متاح",
    booked: "محجوز",
    portfolio: "إنجازات",
    portfolioSubtitle: "اكتشف أفضل إبداعاتي",
  },
};

const services = [
  { id: 1, name: "Coupe Classique", nameAr: "قصة كلاسيكية", price: 30, duration: 30 },
  { id: 2, name: "Coupe + Barbe", nameAr: "قصة + لحية", price: 40, duration: 45 },
  { id: 3, name: "Barbe Seule", nameAr: "لحية فقط", price: 20, duration: 20 },
  { id: 4, name: "Coloration", nameAr: "صبغة", price: 80, duration: 90 },
  { id: 5, name: "Coupe Enfant", nameAr: "قصة أطفال", price: 25, duration: 25 },
  { id: 6, name: "Rasage Traditionnel", nameAr: "حلاقة تقليدية", price: 35, duration: 40 },
];

const timeSlots = [
  "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
  "14:00", "14:30", "15:00", "15:30", "16:00", "16:30",
  "17:00", "17:30", "18:00", "18:30",
];

export default function ReservationPage() {
  return (
    <Suspense fallback={
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-yellow-500/30 border-t-yellow-500 rounded-full animate-spin" />
      </div>
    }>
      <ReservationContent />
    </Suspense>
  );
}

function ReservationContent() {
  const [lang, setLang] = useState<Language>("fr");
  const [selectedService, setSelectedService] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [comment, setComment] = useState("");
  const [selectedCoiffeurId, setSelectedCoiffeurId] = useState<string>("");
  const [selectedCoiffeur, setSelectedCoiffeur] = useState<any>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [bookedSlots, setBookedSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [clientId, setClientId] = useState<string>("");

  const { addBooking } = useBooking();
  const searchParams = useSearchParams();
  const router = useRouter();

  // Read coiffeur ID from URL, check auth + existing booking
  useEffect(() => {
    const id = searchParams.get("coiffeur") || searchParams.get("id");
    if (!id) {
      router.replace("/coiffeurs");
      return;
    }
    setSelectedCoiffeurId(id);

    if (!supabase) return;

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user) {
        // Non connecté → retour à /coiffeurs pour se connecter
        router.replace("/coiffeurs");
        return;
      }

      const uid = session.user.id;
      setClientId(uid);

      // Pré-remplir le nom depuis Google
      if (session.user.user_metadata?.full_name) {
        setFullName(session.user.user_metadata.full_name);
      }

      // Vérifier si une réservation active existe déjà
      const { data: existing } = await supabase!
        .from('bookings')
        .select('id')
        .eq('client_id', uid)
        .in('status', ['pending', 'accepted'])
        .limit(1);

      if (existing && existing.length > 0) {
        // Déjà une réservation active → bloquer et renvoyer vers /coiffeurs
        router.replace("/coiffeurs");
        return;
      }

      // Charger le profil du coiffeur
      const { data } = await supabase!
        .from("profiles")
        .select("id, name, name_ar, specialty, specialty_ar, avatar_url, video_url")
        .eq("id", id)
        .single();
      if (data) setSelectedCoiffeur(data);
    });
  }, [searchParams, router]);
  
  // Load booked slots directly from Supabase (pending + accepted)
  useEffect(() => {
    if (!selectedCoiffeurId || !selectedDate || !supabase) {
      setBookedSlots([]);
      return;
    }

    let mounted = true;

    const loadSlots = async () => {
      setLoadingSlots(true);
      try {
        const { data, error } = await supabase!
          .from("bookings")
          .select("booking_time")
          .eq("coiffeur_id", selectedCoiffeurId)
          .eq("booking_date", selectedDate)
          .in("status", ["pending", "accepted"]);

        if (!mounted) return;

        if (error) {
          console.error("Erreur créneaux — message:", error.message, "| code:", error.code, "| details:", error.details);
          // Ne pas planter la page — afficher 0 créneaux bloqués
          setBookedSlots([]);
        } else {
          const times = (data || []).map((b: any) => {
            // booking_time peut être "09:00:00" (TIME postgres) ou "09:00" — normaliser
            const t: string = b.booking_time || "";
            return t.length === 8 ? t.substring(0, 5) : t;
          });
          console.log("✅ Créneaux bloqués:", times);
          setBookedSlots(times);
        }
      } catch (e: any) {
        if (!mounted) return;
        console.error("Exception créneaux:", e?.message || e);
        setBookedSlots([]);
      } finally {
        if (mounted) setLoadingSlots(false);
      }
    };

    loadSlots();
    const interval = setInterval(loadSlots, 10000);
    return () => { mounted = false; clearInterval(interval); };
  }, [selectedCoiffeurId, selectedDate]);

  // (coiffeur loaded in main useEffect above)

  const t = translations[lang];
  const isRTL = lang === "ar";
  const fontClass = lang === "ar" ? "font-cairo" : "font-serif";

  const toggleLanguage = () => {
    setLang(lang === "fr" ? "ar" : "fr");
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedService || !selectedDate || !selectedTime || !fullName || !phone || !selectedCoiffeurId || !selectedCoiffeur) return;

    const service = services.find(s => s.id === selectedService);
    if (!service) return;

    // Vérifier conflit en temps réel avant d'insérer
    if (supabase) {
      const { data: conflict } = await supabase
        .from("bookings")
        .select("id")
        .eq("coiffeur_id", selectedCoiffeurId)
        .eq("booking_date", selectedDate)
        .eq("booking_time", selectedTime)
        .in("status", ["pending", "accepted"])
        .limit(1);

      if (conflict && conflict.length > 0) {
        alert(lang === "ar"
          ? "هذا الوقت تم حجزه للتو، يرجى اختيار وقت آخر"
          : "Ce créneau vient d'être réservé, veuillez en choisir un autre");
        // Rafraîchir les créneaux
        const { data: fresh } = await supabase
          .from("bookings")
          .select("booking_time")
          .eq("coiffeur_id", selectedCoiffeurId)
          .eq("booking_date", selectedDate)
          .in("status", ["pending", "accepted"]);
        setBookedSlots((fresh || []).map((b: any) => {
          const t: string = b.booking_time || "";
          return t.length === 8 ? t.substring(0, 5) : t;
        }));
        setSelectedTime("");
        return;
      }
    }

    try {
      await clientDB.addOrUpdate(
        `${fullName.toLowerCase().replace(/\s+/g, '.')}@client.local`,
        fullName,
        phone
      );
    } catch (error) {
      console.warn('⚠️ Erreur enregistrement client:', error);
    }

    addBooking({
      clientName: fullName,
      phone: phone,
      service: service.name,
      serviceAr: service.nameAr,
      date: selectedDate,
      time: selectedTime,
      coiffeur: selectedCoiffeur.name || '',
      coiffeurId: selectedCoiffeurId,
      comment: comment,
      clientId: clientId || undefined,
    });

    setShowSuccessModal(true);
  };

  // Generate next 14 days
  const generateDates = () => {
    const dates = [];
    for (let i = 0; i < 14; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      dates.push(date);
    }
    return dates;
  };

  const dates = generateDates();

  return (
    <div
      className={`min-h-screen p-8 ${fontClass}`}
      dir={isRTL ? "rtl" : "ltr"}
    >
      {/* Language Toggle */}
      <button
        onClick={toggleLanguage}
        className="fixed top-8 right-8 z-50 px-4 py-2 bg-gold/10 hover:bg-gold/20 text-gold border border-gold/30 rounded-lg transition-all duration-300 font-medium"
      >
        {lang === "fr" ? "العربية" : "Français"}
      </button>

      {/* Success Modal */}
      {showSuccessModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xl flex items-center justify-center p-6"
          onClick={() => {
            setShowSuccessModal(false);
            setSelectedService(null);
            setSelectedDate("");
            setSelectedTime("");
            setFullName("");
            setPhone("");
            setComment("");
          }}
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0, y: 30 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={{ type: "spring", damping: 20, stiffness: 300 }}
            onClick={e => e.stopPropagation()}
            className="bg-zinc-900 border border-gold/30 rounded-3xl p-10 max-w-md w-full text-center shadow-2xl shadow-gold/20 relative overflow-hidden"
          >
            {/* Gold glow */}
            <div className="absolute inset-0 bg-gradient-to-b from-gold/5 to-transparent pointer-events-none" />

            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 400 }}
              className="w-20 h-20 bg-gold/20 border-2 border-gold rounded-full flex items-center justify-center mx-auto mb-6"
            >
              <svg className="w-10 h-10 text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </motion.div>

            <h2 className="text-2xl font-bold text-gold mb-2">
              {lang === "ar" ? "تم إرسال الحجز!" : "Rendez-vous envoyé !"}
            </h2>
            <p className="text-zinc-400 text-sm mb-6 leading-relaxed">
              {lang === "ar"
                ? `تم إرسال حجزك إلى ${selectedCoiffeur?.name_ar || selectedCoiffeur?.name || ''}. ستتلقى إشعارًا بمجرد تأكيده.`
                : `Rendez-vous envoyé à ${selectedCoiffeur?.name || ''}. Vous recevrez une notification dès qu'il aura validé.`}
            </p>

            {/* Recap */}
            <div className="bg-zinc-800/60 border border-zinc-700 rounded-2xl p-5 text-left space-y-3 mb-6">
              {[
                { icon: "👤", label: lang === "ar" ? "الاسم" : "Client", value: fullName },
                { icon: "📅", label: lang === "ar" ? "التاريخ" : "Date", value: new Date(selectedDate).toLocaleDateString(lang === "ar" ? "ar-TN" : "fr-FR", { weekday: "long", day: "numeric", month: "long" }) },
                { icon: "🕐", label: lang === "ar" ? "الوقت" : "Heure", value: selectedTime },
                { icon: "✂️", label: lang === "ar" ? "الخدمة" : "Service", value: lang === "ar" ? services.find(s => s.id === selectedService)?.nameAr : services.find(s => s.id === selectedService)?.name },
              ].map(row => (
                <div key={row.label} className="flex items-center gap-3">
                  <span className="text-lg">{row.icon}</span>
                  <span className="text-zinc-500 text-sm w-16 shrink-0">{row.label}</span>
                  <span className="text-white text-sm font-medium">{row.value}</span>
                </div>
              ))}
              {comment && (
                <div className="flex items-start gap-3">
                  <span className="text-lg">💬</span>
                  <span className="text-zinc-500 text-sm w-16 shrink-0">{lang === "ar" ? "ملاحظة" : "Note"}</span>
                  <span className="text-white text-sm">{comment}</span>
                </div>
              )}
            </div>

            <button
              onClick={() => {
                setShowSuccessModal(false);
                setSelectedService(null);
                setSelectedDate("");
                setSelectedTime("");
                setFullName("");
                setPhone("");
                setComment("");
                window.location.href = "/";
              }}
              className="w-full bg-gold hover:bg-gold/90 text-black font-bold py-3 rounded-xl transition-all"
            >
              {lang === "ar" ? "حسنًا، شكرًا!" : "Parfait, merci !"}
            </button>
          </motion.div>
        </motion.div>
      )}

      {/* Header */}
      <div className={`text-center mb-12 ${isRTL ? "text-right" : "text-left"} max-w-6xl mx-auto`}>
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <h2 className="text-gold text-sm tracking-[0.3em] uppercase mb-2">
            RAED COIF
          </h2>
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-4">
            {t.title}
          </h1>
          <p className="text-zinc-400 text-lg">{t.subtitle}</p>
        </motion.div>
      </div>

      <div className="max-w-6xl mx-auto">
        {/* Portfolio Section - BEFORE Services */}
        {selectedCoiffeur && selectedCoiffeur?.portfolio && selectedCoiffeur.portfolio.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mb-16"
          >
            <div className={`text-center mb-8 ${isRTL ? "text-right" : "text-left"}`}>
              <h2 className="text-4xl font-bold text-gold mb-3">
                {t.portfolio} {lang === "ar" ? selectedCoiffeur?.nameAr : selectedCoiffeur?.name}
              </h2>
              <p className="text-zinc-400 text-lg leading-luxury">{t.portfolioSubtitle}</p>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
              {selectedCoiffeur.portfolio.map((image: string, index: number) => (
                <motion.div
                  key={`portfolio-${selectedCoiffeur.id}-${index}-${image.substring(0, 30)}`}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.1 * index }}
                  whileHover={{ scale: 1.05 }}
                  onClick={() => setLightboxImage(image)}
                  className="relative group cursor-pointer overflow-hidden rounded-2xl border-2 border-zinc-800 hover:border-gold/50 transition-all duration-300"
                >
                  <img
                    src={image}
                    alt={`Portfolio ${index + 1}`}
                    className="w-full h-64 object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-center pb-4">
                    <svg className="w-8 h-8 text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                    </svg>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Golden Separator */}
            <div className="h-px bg-gradient-to-r from-transparent via-gold to-transparent"></div>
          </motion.div>
        )}

        {/* Services Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-12"
        >
          {selectedCoiffeur && (
            <div className="mb-6 p-4 bg-gold/10 border border-gold/30 rounded-2xl flex items-center gap-4">
              {selectedCoiffeur.avatar_url && (
                <img src={selectedCoiffeur.avatar_url} alt="" className="w-12 h-12 rounded-full object-cover border-2 border-gold/40" />
              )}
              <p className="text-gold">
                {lang === "ar" ? "الحجز مع: " : "Réservation avec: "}
                <span className="font-bold">
                  {lang === "ar" ? (selectedCoiffeur.name_ar || selectedCoiffeur.name) : selectedCoiffeur.name}
                </span>
              </p>
            </div>
          )}
          <h2 className={`text-2xl font-bold text-gold mb-6 ${isRTL ? "text-right" : "text-left"}`}>
            {t.services}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {services.map((service) => (
              <motion.button
                key={service.id}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setSelectedService(service.id)}
                className={`p-6 rounded-xl border-2 transition-all duration-300 ${
                  selectedService === service.id
                    ? "bg-gold/20 border-gold shadow-lg shadow-gold/30"
                    : "bg-zinc-900/50 border-zinc-800 hover:border-gold/50"
                }`}
              >
                <div className={`${isRTL ? "text-right" : "text-left"}`}>
                  <h3 className="text-xl font-semibold text-white mb-2">
                    {lang === "ar" ? service.nameAr : service.name}
                  </h3>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-zinc-400">
                      {t.duration}: {service.duration} min
                    </span>
                    <span className="text-gold font-bold text-lg">
                      {service.price} DT
                    </span>
                  </div>
                </div>
              </motion.button>
            ))}
          </div>
        </motion.div>

        {/* Date Selection */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mb-12"
        >
          <h2 className={`text-2xl font-bold text-gold mb-6 ${isRTL ? "text-right" : "text-left"}`}>
            {t.selectDate}
          </h2>
          <div className="grid grid-cols-7 gap-3">
            {dates.map((date) => {
              const dateStr = date.toISOString().split("T")[0];
              const dayName = date.toLocaleDateString(lang === "ar" ? "ar-TN" : "fr-FR", { weekday: "short" });
              const dayNum = date.getDate();
              const monthName = date.toLocaleDateString(lang === "ar" ? "ar-TN" : "fr-FR", { month: "short" });

              return (
                <motion.button
                  key={dateStr}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setSelectedDate(dateStr)}
                  className={`p-4 rounded-xl border-2 transition-all duration-300 ${
                    selectedDate === dateStr
                      ? "bg-gold text-black border-gold shadow-lg shadow-gold/30"
                      : "bg-zinc-900/50 border-zinc-800 hover:border-gold/50 text-white"
                  }`}
                >
                  <div className="text-center">
                    <div className="text-xs mb-1 opacity-70">{dayName}</div>
                    <div className="text-2xl font-bold">{dayNum}</div>
                    <div className="text-xs mt-1 opacity-70">{monthName}</div>
                  </div>
                </motion.button>
              );
            })}
          </div>
        </motion.div>

        {/* Time Slots */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: selectedDate ? 0.6 : 0.8 }}
          className="mb-12"
        >
          <h2 className={`text-2xl font-bold text-gold mb-6 ${isRTL ? "text-right" : "text-left"}`}>
            {t.selectTime}
          </h2>
          
          {loadingSlots && (
            <div className="mb-4 p-3 bg-gold/10 border border-gold/30 rounded-xl text-gold text-center text-sm">
              🔄 Chargement des créneaux disponibles...
            </div>
          )}
          
          {bookedSlots.length > 0 && !loadingSlots && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-center text-sm">
              ⚠️ {bookedSlots.length} créneau{bookedSlots.length > 1 ? 'x' : ''} déjà réservé{bookedSlots.length > 1 ? 's' : ''} pour cette date
            </div>
          )}
          
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
            className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3"
          >
            {timeSlots.map((time, index) => {
              const isBooked = bookedSlots.includes(time);
              const isSelected = selectedTime === time;

              return (
                <motion.button
                  key={time}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                  whileHover={!isBooked ? { scale: 1.05, boxShadow: "0 0 20px rgba(212, 175, 55, 0.4)" } : {}}
                  whileTap={!isBooked ? { scale: 0.95 } : {}}
                  onClick={() => {
                    if (isBooked) {
                      console.log('⚠️ Créneau déjà réservé:', time);
                      // Afficher un message visuel au lieu d'une alerte
                      const button = document.querySelector(`[data-time="${time}"]`);
                      if (button) {
                        button.classList.add('shake-animation');
                        setTimeout(() => button.classList.remove('shake-animation'), 500);
                      }
                    } else {
                      setSelectedTime(time);
                    }
                  }}
                  disabled={isBooked}
                  data-time={time}
                  className={`time-slot-button p-4 rounded-lg font-semibold transition-all duration-300 relative ${
                    isBooked
                      ? "time-slot-booked bg-red-600/20 text-red-400/60 cursor-not-allowed border-2 border-red-600/30"
                      : isSelected
                      ? "bg-gold text-black border-2 border-gold shadow-lg shadow-gold/30"
                      : "bg-zinc-900/80 text-white hover:bg-gold/20 hover:border-gold hover:shadow-lg hover:shadow-gold/20 border-2 border-zinc-700 hover:text-gold"
                  }`}
                  title={isBooked ? (lang === "ar" ? "هذا الوقت محجوز بالفعل" : "Ce créneau est déjà réservé") : ""}
                >
                  {time}
                  {isBooked && (
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                  )}
                </motion.button>
              );
            })}
          </motion.div>
          
          {/* Legend */}
          <div className={`flex gap-6 mt-6 text-sm ${isRTL ? "justify-end" : "justify-start"}`}>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-white border-2 border-zinc-700 rounded"></div>
              <span className="text-zinc-400">{t.available}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-red-600 rounded"></div>
              <span className="text-zinc-400">{t.booked}</span>
            </div>
          </div>
        </motion.div>

        {/* Personal Information Form */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="mb-12"
        >
          <h2 className={`text-2xl font-bold text-gold mb-6 ${isRTL ? "text-right" : "text-left"}`}>
            {t.personalInfo}
          </h2>
          <form onSubmit={handleSubmit} className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <label htmlFor="fullName" className={`block text-sm font-medium text-zinc-300 mb-2 ${isRTL ? "text-right" : "text-left"}`}>
                  {t.fullName}
                </label>
                <input id="fullName" type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} required
                  className="w-full px-4 py-3 bg-zinc-800/50 border border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold transition-all text-white placeholder-zinc-500"
                  placeholder={t.fullName} />
              </div>
              <div>
                <label htmlFor="phone" className={`block text-sm font-medium text-zinc-300 mb-2 ${isRTL ? "text-right" : "text-left"}`}>
                  {t.phone}
                </label>
                <input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required
                  className="w-full px-4 py-3 bg-zinc-800/50 border border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold transition-all text-white placeholder-zinc-500"
                  placeholder="+216 XX XXX XXX" />
              </div>
            </div>

            {/* Comment */}
            <div className="mb-6">
              <label htmlFor="comment" className={`block text-sm font-medium text-zinc-300 mb-2 ${isRTL ? "text-right" : "text-left"}`}>
                {lang === "ar" ? "ملاحظة أو تعليق (اختياري)" : "Note ou commentaire (optionnel)"}
              </label>
              <textarea id="comment" value={comment} onChange={e => setComment(e.target.value)} rows={3}
                placeholder={lang === "ar" ? "أضف أي طلب خاص أو ملاحظة للمصفف..." : "Précisez votre demande, style souhaité..."}
                className="w-full px-4 py-3 bg-zinc-800/50 border border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold transition-all text-white placeholder-zinc-500 resize-none" />
            </div>

            <motion.button
              type="submit"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              disabled={!selectedService || !selectedDate || !selectedTime || !fullName || !phone || !selectedCoiffeurId}
              className={`w-full bg-gold hover:bg-gold/90 disabled:bg-zinc-700 disabled:cursor-not-allowed text-black disabled:text-zinc-500 font-bold py-4 px-6 rounded-xl transition-all duration-300 text-lg shadow-lg hover:shadow-gold/50 ${
                selectedService && selectedDate && selectedTime && fullName && phone && selectedCoiffeurId ? 'pulse-gold' : ''
              }`}
            >
              {t.confirmButton}
            </motion.button>
          </form>
        </motion.div>

        {/* Back Link */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="text-center"
        >
          <a
            href="/coiffeurs"
            className="inline-flex items-center gap-2 text-zinc-400 hover:text-gold transition-colors duration-300"
          >
            <svg
              className={`w-5 h-5 ${isRTL ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            <span>{lang === "ar" ? "العودة إلى الخبراء" : "Retour aux experts"}</span>
          </a>
        </motion.div>
      </div>

      {/* Lightbox Modal */}
      {lightboxImage && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setLightboxImage(null)}
          className="fixed inset-0 z-50 bg-black/95 backdrop-blur-xl flex items-center justify-center p-4"
        >
          <button
            onClick={() => setLightboxImage(null)}
            className="absolute top-8 right-8 text-white hover:text-gold transition-colors duration-300 p-3 bg-zinc-900/50 rounded-full hover:bg-zinc-800"
          >
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1 }}
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-5xl max-h-[90vh]"
          >
            <img
              src={lightboxImage}
              alt="Portfolio"
              className="w-full h-full object-contain rounded-2xl border-4 border-gold/30 shadow-2xl shadow-gold/20"
            />
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}
