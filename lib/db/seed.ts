import { createServiceClient } from '@/lib/supabase/server';

async function seed() {
  const supabase = await createServiceClient();

  // Create test users in separate role tables
  const testPatient = {
    id: 'test-patient-001',
    first_name: 'John',
    last_name: 'Doe',
    email: 'patient@test.com',
    phone: '+1234567890'
  };

  const testAssistant = {
    id: 'test-assistant-001',
    first_name: 'Jane',
    last_name: 'Smith',
    email: 'assistant@test.com',
    phone: '+1234567891'
  };

  const testDentist = {
    id: 'test-dentist-001',
    first_name: 'Dr. Sarah',
    last_name: 'Johnson',
    email: 'dentist@test.com',
    phone: '+1234567892'
  };

  // Real dentist profiles from CLAUDE.md
  const drNisarg = {
    id: 'dr-nisarg-001',
    full_name: 'Dr. Nisarg Patel',
    specialty: 'General Dentistry'
  };

  const drPranav = {
    id: 'dr-pranav-001',
    full_name: 'Dr. Pranav Shah',
    specialty: 'Endodontics'
  };

  // Insert into separate tables (Supabase handles conflicts automatically)
  try {
    await supabase.schema('api').from('patients').insert(testPatient);
  } catch (error) {
    console.log('Patient already exists, skipping...');
  }

  try {
    await supabase.schema('api').from('assistants').insert(testAssistant);
  } catch (error) {
    console.log('Assistant already exists, skipping...');
  }

  try {
    await supabase.schema('api').from('dentists').insert(testDentist);
  } catch (error) {
    console.log('Dentist already exists, skipping...');
  }

  // Insert real dentists
  try {
    await supabase.schema('api').from('dentists').insert(drNisarg);
    console.log('Dr. Nisarg created successfully');
  } catch (error) {
    console.log('Dr. Nisarg already exists, skipping...');
  }

  try {
    await supabase.schema('api').from('dentists').insert(drPranav);
    console.log('Dr. Pranav created successfully');
  } catch (error) {
    console.log('Dr. Pranav already exists, skipping...');
  }

  console.log('ENDOFLOW test users created successfully in separate role tables.');
  console.log('Test credentials:');
  console.log('- Patient: patient@test.com');
  console.log('- Assistant: assistant@test.com');
  console.log('- Dentist: dentist@test.com');
  console.log('Note: Users still need to be created in Supabase Auth separately.');
}

seed()
  .catch((error) => {
    console.error('Seed process failed:', error);
    process.exit(1);
  })
  .finally(() => {
    console.log('Seed process finished. Exiting...');
    process.exit(0);
  });
