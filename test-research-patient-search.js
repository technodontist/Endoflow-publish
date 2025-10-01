require('dotenv').config({ path: '.env.local' });

async function testResearchPatientSearch() {
  try {
    console.log('🔬 Testing research patient search via API...');

    // Call the research endpoint with empty criteria (should return all patients)
    const response = await fetch('http://localhost:3009/dentist', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': 'dentist_session=test' // Basic session header
      },
      body: JSON.stringify({
        action: 'findMatchingPatients',
        projectId: 'test-project-123',
        criteria: [] // Empty criteria to get all patients
      })
    });

    if (!response.ok) {
      console.error('❌ API request failed:', response.status, response.statusText);
      return;
    }

    const result = await response.json();
    console.log('✅ API response:', result);

  } catch (error) {
    console.error('❌ Test error:', error);
  }
}

// Wait a moment for dev server to be ready then test
setTimeout(testResearchPatientSearch, 2000);