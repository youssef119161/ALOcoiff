import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Session stockée dans des cookies (et non le localStorage) pour que le
// middleware serveur puisse la lire. Persistante entre deux lancements du
// navigateur et rafraîchie automatiquement.
export const supabase = supabaseUrl && supabaseAnonKey && supabaseUrl !== 'your_supabase_url_here'
  ? createBrowserClient(supabaseUrl, supabaseAnonKey)
  : null;

// Check if Supabase is configured
export const isSupabaseConfigured = (): boolean => {
  const configured = supabase !== null;
  if (!configured) {
    console.warn('⚠️ Supabase non connecté : les données seront perdues au rafraîchissement.');
  }
  return configured;
};

// Database Types
export interface CoiffeurDB {
  id: string;
  name: string;
  name_ar: string;
  email: string;
  password: string;
  specialty: string;
  specialty_ar: string;
  video_url: string | null;
  avatar_url: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface PortfolioDB {
  id: string;
  coiffeur_id: string;
  image_url: string;
  created_at?: string;
}

export interface ClientDB {
  id: string;
  email: string;
  name?: string;
  phone?: string;
  created_at?: string;
}

// Coiffeur CRUD Operations
export const coiffeurDB = {
  // Get all coiffeurs
  async getAll(): Promise<CoiffeurDB[]> {
    if (!supabase) {
      console.warn('⚠️ Supabase not configured');
      return [];
    }
    
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('name');
    
    if (error) {
      console.log('ℹ️ Error fetching coiffeurs:', error);
      return [];
    }
    
    console.log('✅ Fetched coiffeurs from Supabase:', data);
    return data || [];
  },

  // Get one coiffeur by ID
  async getById(id: string): Promise<CoiffeurDB | null> {
    if (!supabase) return null;
    
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) {
      console.log('ℹ️ Error fetching coiffeur:', error);
      return null;
    }
    
    return data;
  },

  // Update coiffeur profile
  async update(id: string, updates: Partial<CoiffeurDB>): Promise<boolean> {
    if (!supabase) {
      console.warn('⚠️ Supabase not configured, skipping update');
      return false;
    }
    
    const { error } = await supabase
      .from('profiles')
      .upsert({ id, ...updates }, { onConflict: 'id' });
    
    if (error) {
      console.log('ℹ️ Error updating coiffeur:', error);
      return false;
    }
    
    console.log('✅ Updated coiffeur in Supabase:', id);
    return true;
  },

  // Update video URL
  async updateVideo(id: string, videoUrl: string): Promise<boolean> {
    console.log('📹 Tentative de sauvegarde vidéo pour:', id, 'URL:', videoUrl);
    
    if (!supabase) {
      console.warn('⚠️ Supabase non configuré, sauvegarde ignorée');
      return false;
    }
    
    const result = await this.update(id, { video_url: videoUrl });
    
    if (result) {
      console.log('✅ Vidéo sauvegardée dans Supabase pour:', id);
    } else {
      console.log('ℹ️ Échec de sauvegarde vidéo dans Supabase pour:', id);
    }
    
    return result;
  },

  // Update avatar URL
  async updateAvatar(id: string, avatarUrl: string): Promise<boolean> {
    console.log('🖼️ Tentative de sauvegarde avatar pour:', id, 'URL:', avatarUrl);
    
    if (!supabase) {
      console.warn('⚠️ Supabase non configuré, sauvegarde ignorée');
      return false;
    }
    
    const result = await this.update(id, { avatar_url: avatarUrl });
    
    if (result) {
      console.log('✅ Avatar sauvegardé dans Supabase pour:', id);
    } else {
      console.log('ℹ️ Échec de sauvegarde avatar dans Supabase pour:', id);
    }
    
    return result;
  }
};

