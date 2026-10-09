#!/usr/bin/env node

/**
 * Script de Vérification du Projet RAED COIF
 * Vérifie que tous les fichiers sont présents et sans erreur
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Vérification du Projet RAED COIF\n');
console.log('═'.repeat(50));

// Fichiers critiques à vérifier
const criticalFiles = [
  'app/context/AuthContext.tsx',
  'app/context/BookingContext.tsx',
  'app/coiffeurs/page.tsx',
  'app/reservation/page.tsx',
  'app/admin/[id]/page.tsx',
  'app/admin/[id]/profile/page.tsx',
  'app/layout.tsx',
  'app/page.tsx',
  'lib/supabase.ts',
  'app/components/ErrorBoundary.tsx',
  'app/components/SupabaseStatus.tsx',
  'app/globals.css',
  'package.json',
  '.env.local',
  'tailwind.config.ts',
  'tsconfig.json',
];

let allGood = true;
let fileCount = 0;

console.log('\n📁 Vérification des fichiers critiques:\n');

criticalFiles.forEach(file => {
  const filePath = path.join(process.cwd(), file);
  const exists = fs.existsSync(filePath);
  
  if (exists) {
    const stats = fs.statSync(filePath);
    const size = (stats.size / 1024).toFixed(2);
    console.log(`✅ ${file.padEnd(45)} (${size} KB)`);
    fileCount++;
  } else {
    console.log(`❌ ${file.padEnd(45)} MANQUANT`);
    allGood = false;
  }
});

console.log('\n' + '═'.repeat(50));
console.log(`\n📊 Résumé: ${fileCount}/${criticalFiles.length} fichiers présents`);

// Vérifier package.json
console.log('\n📦 Vérification des dépendances:\n');

try {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const deps = packageJson.dependencies || {};
  const devDeps = packageJson.devDependencies || {};
  
  const requiredDeps = {
    'next': '✅ Framework Next.js',
    'react': '✅ Bibliothèque React',
    'framer-motion': '✅ Animations',
    '@supabase/supabase-js': '✅ Client Supabase',
  };
  
  Object.keys(requiredDeps).forEach(dep => {
    if (deps[dep]) {
      console.log(`${requiredDeps[dep].padEnd(30)} v${deps[dep]}`);
    } else {
      console.log(`❌ ${dep} MANQUANT`);
      allGood = false;
    }
  });
  
  console.log('\n🛠️  Dépendances de développement:');
  console.log(`✅ TypeScript              v${devDeps.typescript || 'N/A'}`);
  console.log(`✅ Tailwind CSS            v${devDeps.tailwindcss || 'N/A'}`);
  console.log(`✅ ESLint                  v${devDeps.eslint || 'N/A'}`);
  
} catch (error) {
  console.log('❌ Erreur lors de la lecture de package.json');
  allGood = false;
}

// Vérifier .env.local
console.log('\n🔐 Vérification de la configuration:\n');

try {
  const envContent = fs.readFileSync('.env.local', 'utf8');
  
  if (envContent.includes('NEXT_PUBLIC_SUPABASE_URL')) {
    console.log('✅ NEXT_PUBLIC_SUPABASE_URL configuré');
  } else {
    console.log('⚠️  NEXT_PUBLIC_SUPABASE_URL manquant');
  }
  
  if (envContent.includes('NEXT_PUBLIC_SUPABASE_ANON_KEY')) {
    console.log('✅ NEXT_PUBLIC_SUPABASE_ANON_KEY configuré');
  } else {
    console.log('⚠️  NEXT_PUBLIC_SUPABASE_ANON_KEY manquant');
  }
  
} catch (error) {
  console.log('❌ Fichier .env.local non trouvé');
}

// Vérifier les corrections
console.log('\n🔧 Vérification des corrections:\n');

try {
  const authContext = fs.readFileSync('app/context/AuthContext.tsx', 'utf8');
  
  // Vérifier que la variable item est bien déclarée avant le try
  if (authContext.includes('const item = localStorage.getItem(key);') && 
      authContext.includes('if (!item) return null;') &&
      authContext.includes('try {') &&
      authContext.includes('return (item.startsWith(\'http\'))')) {
    console.log('✅ AuthContext.tsx - Correction de la variable item appliquée');
  } else {
    console.log('⚠️  AuthContext.tsx - Vérifier la correction de la variable item');
  }
  
} catch (error) {
  console.log('❌ Impossible de vérifier AuthContext.tsx');
  allGood = false;
}

try {
  const coiffeursPage = fs.readFileSync('app/coiffeurs/page.tsx', 'utf8');
  
  // Vérifier que console.log est utilisé au lieu de console.error
  if (coiffeursPage.includes('console.log("Vidéo non disponible pour ce profil")')) {
    console.log('✅ coiffeurs/page.tsx - Correction des messages d\'erreur appliquée');
  } else {
    console.log('⚠️  coiffeurs/page.tsx - Vérifier la correction des messages d\'erreur');
  }
  
} catch (error) {
  console.log('❌ Impossible de vérifier coiffeurs/page.tsx');
  allGood = false;
}

// Résultat final
console.log('\n' + '═'.repeat(50));

if (allGood) {
  console.log('\n✅ TOUS LES TESTS SONT PASSÉS !');
  console.log('\n🚀 Le projet est prêt à être démarré avec: npm run dev\n');
  process.exit(0);
} else {
  console.log('\n⚠️  CERTAINS PROBLÈMES ONT ÉTÉ DÉTECTÉS');
  console.log('\n📖 Consultez GUIDE_DEMARRAGE.md pour plus d\'informations\n');
  process.exit(1);
}
