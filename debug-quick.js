const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function debugSchema() {
  console.log("🔍 Quick schema debug...");
  
  try {
    // Test patients
    const { data: patients, error: pError } = await supabase.schema("api").from("patients").select("*").limit(3);
    if (pError) {
      console.log("Patients: ERROR -", pError.message);
    } else {
      console.log(`Patients: ✅ ${patients.length} found`);
    }
    
    // Test consultations
    const { data: consults, error: cError } = await supabase.schema("api").from("consultations").select("*").limit(3);
    if (cError) {
      console.log("Consultations: ERROR -", cError.message);
    } else {
      console.log(`Consultations: ✅ ${consults.length} found`);
    }
    
    // Test research projects
    const { data: research, error: rError } = await supabase.schema("api").from("research_projects").select("*").limit(1);
    if (rError) {
      console.log("Research Projects: ERROR -", rError.message);
    } else {
      console.log(`Research Projects: ✅ ${research.length} found`);
    }
  } catch (error) {
    console.error("Fatal error:", error);
  }
}

debugSchema();