// Portfolio CRUD Operations
export const portfolioDB = {
  // Get portfolio for a coiffeur
  async getByCoiffeur(coiffeurId: string): Promise<string[]> {
    if (!supabase) return [];
    
    const { data, error } = await supabase
      .from('portfolio')
      .select('image_url')
      .eq('coiffeur_id', coiffeurId)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.log('ℹ️ Error fetching portfolio:', error);
      return [];
    }
    
    return data?.map(p => p.image_url) || [];
  },

  // Add image to portfolio
  async add(coiffeurId: string, imageUrl: string): Promise<boolean> {
    if (!supabase) return false;
    
    const { error } = await supabase
      .from('portfolio')
      .insert({ coiffeur_id: coiffeurId, image_url: imageUrl });
    
    if (error) {
      console.log('ℹ️ Error adding portfolio image:', error);
      return false;
    }
    
    console.log('✅ Added portfolio image to Supabase');
    return true;
  },

  // Remove image from portfolio
  async remove(coiffeurId: string, imageUrl: string): Promise<boolean> {
    if (!supabase) return false;
    
    const { error } = await supabase
      .from('portfolio')
      .delete()
      .eq('coiffeur_id', coiffeurId)
      .eq('image_url', imageUrl);
    
    if (error) {
      console.log('ℹ️ Error removing portfolio image:', error);
      return false;
    }
    
    console.log('✅ Removed portfolio image from Supabase');
    return true;
  }
};

// Client CRUD Operations
export const clientDB = {
  // Add or update client
  async addOrUpdate(email: string, name?: string, phone?: string): Promise<boolean> {
    if (!supabase) {
      console.warn('⚠️ Supabase not configured, skipping client save');
      return false;
    }
    
    try {
      // Check if client already exists
      const { data: existing } = await supabase
        .from('clients')
        .select('id')
        .eq('email', email)
        .single();
      
      if (existing) {
        // Update existing client
        const updates: any = {};
        if (name) updates.name = name;
        if (phone) updates.phone = phone;
        
        if (Object.keys(updates).length > 0) {
          const { error } = await supabase
            .from('clients')
            .update(updates)
            .eq('email', email);
          
          if (error) {
            console.warn('⚠️ Error updating client:', error);
            return false;
          }
        }
      } else {
        // Insert new client
        const { error } = await supabase
          .from('clients')
          .insert({ 
            email, 
            name: name || null, 
            phone: phone || null 
          });
        
        if (error) {
          console.warn('⚠️ Error adding client:', error);
          return false;
        }
      }
      
      console.log('✅ Client saved successfully:', email);
      return true;
    } catch (error) {
      console.warn('⚠️ Exception saving client:', error);
      return false;
    }
  },

  // Get all clients
  async getAll(): Promise<ClientDB[]> {
    if (!supabase) return [];
    
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.log('ℹ️ Error fetching clients:', error);
      return [];
    }
    
    return data || [];
  }
};

// Appointments/Bookings CRUD Operations
export interface AppointmentDB {
  id: string;
  coiffeur_id: string;
  client_name: string;
  client_phone: string;
  booking_date: string;
  booking_time: string;
  created_at?: string;
  updated_at?: string;
}

