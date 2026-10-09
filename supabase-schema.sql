-- RAED COIF - Supabase Database Schema avec Row Level Security

-- Table des coiffeurs
CREATE TABLE IF NOT EXISTS coiffeurs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL, -- En production, utiliser bcrypt
  specialty TEXT NOT NULL,
  specialty_ar TEXT NOT NULL,
  video_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table du portfolio
CREATE TABLE IF NOT EXISTS portfolio (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coiffeur_id TEXT NOT NULL,
  image_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table des réservations
CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coiffeur_id TEXT REFERENCES coiffeurs(id) ON DELETE CASCADE,
  client_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  service TEXT NOT NULL,
  service_ar TEXT NOT NULL,
  booking_date DATE NOT NULL,
  booking_time TIME NOT NULL,
  status TEXT CHECK (status IN ('pending', 'accepted', 'rejected')) DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table des clients
CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE coiffeurs ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

-- RLS Policies pour coiffeurs
-- Un coiffeur peut voir et modifier uniquement ses propres données
CREATE POLICY "Coiffeurs can view own data"
  ON coiffeurs FOR SELECT
  USING (auth.uid()::text = id);

CREATE POLICY "Coiffeurs can update own data"
  ON coiffeurs FOR UPDATE
  USING (auth.uid()::text = id);

-- RLS Policies pour portfolio
-- Un coiffeur peut gérer uniquement son propre portfolio
CREATE POLICY "Coiffeurs can view own portfolio"
  ON portfolio FOR SELECT
  USING (coiffeur_id = auth.uid()::text);

CREATE POLICY "Coiffeurs can insert own portfolio"
  ON portfolio FOR INSERT
  WITH CHECK (coiffeur_id = auth.uid()::text);

CREATE POLICY "Coiffeurs can delete own portfolio"
  ON portfolio FOR DELETE
  USING (coiffeur_id = auth.uid()::text);

-- RLS Policies pour bookings
-- Un coiffeur peut voir et gérer uniquement ses propres réservations
CREATE POLICY "Coiffeurs can view own bookings"
  ON bookings FOR SELECT
  USING (coiffeur_id = auth.uid()::text);

CREATE POLICY "Coiffeurs can update own bookings"
  ON bookings FOR UPDATE
  USING (coiffeur_id = auth.uid()::text);

-- Les clients peuvent créer des réservations (public)
CREATE POLICY "Anyone can create bookings"
  ON bookings FOR INSERT
  WITH CHECK (true);

-- Tous peuvent voir les coiffeurs (pour la page publique)
CREATE POLICY "Anyone can view coiffeurs"
  ON coiffeurs FOR SELECT
  USING (true);

-- Tous peuvent voir les portfolios (pour la page publique)
CREATE POLICY "Anyone can view portfolios"
  ON portfolio FOR SELECT
  USING (true);

-- RLS Policies pour clients
-- Tous peuvent créer des clients (pour les réservations)
CREATE POLICY "Anyone can create clients"
  ON clients FOR INSERT
  WITH CHECK (true);

-- Les coiffeurs peuvent voir leurs clients (via les réservations)
CREATE POLICY "Coiffeurs can view clients"
  ON clients FOR SELECT
  USING (true);

-- Storage Buckets
-- Créer les buckets pour les médias
INSERT INTO storage.buckets (id, name, public)
VALUES 
  ('videos', 'videos', true),
  ('portfolio', 'portfolio', true);

-- Storage Policies
-- Chaque coiffeur peut uploader dans son propre dossier
CREATE POLICY "Coiffeurs can upload own videos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'videos' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Coiffeurs can upload own portfolio"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'portfolio' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Coiffeurs can delete own videos"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'videos' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Coiffeurs can delete own portfolio"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'portfolio' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Public access to view media
CREATE POLICY "Anyone can view videos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'videos');

CREATE POLICY "Anyone can view portfolio"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'portfolio');

-- Indexes pour performance
CREATE INDEX idx_bookings_coiffeur ON bookings(coiffeur_id);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_bookings_date ON bookings(booking_date);
CREATE INDEX idx_portfolio_coiffeur ON portfolio(coiffeur_id);
CREATE INDEX idx_clients_email ON clients(email);

-- Fonction pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers pour updated_at
CREATE TRIGGER update_coiffeurs_updated_at
  BEFORE UPDATE ON coiffeurs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bookings_updated_at
  BEFORE UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
