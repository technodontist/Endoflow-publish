const postgres = require('postgres');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const sql = postgres(process.env.POSTGRES_URL);

async function runMigration() {
  try {
    console.log('🔄 Running database migration...');

    // Read the migration file
    const migrationPath = path.join(__dirname, 'lib/db/migrations/0002_appointment_booking_system.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    // Split by statements and execute each one
    const statements = migrationSQL
      .split(';')
      .map(statement => statement.trim())
      .filter(statement => statement.length > 0 && !statement.startsWith('--'));

    for (const statement of statements) {
      if (statement.trim()) {
        console.log('Executing:', statement.substring(0, 50) + '...');
        await sql.unsafe(statement);
      }
    }

    console.log('✅ Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await sql.end();
  }
}

runMigration();