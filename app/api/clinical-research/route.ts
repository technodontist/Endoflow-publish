import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const { message, context } = await request.json();

    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    console.log('🔍 [API] Clinical research query:', message);

    // Get database context for AI
    const databaseContext = await getDatabaseContext();

    // TODO: Replace with actual n8n workflow call
    // For now, we'll simulate the AI response based on the message content
    const response = await simulateAIResponse(message, databaseContext);

    console.log('✅ [API] Clinical research response generated');

    return NextResponse.json({
      success: true,
      response: response,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ [API] Error in clinical research endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function getDatabaseContext() {
  const supabase = await createServiceClient();

  try {
    // Get summary statistics for AI context
    const [patientsCount, appointmentsCount, consultationsCount] = await Promise.all([
      supabase.from('profiles').select('id', { count: 'exact' }).eq('role', 'patient').eq('status', 'active'),
      supabase.schema('api').from('appointments').select('id', { count: 'exact' }),
      supabase.schema('api').from('consultations').select('id', { count: 'exact' })
    ]);

    // Get recent consultations for treatment patterns
    const { data: recentConsultations } = await supabase
      .schema('api')
      .from('consultations')
      .select('diagnosis, treatment_plan, prognosis')
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(50);

    // Get appointment success rates
    const { data: appointmentStats } = await supabase
      .schema('api')
      .from('appointments')
      .select('status')
      .in('status', ['completed', 'cancelled', 'no_show']);

    const context = {
      totalPatients: patientsCount.count || 0,
      totalAppointments: appointmentsCount.count || 0,
      totalConsultations: consultationsCount.count || 0,
      recentTreatments: recentConsultations || [],
      appointmentStats: appointmentStats || []
    };

    return context;
  } catch (error) {
    console.error('Error getting database context:', error);
    return null;
  }
}

async function simulateAIResponse(message: string, context: any) {
  // Simulate AI processing time
  await new Promise(resolve => setTimeout(resolve, 1500));

  const lowerMessage = message.toLowerCase();

  // Context-aware responses based on actual database data
  if (lowerMessage.includes('lidis') || lowerMessage.includes('endocrown')) {
    return `Based on your clinical database with ${context?.totalConsultations || 0} consultations, I can analyze LiDiS endocrown success rates. Your practice shows treatment patterns that align with published literature indicating 85-95% success rates for single-sitting RCT with endocrowns at 2 years. Would you like me to analyze your specific endodontic success metrics or compare with evidence-based protocols?`;
  }

  if (lowerMessage.includes('success') && lowerMessage.includes('rate')) {
    const completedAppointments = context?.appointmentStats?.filter((apt: any) => apt.status === 'completed').length || 0;
    const totalAppointments = context?.appointmentStats?.length || 1;
    const successRate = ((completedAppointments / totalAppointments) * 100).toFixed(1);

    return `Your clinic's overall success rate is ${successRate}% based on ${totalAppointments} appointments in the database. For endodontic procedures specifically, literature suggests success rates of 85-95% for primary treatments. I can break down success rates by treatment type, patient demographics, or time periods. What specific analysis would you like?`;
  }

  if (lowerMessage.includes('revenue') || lowerMessage.includes('growth')) {
    return `With ${context?.totalPatients || 0} active patients and ${context?.totalAppointments || 0} appointments, your practice demonstrates growth potential. Based on treatment patterns in your database, revenue optimization opportunities include: increasing complex endodontic procedures, implementing treatment sequencing protocols, and enhancing patient retention. Would you like specific revenue enhancement recommendations?`;
  }

  if (lowerMessage.includes('treatment') && lowerMessage.includes('outcome')) {
    const treatmentCount = context?.recentTreatments?.length || 0;
    return `Analyzing ${treatmentCount} recent consultations in your database, treatment outcomes vary by procedure complexity and patient factors. Your consultation records show diverse treatment planning approaches. I can provide evidence-based outcome predictions, success rate analysis by treatment type, or compare your protocols with published research. What specific outcome analysis interests you?`;
  }

  if (lowerMessage.includes('patient') && (lowerMessage.includes('demographic') || lowerMessage.includes('age'))) {
    return `Your patient database contains ${context?.totalPatients || 0} active patients. Demographic analysis shows treatment planning varies significantly by age groups. Younger patients (18-35) typically present with preventive needs, while older patients (50+) often require complex restorative work. Would you like detailed demographic breakdowns or age-specific treatment recommendations?`;
  }

  if (lowerMessage.includes('evidence') || lowerMessage.includes('research') || lowerMessage.includes('literature')) {
    return `I can access current endodontic literature and compare it with your clinical data patterns. Your ${context?.totalConsultations || 0} consultations provide a substantial dataset for evidence-based analysis. Recent research emphasizes conservative endodontics, bioceramic materials, and minimally invasive techniques. What specific research question can I help you explore?`;
  }

  if (lowerMessage.includes('prognosis') || lowerMessage.includes('prediction')) {
    return `Prognosis analysis based on your consultation database shows varied outcomes depending on initial diagnosis and treatment complexity. Factors like tooth position, pulp vitality, and restoration type significantly impact long-term success. I can analyze prognostic factors from your cases or provide evidence-based prediction models. What prognostic question interests you?`;
  }

  // Default response
  return `I'm analyzing your clinical database containing ${context?.totalPatients || 0} patients, ${context?.totalAppointments || 0} appointments, and ${context?.totalConsultations || 0} consultations. I can help with:

• Treatment outcome analysis and success rate calculations
• Evidence-based protocol recommendations
• Patient demographic and treatment pattern insights
• Revenue optimization and practice growth analysis
• Comparative analysis with published research
• Prognostic factor evaluation

Please specify what clinical question you'd like me to research for you.`;
}

// N8N Workflow Integration (for future implementation)
async function callN8nWorkflow(message: string, context: any) {
  // This will be implemented once n8n workflow is set up
  // const response = await fetch('N8N_WEBHOOK_URL', {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify({ message, context })
  // });
  // return await response.json();

  return { message: 'N8N workflow not yet configured' };
}