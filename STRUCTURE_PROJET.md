# 📁 Structure du Projet - RAED COIF

## 🎯 Vue d'Ensemble

Système de réservation de coiffure avec interface admin et client, multilingue (FR/AR), avec gestion vidéo et portfolio.

---

## 📂 Arborescence Complète

```
reservation_coiffeur/
│
├── 📁 app/                          # Application Next.js 15
│   ├── 📁 admin/                    # Espace Admin (Coiffeurs)
│   │   └── 📁 [id]/                 # Routes dynamiques par coiffeur
│   │       ├── page.tsx             # Tableau de bord admin
│   │       └── 📁 profile/
│   │           └── page.tsx         # Gestion du profil
│   │
│   ├── 📁 coiffeurs/                # Espace Client
│   │   └── page.tsx                 # Liste des coiffeurs
│   │
│   ├── 📁 components/               # Composants réutilisables
│   │   ├── ErrorBoundary.tsx        # Gestion des erreurs React
│   │   └── SupabaseStatus.tsx       # Badge de statut Supabase
│   │
│   ├── 📁 context/                  # Contextes React
│   │   ├── AuthContext.tsx          # Authentification & Coiffeurs
│   │   └── BookingContext.tsx       # Gestion des réservations
│   │
│   ├── 📁 reservation/              # Système de réservation
│   │   └── page.tsx                 # Formulaire de réservation
│   │
│   ├── globals.css                  # Styles globaux
│   ├── layout.tsx                   # Layout principal
│   └── page.tsx                     # Page d'accueil (Login)
│
├── 📁 lib/                          # Bibliothèques et utilitaires
│   └── supabase.ts                  # Configuration Supabase
│
├── 📁 public/                       # Fichiers statiques
│   ├── clear-storage.html           # Outil de nettoyage localStorage
│   └── test-storage.html            # Outil de test localStorage
│
├── 📁 .next/                        # Build Next.js (généré)
├── 📁 node_modules/                 # Dépendances (généré)
│
├── .env.local                       # Variables d'environnement
├── .eslintrc.json                   # Configuration ESLint
├── .gitignore                       # Fichiers ignorés par Git
├── next.config.ts                   # Configuration Next.js
├── package.json                     # Dépendances du projet
├── postcss.config.mjs               # Configuration PostCSS
├── tailwind.config.ts               # Configuration Tailwind CSS
├── tsconfig.json                    # Configuration TypeScript
│
├── CORRECTIONS_EFFECTUEES.md        # 📝 Documentation des corrections
├── GUIDE_DEMARRAGE.md               # 🚀 Guide de démarrage
└── STRUCTURE_PROJET.md              # 📁 Ce fichier
```

---

## 📄 Description des Fichiers Principaux

### 🔐 Authentification & Données

#### `app/context/AuthContext.tsx`
**Rôle:** Gestion centralisée de l'authentification et des données coiffeurs

**Fonctionnalités:**
- ✅ Connexion/Déconnexion
- ✅ Gestion des coiffeurs (CRUD)
- ✅ Mise à jour des vidéos
- ✅ Gestion du portfolio
- ✅ Synchronisation localStorage + Supabase
- ✅ Système de storage sécurisé (gère les URLs sans parsing JSON)

**État Corrigé:** ✅ Variable `item` accessible dans le catch

#### `app/context/BookingContext.tsx`
**Rôle:** Gestion des réservations

**Fonctionnalités:**
- ✅ Ajout de réservations
- ✅ Acceptation/Rejet
- ✅ Archivage
- ✅ Filtrage par coiffeur
- ✅ Gestion des créneaux occupés
- ✅ Persistence localStorage

---

### 🎨 Pages Principales

#### `app/page.tsx` - Page d'Accueil
**URL:** `/`
**Rôle:** Connexion admin

**Fonctionnalités:**
- Formulaire de connexion
- Changement de langue (FR/AR)
- Redirection vers tableau de bord
- Lien vers espace client

#### `app/coiffeurs/page.tsx` - Liste des Coiffeurs
**URL:** `/coiffeurs`
**Rôle:** Affichage des coiffeurs pour les clients

**Fonctionnalités:**
- ✅ Affichage des vidéos de présentation
- ✅ Validation stricte des URLs vidéo
- ✅ Sanitization automatique (Google Drive, Dropbox)
- ✅ Fallback élégant si vidéo indisponible
- ✅ Boutons de réservation
- ✅ Multilingue (FR/AR)

**État Corrigé:** ✅ Messages d'erreur vidéo nettoyés

#### `app/reservation/page.tsx` - Réservation
**URL:** `/reservation?coiffeur=raed`
**Rôle:** Formulaire de réservation client

**Fonctionnalités:**
- ✅ Sélection de service
- ✅ Calendrier interactif (14 jours)
- ✅ Créneaux horaires avec état
- ✅ Validation des formulaires
- ✅ Message de succès animé
- ✅ Affichage du portfolio du coiffeur
- ✅ Lightbox pour les images

