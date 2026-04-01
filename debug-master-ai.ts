
import { orchestrateQuery } from './lib/services/endoflow-master-ai';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function runDebug() {
  console.log('🚀 Starting Master AI Debug...');

  // Mock Dentist ID (we need a valid UUID, let's try to fetch one or use a dummy)
  // Ideally we fetch a real dentist ID from the DB
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: dentists } = await supabase.from('profiles').select('id').eq('role', 'dentist').limit(1);
  const dentistId = dentists?.[0]?.id || '00000000-0000-0000-0000-000000000000';
  console.log(`👤 Using Dentist ID: ${dentistId}`);

  const queries = [
    "What is the capital of France?", // General
    "Show me my schedule for today", // Appointment Inquiry
    "Suggest treatment for irreversible pulpitis on tooth 36", // Treatment Planning
  ];

  for (const query of queries) {
    console.log(`\n❓ Query: "${query}"`);
    try {
      const result = await orchestrateQuery({
        userQuery: query,
        dentistId: dentistId,
        conversationHistory: [],
        language: 'en-US'
      });

      console.log(`✅ Success: ${result.success}`);
      console.log(`🎯 Intent: ${result.intent.type}`);
      console.log(`💬 Response: ${result.response}`);
      if (result.agentResponses.length > 0) {
        console.log(`🤖 Agent Data:`, JSON.stringify(result.agentResponses[0].data, null, 2).substring(0, 200) + '...');
      }
    } catch (error) {
      console.error(`❌ Error:`, error);
    }
  }
}

runDebug().catch(console.error);