export const appointmentDB = {
  // Create appointment when coiffeur accepts booking
  async create(
    coiffeurId: string,
    clientName: string,
    phone: string,
    service: string,
    serviceAr: string,
    date: string,
    time: string,
    comment?: string,
    clientId?: string
  ): Promise<boolean> {
    if (!supabase) {
      console.warn('⚠️ Supabase not configured, skipping appointment creation');
      return false;
    }
    
    try {
      const bookingData: any = {
        coiffeur_id: coiffeurId,
        client_name: clientName,
        client_phone: phone,
        booking_date: date,
        booking_time: time,
      };
      if (comment) bookingData.comment = comment;
      if (clientId) bookingData.client_id = clientId;
      
      console.log('📤 Envoi à Supabase (bookings):', bookingData);
      
      const { data, error } = await supabase
        .from('bookings')
        .insert(bookingData)
        .select();
      
      if (error) {
        console.error('❌ Erreur Supabase complète:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        return false;
      }
      
      console.log('✅ Réponse Supabase:', data);
      return true;
    } catch (error: any) {
      console.error('❌ Exception lors de la création:', {
        message: error?.message,
        stack: error?.stack,
        error: error
      });
      return false;
    }
  },

  // Get accepted appointments for a coiffeur and date
  async getAcceptedByCoiffeurAndDate(coiffeurId: string, date: string): Promise<string[]> {
    if (!supabase) return [];
    
    try {
      console.log(`🔍 Recherche des créneaux: coiffeur_id="${coiffeurId}", booking_date="${date}"`);
      
      const { data, error } = await supabase
        .from('bookings')
        .select('booking_time')
        .eq('coiffeur_id', coiffeurId)
        .eq('booking_date', date);
      
      if (error) {
        console.error('❌ Erreur lors de la récupération:', error);
        return [];
      }
      
      const times = data?.map(a => a.booking_time) || [];
      console.log(`✅ ${times.length} créneaux trouvés:`, times);
      return times;
    } catch (error) {
      console.error('❌ Exception lors de la récupération:', error);
      return [];
    }
  },

  // Get all accepted appointments for a coiffeur
  async getAcceptedByCoiffeur(coiffeurId: string): Promise<AppointmentDB[]> {
    if (!supabase) return [];
    
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .eq('coiffeur_id', coiffeurId)
        .order('booking_date', { ascending: true })
        .order('booking_time', { ascending: true });
      
      if (error) {
        console.log('ℹ️ Error fetching appointments:', error);
        return [];
      }
      
      return data || [];
    } catch (error) {
      console.log('ℹ️ Exception fetching appointments:', error);
      return [];
    }
  },

  // Delete appointment
  async delete(id: string): Promise<boolean> {
    if (!supabase) return false;
    
    try {
      const { error } = await supabase
        .from('bookings')
        .delete()
        .eq('id', id);
      
      if (error) {
        console.warn('⚠️ Error deleting appointment:', error);
        return false;
      }
      
      console.log('✅ Appointment deleted successfully');
      return true;
    } catch (error) {
      console.warn('⚠️ Exception deleting appointment:', error);
      return false;
    }
  }
};

// Mock upload function pour développement sans Supabase
export const mockUploadFile = async (
  file: File,
  bucket: string,
  path: string
): Promise<{ url: string; error: null } | { url: null; error: string }> => {
  try {
    await new Promise(resolve => setTimeout(resolve, 1000));
    const url = URL.createObjectURL(file);
    console.log(`✅ Mock upload: ${file.name} to ${bucket}/${path}`);
    return { url, error: null };
  } catch (error) {
    return { url: null, error: 'Upload failed' };
  }
};

// Upload file to Supabase Storage
export const uploadFile = async (
  file: File,
  bucket: string,
  path: string
): Promise<{ url: string | null; error: string | null }> => {
  // Si Supabase n'est pas configuré, utiliser mock
  if (!supabase) {
    console.warn('⚠️ Supabase not configured, using mock upload');
    return mockUploadFile(file, bucket, path);
  }

  try {
    console.log('📤 Upload vers Supabase Storage:', {
      bucket,
      path,
      fileSize: file.size,
      fileType: file.type
    });

    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(path, file, {
        cacheControl: '3600',
        upsert: true, // Permet de remplacer si existe déjà
      });

    if (error) {
      console.error('❌ Erreur Storage détaillée:', {
        message: error.message,
        statusCode: error.statusCode,
        error: error
      });
      return { url: null, error: error.message };
    }

    // Récupérer l'URL publique
    const { data: urlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(data.path);

    console.log('✅ Fichier uploadé avec succès:', {
      path: data.path,
      publicUrl: urlData.publicUrl
    });

    return { url: urlData.publicUrl, error: null };
  } catch (error: any) {
    console.error('❌ Exception lors de l\'upload:', {
      message: error?.message,
      stack: error?.stack,
      error: error
    });
    return { url: null, error: error?.message || 'Upload failed' };
  }
};

// Delete file from Supabase Storage
export const deleteFile = async (
  bucket: string,
  path: string
): Promise<{ error: string | null }> => {
  if (!supabase) {
    console.warn('⚠️ Supabase not configured, skipping delete');
    return { error: null };
  }

  try {
    const { error } = await supabase.storage.from(bucket).remove([path]);

    if (error) {
      return { error: error.message };
    }

    return { error: null };
  } catch (error) {
    return { error: 'Delete failed' };
  }
};