#### `app/admin/[id]/page.tsx` - Tableau de Bord Admin
**URL:** `/admin/raed`
**Rôle:** Interface de gestion pour les coiffeurs

**Fonctionnalités:**
- ✅ Liste des réservations en attente
- ✅ Liste des réservations acceptées
- ✅ Acceptation/Archivage
- ✅ Appel client (lien tel:)
- ✅ Planning hebdomadaire visuel
- ✅ Badge de notifications
- ✅ Protection de route

#### `app/admin/[id]/profile/page.tsx` - Profil Admin
**URL:** `/admin/raed/profile`
**Rôle:** Gestion du profil coiffeur

**Fonctionnalités:**
- ✅ Modification des informations
- ✅ Upload de vidéo (drag & drop ou URL)
- ✅ Gestion du portfolio
- ✅ Sanitization automatique des URLs
- ✅ Prévisualisation en temps réel
- ✅ Sauvegarde double (localStorage + Supabase)

---

### 🛠️ Utilitaires & Configuration

#### `lib/supabase.ts`
**Rôle:** Configuration et fonctions Supabase

**Fonctionnalités:**
- ✅ Client Supabase
- ✅ CRUD coiffeurs
- ✅ CRUD portfolio
- ✅ Upload de fichiers
- ✅ Détection de configuration
- ✅ Fallback localStorage

#### `app/components/ErrorBoundary.tsx`
**Rôle:** Capture des erreurs React

**Fonctionnalités:**
- ✅ Affichage d'erreur élégant
- ✅ Bouton de rechargement
- ✅ Logs console

#### `app/components/SupabaseStatus.tsx`
**Rôle:** Badge de statut de connexion

**Fonctionnalités:**
- ✅ Affichage temporaire (5s)
- ✅ Indicateur visuel (vert/jaune)
- ✅ Message clair

---

## 🎨 Styles & Design

### `app/globals.css`
**Contenu:**
- Polices: Playfair Display (FR), Cairo (AR)
- Couleur principale: Gold (#D4AF37)
- Animations: pulse-gold, fadeIn
- Scrollbar personnalisée
- Styles drag & drop
- Créneaux occupés (effet barré)
- Responsive mobile

### `tailwind.config.ts`
**Configuration:**
- Couleur gold personnalisée
- Extensions de thème
- Plugins

---

## 🗄️ Base de Données Supabase

### Table `profiles`
```sql
CREATE TABLE profiles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  specialty TEXT NOT NULL,
  specialty_ar TEXT NOT NULL,
  video_url TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Table `portfolio`
```sql
CREATE TABLE portfolio (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  coiffeur_id TEXT REFERENCES profiles(id),
  image_url TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 📦 Dépendances Principales

### Production
- `next` (15.1.6) - Framework React
- `react` (19.0.0) - Bibliothèque UI
- `framer-motion` (11.15.0) - Animations
- `@supabase/supabase-js` (2.39.0) - Client Supabase

### Développement
- `typescript` (5.x) - Typage statique
- `tailwindcss` (3.4.17) - Styles utilitaires
- `eslint` (9.39.2) - Linting

---

## 🔄 Flux de Données

### Authentification
```
Login Page → AuthContext.login() → localStorage → Redirect to Admin
```

### Réservation
```
Client → Sélection → BookingContext.addBooking() → localStorage
→ Admin Dashboard → Accept/Reject → Update localStorage
```

### Vidéo
```
Admin Profile → Upload/URL → sanitizeVideoUrl() 
→ AuthContext.updateVideo() → localStorage + Supabase
→ Coiffeurs Page → Display with fallback
```

### Portfolio
```
Admin Profile → Upload/URL → AuthContext.addPortfolioImage()
→ localStorage + Supabase → Reservation Page → Lightbox
```

---

## 🎯 Points Clés du Système

### 🔒 Sécurité
- Validation des URLs
- Protection des routes admin
- Sanitization des entrées
- ErrorBoundary pour les crashes

### 💾 Persistence
- Double sauvegarde (localStorage + Supabase)
- Fallback automatique
- Synchronisation au chargement

### 🎨 UX/UI
- Animations fluides (Framer Motion)
- Responsive design
- Multilingue (FR/AR avec RTL)
- Feedback visuel (loading, success, error)

### ⚡ Performance
- Lazy loading des images
- Optimisation des re-renders
- Gestion efficace du state

---

## ✅ État Actuel

**Tous les fichiers:** ✅ SANS ERREUR
**Tous les diagnostics:** ✅ PASSÉS
**Toutes les fonctionnalités:** ✅ OPÉRATIONNELLES

---

## 🚀 Prochaines Améliorations Possibles

1. **Notifications Push** - Alertes en temps réel
2. **Paiement en ligne** - Intégration Stripe/PayPal
3. **SMS** - Confirmation par SMS
4. **Analytics** - Suivi des réservations
5. **Multi-salon** - Support de plusieurs salons
6. **Avis clients** - Système de notation
7. **Historique** - Archive des réservations passées

---

**Documentation complète et à jour ! 📚**
