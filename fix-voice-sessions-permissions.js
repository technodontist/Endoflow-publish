const fs = require('fs');

console.log('🔧 Fixing voice_sessions table permissions...\n');
console.log('📋 MANUAL SETUP REQUIRED:');
console.log('Due to permission restrictions, the SQL must be run directly in Supabase.\n');
console.log('Steps:');
console.log('1. Open your Supabase Dashboard');
console.log('2. Go to SQL Editor');
console.log('3. Copy the SQL below and paste it into the SQL Editor');
console.log('4. Click RUN\n');

// Read and display the SQL file
try {
  const sqlContent = fs.readFileSync('fix-voice-sessions-permissions.sql', 'utf8');
  console.log('📄 SQL to run:');
  console.log('═'.repeat(70));
  console.log(sqlContent);
  console.log('═'.repeat(70));
} catch (error) {
  console.error('❌ Could not read SQL file:', error.message);
}

console.log('\n✅ After running the SQL, restart your dev server: npm run dev');
