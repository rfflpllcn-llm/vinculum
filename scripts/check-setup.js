#!/usr/bin/env node

/**
 * Setup verification script for Vinculum
 * Run with: node scripts/check-setup.js
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Checking Vinculum setup...\n');

let hasErrors = false;

// Check Node version
const nodeVersion = process.version;
const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
if (majorVersion >= 18) {
  console.log('✅ Node.js version:', nodeVersion);
} else {
  console.log('❌ Node.js version:', nodeVersion, '(requires 18+)');
  hasErrors = true;
}

// Check package.json
if (fs.existsSync('package.json')) {
  console.log('✅ package.json found');
} else {
  console.log('❌ package.json not found');
  hasErrors = true;
}

// Check node_modules
if (fs.existsSync('node_modules')) {
  console.log('✅ node_modules installed');
} else {
  console.log('⚠️  node_modules not found - run: npm install');
  hasErrors = true;
}

// Check .env.local
if (fs.existsSync('.env.local')) {
  console.log('✅ .env.local found');

  // Check if it has required variables
  const envContent = fs.readFileSync('.env.local', 'utf8');
  const hasClientId = envContent.includes('GOOGLE_CLIENT_ID=') &&
                      !envContent.includes('GOOGLE_CLIENT_ID=your_');
  const hasClientSecret = envContent.includes('GOOGLE_CLIENT_SECRET=') &&
                          !envContent.includes('GOOGLE_CLIENT_SECRET=your_');
  const hasNextAuthSecret = envContent.includes('NEXTAUTH_SECRET=') &&
                            !envContent.includes('NEXTAUTH_SECRET=your_');

  if (hasClientId) {
    console.log('  ✅ GOOGLE_CLIENT_ID configured');
  } else {
    console.log('  ❌ GOOGLE_CLIENT_ID not configured properly');
    hasErrors = true;
  }

  if (hasClientSecret) {
    console.log('  ✅ GOOGLE_CLIENT_SECRET configured');
  } else {
    console.log('  ❌ GOOGLE_CLIENT_SECRET not configured properly');
    hasErrors = true;
  }

  if (hasNextAuthSecret) {
    console.log('  ✅ NEXTAUTH_SECRET configured');
  } else {
    console.log('  ❌ NEXTAUTH_SECRET not configured properly');
    hasErrors = true;
  }
} else {
  console.log('❌ .env.local not found');
  console.log('   Run: cp .env.example .env.local');
  console.log('   Then edit .env.local with your Google OAuth credentials');
  hasErrors = true;
}

// Check key source files
const requiredFiles = [
  'src/app/page.tsx',
  'src/components/PDFViewer.tsx',
  'src/lib/auth.ts',
  'src/lib/drive.ts',
  'src/types/schemas.ts',
];

console.log('\n📁 Checking source files:');
requiredFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`  ✅ ${file}`);
  } else {
    console.log(`  ❌ ${file}`);
    hasErrors = true;
  }
});

// Summary
console.log('\n' + '='.repeat(50));
if (hasErrors) {
  console.log('❌ Setup incomplete - please fix the issues above');
  console.log('\nNext steps:');
  console.log('1. Run: npm install');
  console.log('2. Copy .env.example to .env.local');
  console.log('3. Configure Google OAuth credentials in .env.local');
  console.log('4. Run this check again: node scripts/check-setup.js');
  process.exit(1);
} else {
  console.log('✅ Setup looks good!');
  console.log('\nNext steps:');
  console.log('1. Run: npm run dev');
  console.log('2. Open: http://localhost:3000');
  console.log('3. Sign in with Google');
  console.log('4. Upload a PDF to Google Drive: /Vinculum_Data/Books/');
  console.log('5. See TESTING.md for detailed testing instructions');
  process.exit(0);
}
