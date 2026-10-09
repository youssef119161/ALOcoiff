"use client";

import { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { coiffeurDB, portfolioDB, isSupabaseConfigured, supabase } from "../../lib/supabase";

// Centralized storage utility
const storage = {
  save: (key: string, value: any) => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch (e) {
        console.error(`Failed to save ${key}:`, e);
      }
    }
  },
  load: (key: string) => {
    if (typeof window !== 'undefined') {
      const item = localStorage.getItem(key);
      if (!item) return null;
      
      try {
        // Vérifier si c'est une URL avant de parser
        const trimmedItem = item.trim();
        if (trimmedItem.startsWith('http')) {
          return trimmedItem;
        }
        
        // Sinon, tenter de parser le JSON
        return JSON.parse(item);
      } catch (e) {
        // En cas d'erreur de parsing, retourner l'item brut
        return item;
      }
    }
    return null;
  },
  remove: (key: string) => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(key);
      } catch (e) {
        console.error(`Failed to remove ${key}:`, e);
      }
    }
  }
};

export interface Coiffeur {
  id: string;
  name: string;
  nameAr: string;
  email: string;
  password: string;
  specialty: string;
  specialtyAr: string;
  video: string;
  avatar?: string;
  portfolio: string[];
}

interface AuthContextType {
  currentUser: Coiffeur | null;
  coiffeurs: Coiffeur[];
  isLoading: boolean;
  login: (email: string, password: string) => boolean;
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string; userId?: string }>;
  logout: () => void;
  updateProfile: (id: string, updates: Partial<Coiffeur>) => Promise<void>;
  updateVideo: (id: string, video: string) => Promise<void>;
  updateAvatar: (id: string, avatar: string) => Promise<void>;
  addPortfolioImage: (id: string, image: string) => Promise<void>;
  removePortfolioImage: (id: string, image: string) => Promise<void>;
  refreshFromDB: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Initial coiffeurs data (fallback)
