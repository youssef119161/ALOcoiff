"use client";

import { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { appointmentDB, clientDB, isSupabaseConfigured } from "../../lib/supabase";

export interface Booking {
  id: string;
  clientName: string;
  phone: string;
  service: string;
  serviceAr: string;
  date: string;
  time: string;
  status: "pending" | "accepted" | "rejected";
  coiffeur: string;
  coiffeurId: string;
  comment?: string;
  clientId?: string;
}

interface BookingContextType {
  bookings: Booking[];
  getBookedSlots: (coiffeurId: string, date: string) => Promise<string[]>;
  getCoiffeurBookings: (coiffeurId: string) => Booking[];
  getPendingCount: (coiffeurId: string) => number;
  addBooking: (booking: Omit<Booking, "id" | "status">) => Promise<void>;
  acceptBooking: (id: string) => Promise<void>;
  rejectBooking: (id: string) => void;
  deleteBooking: (id: string) => void;
}

const BookingContext = createContext<BookingContextType | undefined>(undefined);

// Initial mock data - VIDE pour démarrage propre
const initialBookings: Booking[] = [];

export function BookingProvider({ children }: { children: ReactNode }) {
  // Initialize state from localStorage or use defaults
  const [bookings, setBookings] = useState<Booking[]>(() => {
    if (typeof window !== 'undefined') {
      const savedBookings = localStorage.getItem("bookings");
      if (savedBookings) {
        try {
          const loadedBookings = JSON.parse(savedBookings);
          return loadedBookings;
        } catch (e) {
          console.error("Error loading bookings:", e);
        }
      }
    }
    return initialBookings;
  });

  // Save bookings to localStorage whenever they change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem("bookings", JSON.stringify(bookings));
      } catch (e) {
        console.error("Error saving bookings:", e);
      }
    }
  }, [bookings]);

  // Get booked slots for a specific coiffeur and date (REAL-TIME from Supabase)
  const getBookedSlots = async (coiffeurId: string, date: string): Promise<string[]> => {
    // Toujours vérifier Supabase en premier pour les créneaux en temps réel
    if (isSupabaseConfigured()) {
      try {
        const acceptedTimes = await appointmentDB.getAcceptedByCoiffeurAndDate(coiffeurId, date);
        console.log(`📅 Créneaux réservés pour ${coiffeurId} le ${date}:`, acceptedTimes);
        return acceptedTimes;
      } catch (error) {
        console.warn('⚠️ Erreur lors de la récupération des créneaux:', error);
      }
    }
    
    // Fallback vers localStorage si Supabase n'est pas disponible
    return bookings
      .filter((b) => b.coiffeurId === coiffeurId && b.date === date && b.status === "accepted")
      .map((b) => b.time);
  };

  // Get all bookings for a specific coiffeur
  const getCoiffeurBookings = (coiffeurId: string): Booking[] => {
    return bookings.filter((b) => b.coiffeurId === coiffeurId);
  };

  // Get pending bookings count for a specific coiffeur
  const getPendingCount = (coiffeurId: string): number => {
    return bookings.filter((b) => b.coiffeurId === coiffeurId && b.status === "pending").length;
  };

  const addBooking = async (booking: Omit<Booking, "id" | "status">) => {
    const newBooking: Booking = {
      ...booking,
      id: Date.now().toString(),
      status: "pending",
    };

    // Insérer directement dans Supabase avec status 'pending'
    if (isSupabaseConfigured()) {
      const { supabase } = await import("../../lib/supabase");
      if (supabase) {
        const bookingData: Record<string, unknown> = {
          coiffeur_id: booking.coiffeurId,
          client_name: booking.clientName,
          client_phone: booking.phone,
          booking_date: booking.date,
          booking_time: booking.time,
          status: "pending",
          service: booking.service || "",
          service_ar: booking.serviceAr || "",
        };
        if (booking.comment) bookingData.comment = booking.comment;
        if (booking.clientId) bookingData.client_id = booking.clientId;

        console.log("📤 Tentative d'insertion du booking...", bookingData);

        const { data, error } = await supabase
          .from("bookings")
          .insert(bookingData)
          .select();

        if (error) {
          console.error("❌ Erreur Supabase lors de l'insertion:", {
            message: error.message,
            details: error.details,
            hint: error.hint,
            code: error.code,
          });
        } else {
          console.log("✅ Booking inséré dans Supabase:", data);
          // Utiliser l'ID Supabase si disponible
          if (data && data[0]?.id) newBooking.id = data[0].id;
        }
      }
    } else {
      console.warn("⚠️ Supabase non configuré, booking sauvegardé localement uniquement");
    }

    setBookings((prev) => [...prev, newBooking]);
  };

  const acceptBooking = async (id: string) => {
    const booking = bookings.find(b => b.id === id);
    if (!booking) {
      console.error('❌ Réservation introuvable:', id);
      return;
    }
    
    console.log('📝 Tentative de sauvegarde:', {
      coiffeurId: booking.coiffeurId,
      clientName: booking.clientName,
      phone: booking.phone,
      date: booking.date,
      time: booking.time
    });
    
    // Mettre à jour l'état local IMMÉDIATEMENT pour retour visuel instantané
    setBookings((prev) =>
      prev.map((b) =>
        b.id === id ? { ...b, status: "accepted" as const } : b
      )
    );
    console.log('✅ État local mis à jour immédiatement (UI)');
    
    // Enregistrer dans Supabase en arrière-plan (sans bloquer l'UI)
    if (isSupabaseConfigured()) {
      try {
        // Créer l'appointment dans la base de données
        const success = await appointmentDB.create(
          booking.coiffeurId,
          booking.clientName,
          booking.phone,
          booking.service,
          booking.serviceAr,
          booking.date,
          booking.time,
          booking.comment,
          booking.clientId
        );
        
        if (!success) {
          console.error('❌ Échec de la sauvegarde dans Supabase - mais UI mise à jour');
          console.error('⚠️ La réservation est visible localement mais pas en base de données');
          // NE PAS revenir en arrière - garder l'UI à jour pour ne pas bloquer l'utilisateur
          return;
        }
        
        // Enregistrer le client dans la table clients
        try {
          const clientEmail = `${booking.clientName.toLowerCase().replace(/\s+/g, '.')}@client.local`;
          await clientDB.addOrUpdate(clientEmail, booking.clientName, booking.phone);
          console.log('✅ Client enregistré dans la table clients');
        } catch (clientError) {
          console.warn('⚠️ Erreur lors de l\'enregistrement du client (non bloquant):', clientError);
        }
        
        console.log('✅ Réservation acceptée et enregistrée dans Supabase');
      } catch (error: any) {
        console.error('❌ Exception complète lors de l\'enregistrement:', {
          message: error?.message,
          code: error?.code,
          details: error?.details,
          hint: error?.hint,
          stack: error?.stack,
          fullError: error
        });
        console.error('⚠️ La réservation reste visible localement malgré l\'erreur');
        // NE PAS revenir en arrière - garder l'UI à jour
        return;
      }
    } else {
      console.warn('⚠️ Supabase non configuré, sauvegarde locale uniquement');
    }
  };

  const rejectBooking = (id: string) => {
    setBookings((prev) =>
      prev.map((booking) =>
        booking.id === id ? { ...booking, status: "rejected" as const } : booking
      )
    );
  };

  const deleteBooking = (id: string) => {
    setBookings((prev) => prev.filter((b) => b.id !== id));
  };

  return (
    <BookingContext.Provider
      value={{ 
        bookings, 
        getBookedSlots,
        getCoiffeurBookings,
        getPendingCount,
        addBooking, 
        acceptBooking, 
        rejectBooking,
        deleteBooking
      }}
    >
      {children}
    </BookingContext.Provider>
  );
}

export function useBooking() {
  const context = useContext(BookingContext);
  if (context === undefined) {
    throw new Error("useBooking must be used within a BookingProvider");
  }
  return context;
}