const initialCoiffeurs: Coiffeur[] = [
  {
    id: "raed",
    name: "Raed",
    nameAr: "رائد",
    email: "raed@gmail.com",
    password: "raed",
    specialty: "Coupe & Style Expert",
    specialtyAr: "خبير القص والتصفيف",
    video: "https://assets.mixkit.co/videos/preview/mixkit-barber-cutting-hair-4058-large.mp4",
    portfolio: [
      "https://images.unsplash.com/photo-1622286342621-4bd786c2447c?w=800",
      "https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=800",
      "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=800",
    ],
  },
  {
    id: "achref",
    name: "Achref",
    nameAr: "أشرف",
    email: "achref@gmail.com",
    password: "achref",
    specialty: "Barbe & Rasage Traditionnel",
    specialtyAr: "اللحية والحلاقة التقليدية",
    video: "https://assets.mixkit.co/videos/preview/mixkit-man-getting-a-haircut-4056-large.mp4",
    portfolio: [
      "https://images.unsplash.com/photo-1605497788044-5a32c7078486?w=800",
      "https://images.unsplash.com/photo-1621607512214-68297480165e?w=800",
      "https://images.unsplash.com/photo-1599351431202-1e0f0137899a?w=800",
    ],
  },
  {
    id: "ibrahim",
    name: "Ibrahim",
    nameAr: "إبراهيم",
    email: "ibrahim@gmail.com",
    password: "ibrahim",
    specialty: "Coloration & Styling Moderne",
    specialtyAr: "التلوين والتصفيف الحديث",
    video: "https://assets.mixkit.co/videos/preview/mixkit-barber-spraying-water-on-hair-4060-large.mp4",
    portfolio: [
      "https://images.unsplash.com/photo-1620331311520-246422fd82f9?w=800",
      "https://images.unsplash.com/photo-1633681926022-84c23e8cb2d6?w=800",
      "https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=800",
    ],
  },
];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<Coiffeur | null>(null);
  const [coiffeurs, setCoiffeurs] = useState<Coiffeur[]>(initialCoiffeurs);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Refresh data from Supabase
  const refreshFromDB = async () => {
    if (!isSupabaseConfigured()) {
      return;
    }

    try {
      const dbCoiffeurs = await coiffeurDB.getAll();
      
      if (dbCoiffeurs.length > 0) {
        // Convert DB format to app format
        const formattedCoiffeurs = await Promise.all(
          dbCoiffeurs.map(async (db) => {
            const portfolio = await portfolioDB.getByCoiffeur(db.id);
            
            // Get video from DB or localStorage
            const dbVideo = db.video_url || '';
            const localVideo = storage.load(`${db.id}_video_url`);
            const finalVideo = dbVideo || localVideo || '';
            
            // Save to localStorage if we got it from DB
            if (dbVideo && dbVideo !== localVideo) {
              storage.save(`${db.id}_video_url`, dbVideo);
            }
            
            // Get avatar from DB or localStorage
            const dbAvatar = db.avatar_url || '';
            const localAvatar = storage.load(`${db.id}_avatar_url`);
            const finalAvatar = dbAvatar || localAvatar || '';
            
            // Save to localStorage if we got it from DB
            if (dbAvatar && dbAvatar !== localAvatar) {
              storage.save(`${db.id}_avatar_url`, dbAvatar);
            }
            
            return {
              id: db.id,
              name: db.name,
              nameAr: db.name_ar,
              email: db.email,
              password: db.password,
              specialty: db.specialty,
              specialtyAr: db.specialty_ar,
              video: finalVideo,
              avatar: finalAvatar,
              portfolio: portfolio,
            };
          })
        );
        
        setCoiffeurs(formattedCoiffeurs);
        storage.save("coiffeurs", formattedCoiffeurs);
      }
    } catch (error) {
      console.error('Error refreshing from DB:', error);
    }
  };

  // Hydrate from localStorage after mount
  useEffect(() => {
    const initAuth = async () => {
      if (typeof window !== 'undefined') {
        // Check Supabase configuration
        const supabaseConfigured = isSupabaseConfigured();
        console.log('🔧 Configuration Supabase:', supabaseConfigured ? '✅ Connecté' : '⚠️ Non configuré');
        
        const savedUser = storage.load("currentUser");
        if (savedUser) {
          setCurrentUser(savedUser);
        }

        const savedCoiffeurs = storage.load("coiffeurs");
        if (savedCoiffeurs) {
          // Restaurer les vidéos individuelles depuis localStorage
          const coiffeursWithVideos = savedCoiffeurs.map((c: Coiffeur) => {
            const savedVideo = storage.load(`${c.id}_video_url`);
            if (savedVideo) {
              console.log(`🎥 Vidéo restaurée pour ${c.id}:`, savedVideo);
              return { ...c, video: savedVideo };
            }
            return c;
          });
          
          console.log('✅ Coiffeurs chargés depuis localStorage');
          setCoiffeurs(coiffeursWithVideos);
        }
        
        // Always try to refresh from Supabase to get latest videos
        if (supabaseConfigured) {
          await refreshFromDB();
        }
        
        setIsHydrated(true);
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  // Save coiffeurs to localStorage whenever they change
  useEffect(() => {
    if (typeof window !== 'undefined' && isHydrated) {
      storage.save("coiffeurs", coiffeurs);
    }
  }, [coiffeurs, isHydrated]);

  const login = (email: string, password: string): boolean => {
    const user = coiffeurs.find(
      (c) => c.email === email && c.password === password
    );
    if (user) {
      setCurrentUser(user);
      storage.save("currentUser", user);
      return true;
    }
    return false;
  };

  const signIn = async (email: string, password: string): Promise<{ success: boolean; error?: string; userId?: string }> => {
    try {
      // Si Supabase n'est pas configuré, utiliser l'authentification locale
      if (!supabase) {
        console.warn('⚠️ Supabase non configuré, utilisation de l\'authentification locale');
        const success = login(email, password);
        if (success) {
          const userId = email.split("@")[0];
          // Redirection forcée pour briser la boucle
          if (typeof window !== 'undefined') {
            window.location.href = `/admin/${userId}/profile`;
          }
          return { success: true, userId };
        }
        return { success: false, error: 'Email ou mot de passe incorrect' };
      }

      // Authentification avec Supabase
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.warn('⚠️ Erreur d\'authentification Supabase:', error.message);
        // Fallback vers authentification locale
        const localSuccess = login(email, password);
        if (localSuccess) {
          const userId = email.split("@")[0];
          // Redirection forcée pour briser la boucle
          if (typeof window !== 'undefined') {
            window.location.href = `/admin/${userId}/profile`;
          }
          return { success: true, userId };
        }
        return { success: false, error: error.message };
      }

      if (data.user && data.session) {
        // Lire le profil directement depuis Supabase pour avoir le rôle exact
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('id, name, name_ar, email, specialty, specialty_ar, video_url, role')
          .eq('id', data.user.id)
          .single();

        console.log('📋 Profil récupéré:', profile, '| Erreur:', profileError);

        if (profile) {
          const user: Coiffeur = {
            id: profile.id,
            name: profile.name,
            nameAr: profile.name_ar,
            email: profile.email,
            password: '',
            specialty: profile.specialty,
            specialtyAr: profile.specialty_ar,
            video: profile.video_url || '',
            portfolio: await portfolioDB.getByCoiffeur(profile.id),
          };

          setCurrentUser(user);
          storage.save("currentUser", user);

          console.log('✅ Authentification réussie pour:', user.name, '| rôle:', profile.role);

          // Redirection stricte selon le rôle — aucun email hardcodé
          if (profile.role === 'admin') {
            console.log('🔑 Rôle admin détecté → redirection /admin/dashboard');
            window.location.replace('/admin/dashboard');
          } else {
            window.location.replace(`/admin/${profile.name.toLowerCase()}/profile`);
          }

          return { success: true, userId: profile.name?.toLowerCase() || profile.id };
        } else {
          // Profil introuvable dans profiles → déconnecter proprement
          console.warn('⚠️ Profil non trouvé dans Supabase pour:', data.user.id);
          await supabase.auth.signOut();
          return { success: false, error: 'Profil utilisateur non trouvé. Contactez l\'administrateur.' };
        }
      }

      return { success: false, error: 'Erreur d\'authentification' };
    } catch (error) {
      console.warn('⚠️ Exception lors de l\'authentification:', error);
      // Fallback vers authentification locale en cas d'exception
      const localSuccess = login(email, password);
      if (localSuccess) {
        const userId = email.split("@")[0];
        // Redirection forcée pour briser la boucle
        if (typeof window !== 'undefined') {
          window.location.href = `/admin/${userId}/profile`;
        }
        return { success: true, userId };
      }
      return { success: false, error: 'Erreur de connexion' };
    }
  };

  const logout = () => {
    setCurrentUser(null);
    storage.remove("currentUser");
    
    // Déconnexion de Supabase si configuré
    if (supabase) {
      supabase.auth.signOut().catch(err => console.warn('⚠️ Erreur de déconnexion:', err));
    }
  };

  const updateProfile = async (id: string, updates: Partial<Coiffeur>) => {
    // Update in Supabase if configured
    if (isSupabaseConfigured()) {
      const dbUpdates: any = {};
      if (updates.email) dbUpdates.email = updates.email;
      if (updates.specialty) dbUpdates.specialty = updates.specialty;
      if (updates.specialtyAr) dbUpdates.specialty_ar = updates.specialtyAr;
      if (updates.password) dbUpdates.password = updates.password;
      
      await coiffeurDB.update(id, dbUpdates);
    }

    // Update local state
    setCoiffeurs((prev) => {
      const updated = prev.map((c) => (c.id === id ? { ...c, ...updates } : c));
      return updated;
    });
    
    if (currentUser?.id === id) {
      const updatedUser = { ...currentUser, ...updates };
      setCurrentUser(updatedUser);
      storage.save("currentUser", updatedUser);
    }
  };

  const updateVideo = async (id: string, video: string) => {
    console.log('🎥 Mise à jour de la vidéo pour:', id, 'URL:', video);
    
    // FORCE localStorage FIRST - garantit la persistence immédiate
    storage.save(`${id}_video_url`, video);
    console.log('💾 Vidéo sauvegardée dans localStorage:', `${id}_video_url`);
    
    // Try to save to Supabase if configured
    if (isSupabaseConfigured()) {
      try {
        const success = await coiffeurDB.updateVideo(id, video);
        if (success) {
          console.log('✅ Vidéo synchronisée avec Supabase');
        } else {
          console.warn('⚠️ Échec de synchronisation Supabase, localStorage utilisé');
        }
      } catch (error) {
        console.error('❌ Erreur Supabase:', error);
      }
    }
    
    // Update local state directly (without calling updateProfile to avoid redundancy)
    setCoiffeurs((prev) => {
      const updated = prev.map((c) => (c.id === id ? { ...c, video } : c));
      return updated;
    });
    
    if (currentUser?.id === id) {
      const updatedUser = { ...currentUser, video };
      setCurrentUser(updatedUser);
      storage.save("currentUser", updatedUser);
    }
  };

  const updateAvatar = async (id: string, avatar: string) => {
    console.log('🖼️ Mise à jour de l\'avatar pour:', id, 'URL:', avatar);
    
    // FORCE localStorage FIRST - garantit la persistence immédiate
    storage.save(`${id}_avatar_url`, avatar);
    console.log('💾 Avatar sauvegardé dans localStorage:', `${id}_avatar_url`);
    
    // Try to save to Supabase if configured
    if (isSupabaseConfigured()) {
      try {
        const success = await coiffeurDB.updateAvatar(id, avatar);
        if (success) {
          console.log('✅ Avatar synchronisé avec Supabase');
        } else {
          console.warn('⚠️ Échec de synchronisation Supabase, localStorage utilisé');
        }
      } catch (error) {
        console.error('❌ Erreur Supabase:', error);
      }
    }
    
    // Update local state
    setCoiffeurs((prev) => {
      const updated = prev.map((c) => (c.id === id ? { ...c, avatar } : c));
      return updated;
    });
    
    if (currentUser?.id === id) {
      const updatedUser = { ...currentUser, avatar };
      setCurrentUser(updatedUser);
      storage.save("currentUser", updatedUser);
    }
  };

  const addPortfolioImage = async (id: string, image: string) => {
    // Save to Supabase if configured
    if (isSupabaseConfigured()) {
      await portfolioDB.add(id, image);
    }
    
    setCoiffeurs((prev) => {
      const updated = prev.map((c) =>
        c.id === id ? { ...c, portfolio: [...c.portfolio, image] } : c
      );
      return updated;
    });
    
    if (currentUser?.id === id) {
      const updatedUser = {
        ...currentUser,
        portfolio: [...currentUser.portfolio, image],
      };
      setCurrentUser(updatedUser);
      storage.save("currentUser", updatedUser);
    }
  };

  const removePortfolioImage = async (id: string, image: string) => {
    // Remove from Supabase if configured
    if (isSupabaseConfigured()) {
      await portfolioDB.remove(id, image);
    }
    
    setCoiffeurs((prev) => {
      const updated = prev.map((c) =>
        c.id === id
          ? { ...c, portfolio: c.portfolio.filter((img) => img !== image) }
          : c
      );
      return updated;
    });
    
    if (currentUser?.id === id) {
      const updatedUser = {
        ...currentUser,
        portfolio: currentUser.portfolio.filter((img) => img !== image),
      };
      setCurrentUser(updatedUser);
      storage.save("currentUser", updatedUser);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        coiffeurs,
        isLoading,
        login,
        signIn,
        logout,
        updateProfile,
        updateVideo,
        updateAvatar,
        addPortfolioImage,
        removePortfolioImage,
        refreshFromDB,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
