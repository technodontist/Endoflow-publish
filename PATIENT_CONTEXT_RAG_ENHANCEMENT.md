# Patient Context Enhancement for RAG System

## Current State Analysis

### What's Currently Implemented
The Self-Learning Assistant has **basic patient context linking**:
- ✅ Patient search and selection
- ✅ Manual input fields (tooth number, diagnosis, treatment)
- ✅ Patient context passed to AI prompts
- ✅ AI tailors responses based on manually entered context

### Critical Gap Identified
**The system is NOT fetching actual patient medical data from the database!**

Currently, when a dentist links a patient:
- ❌ Only patient ID and name are retrieved
- ❌ No consultation history is fetched
- ❌ No diagnosis records are loaded
- ❌ No treatment history (planned/done) is retrieved
- ❌ No follow-up information is included
- ❌ No medical history is accessed

**The dentist must manually type in diagnosis and treatment information**, which defeats the purpose of having a comprehensive patient database.

## The Problem

When asking the RAG system about treatment options for a linked patient, the AI should know:

1. **Consultation History**
   - All previous consultations with dates
   - Chief complaints from each visit
   - Pain assessments and clinical findings

2. **Diagnosis Records**
   - All tooth-level diagnoses from the `tooth_diagnoses` table
   - Primary and secondary diagnoses
   - Severity and status

3. **Treatment History**
   - Completed treatments from `treatments` table
   - Planned treatments from `consultation.treatment_plan`
   - Treatment status (planned, in-progress, completed)

4. **Follow-up Information**
   - Scheduled follow-ups
   - Follow-up instructions from previous consultations
   - Outcomes of follow-up visits

5. **Medical History**
   - Allergies
   - Medications
   - Systemic conditions
   - Contraindications

## Proposed Solution

### Architecture Enhancement

```
┌─────────────────────────────────────┐
│ Dentist Links Patient               │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│ Fetch Complete Patient Context      │
│ - Consultations (all)               │
│ - Tooth Diagnoses (all)             │
│ - Treatment History (completed)     │
│ - Treatment Plans (planned)         │
│ - Follow-ups (scheduled/completed)  │
│ - Medical History                   │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│ Structure Patient Medical Context   │
│ - Timeline of care                  │
│ - Active diagnoses                  │
│ - Ongoing treatments                │
│ - Relevant medical conditions       │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│ Combine with RAG Documents          │
│ - Medical literature (RAG)          │
│ - Patient medical history (DB)      │
│ - Current clinical context          │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│ AI Generates Personalized Response  │
│ - Evidence-based (from RAG)         │
│ - Patient-specific (from DB)        │
│ - Contextually relevant             │
└─────────────────────────────────────┘
```

## Implementation Plan

### Phase 1: Create Patient Context Fetcher
**File**: `lib/actions/patient-context.ts` (NEW)

Create a comprehensive function that fetches ALL relevant patient data:

```typescript
export interface PatientMedicalContext {
  patientId: string
  patientName: string
  
  // Consultation History
  consultations: {
    id: string
    date: string
    chiefComplaint: string
    diagnosis: string
    treatmentPlan: string
    dentistName: string
  }[]
  
  // Tooth-level Diagnoses
  toothDiagnoses: {
    toothNumber: string
    diagnosis: string
    treatment: string
    status: string
    date: string
  }[]
  
  // Treatment History
  completedTreatments: {
    toothNumber: string
    treatment: string
    date: string
    outcome: string
  }[]
  
  plannedTreatments: {
    toothNumber: string
    treatment: string
    priority: string
    notes: string
  }[]
  
  // Follow-ups
  followUps: {
    date: string
    instructions: string
    status: string
  }[]
  
  // Medical History
  medicalHistory: {
    allergies: string[]
    medications: string[]
    conditions: string[]
    contraindications: string[]
  }
  
  // Summary Statistics
  summary: {
    totalConsultations: number
    activeIssues: number
    pendingTreatments: number
    lastVisitDate: string
  }
}
```

### Phase 2: Enhance RAG Service
**File**: `lib/services/rag-service.ts`

Add patient medical context to RAG queries:

```typescript
export interface EnhancedRAGQueryParams extends RAGQueryParams {
  patientMedicalContext?: PatientMedicalContext
}

export function formatPatientMedicalContext(context: PatientMedicalContext): string {
  return `
PATIENT MEDICAL CONTEXT:

Patient: ${context.patientName} (ID: ${context.patientId})

CONSULTATION HISTORY (${context.consultations.length} total):
${context.consultations.map(c => `
- ${c.date}: ${c.chiefComplaint}
  Diagnosis: ${c.diagnosis}
  Treatment Plan: ${c.treatmentPlan}
  Provider: ${c.dentistName}
`).join('\n')}

ACTIVE DIAGNOSES:
${context.toothDiagnoses.filter(d => d.status === 'active').map(d => `
- Tooth ${d.toothNumber}: ${d.diagnosis}
  Recommended: ${d.treatment}
  Date: ${d.date}
`).join('\n')}

COMPLETED TREATMENTS:
${context.completedTreatments.map(t => `
- Tooth ${t.toothNumber}: ${t.treatment} (${t.date})
  Outcome: ${t.outcome}
`).join('\n')}

PLANNED TREATMENTS:
${context.plannedTreatments.map(t => `
- Tooth ${t.toothNumber}: ${t.treatment}
  Priority: ${t.priority}
  Notes: ${t.notes}
`).join('\n')}

MEDICAL HISTORY:
- Allergies: ${context.medicalHistory.allergies.join(', ') || 'None reported'}
- Medications: ${context.medicalHistory.medications.join(', ') || 'None'}
- Conditions: ${context.medicalHistory.conditions.join(', ') || 'None'}
- Contraindications: ${context.medicalHistory.contraindications.join(', ') || 'None'}

SUMMARY:
- Total Consultations: ${context.summary.totalConsultations}
- Active Issues: ${context.summary.activeIssues}
- Pending Treatments: ${context.summary.pendingTreatments}
- Last Visit: ${context.summary.lastVisitDate}
`
}
```

### Phase 3: Update Self-Learning Actions
**File**: `lib/actions/self-learning.ts`

Modify all actions to automatically fetch full patient context:

```typescript
export async function searchTreatmentOptionsAction(
  diagnosis: string,
  patientContext?: {
    patientId?: string
    patientName?: string
    // ... other optional manual fields
  }
) {
  // If patient is linked, fetch complete medical context
  let patientMedicalContext: PatientMedicalContext | undefined
  
  if (patientContext?.patientId) {
    console.log('🔍 [SELF-LEARNING] Fetching complete patient medical context...')
    const contextResult = await getPatientFullContext(patientContext.patientId)
    
    if (contextResult.success && contextResult.data) {
      patientMedicalContext = contextResult.data
      console.log(`✅ [SELF-LEARNING] Loaded patient context: ${patientMedicalContext.summary.totalConsultations} consultations, ${patientMedicalContext.summary.activeIssues} active issues`)
    }
  }
  
  // Perform RAG with enhanced patient context
  const ragResult = await performRAGQuery({
    query: searchQuery,
    diagnosisFilter: [diagnosis.toLowerCase().replace(/\s+/g, '_')],
    matchThreshold: 0.5,
    matchCount: 10,
    patientMedicalContext // Pass to RAG
  })
  
  // Build enhanced AI prompt with full patient context
  const patientInfo = patientMedicalContext 
    ? formatPatientMedicalContext(patientMedicalContext)
    : (patientContext?.patientName ? `Basic patient context: ${patientContext.patientName}` : '')
  
  // Rest of the logic...
}
```

### Phase 4: Update UI to Display Patient Context
**File**: `components/dentist/self-learning-assistant.tsx`

Add a patient context summary display:

```typescript
// Fetch patient medical context when patient is selected
const [patientMedicalContext, setPatientMedicalContext] = useState<PatientMedicalContext | null>(null)

useEffect(() => {
  if (patientContext.patientId) {
    fetchPatientMedicalContext()
  } else {
    setPatientMedicalContext(null)
  }
}, [patientContext.patientId])

const fetchPatientMedicalContext = async () => {
  const result = await getPatientFullContext(patientContext.patientId!)
  if (result.success && result.data) {
    setPatientMedicalContext(result.data)
  }
}

// Display patient context summary
{patientMedicalContext && (
  <div className="bg-blue-50 p-4 rounded-lg space-y-3 mt-4">
    <h4 className="font-semibold text-blue-900">Patient Medical Summary</h4>
    
    <div className="grid grid-cols-4 gap-4">
      <div className="text-center">
        <div className="text-2xl font-bold text-blue-700">
          {patientMedicalContext.summary.totalConsultations}
        </div>
        <div className="text-xs text-blue-600">Total Visits</div>
      </div>
      
      <div className="text-center">
        <div className="text-2xl font-bold text-orange-700">
          {patientMedicalContext.summary.activeIssues}
        </div>
        <div className="text-xs text-orange-600">Active Issues</div>
      </div>
      
      <div className="text-center">
        <div className="text-2xl font-bold text-purple-700">
          {patientMedicalContext.summary.pendingTreatments}
        </div>
        <div className="text-xs text-purple-600">Pending Treatments</div>
      </div>
      
      <div className="text-center">
        <div className="text-sm font-medium text-gray-700">
          {new Date(patientMedicalContext.summary.lastVisitDate).toLocaleDateString()}
        </div>
        <div className="text-xs text-gray-600">Last Visit</div>
      </div>
    </div>
    
    {/* Recent Diagnoses */}
    {patientMedicalContext.toothDiagnoses.length > 0 && (
      <div>
        <h5 className="text-sm font-medium text-blue-800 mb-2">Active Diagnoses</h5>
        <div className="space-y-1">
          {patientMedicalContext.toothDiagnoses.slice(0, 3).map((d, idx) => (
            <div key={idx} className="text-xs bg-white p-2 rounded">
              <span className="font-medium">Tooth {d.toothNumber}:</span> {d.diagnosis}
              <span className="text-gray-500 ml-2">→ {d.treatment}</span>
            </div>
          ))}
        </div>
      </div>
    )}
    
    {/* Medical Alerts */}
    {(patientMedicalContext.medicalHistory.allergies.length > 0 || 
      patientMedicalContext.medicalHistory.contraindications.length > 0) && (
      <div className="bg-yellow-50 border border-yellow-200 p-2 rounded">
        <div className="flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5" />
          <div className="text-xs">
            {patientMedicalContext.medicalHistory.allergies.length > 0 && (
              <div><span className="font-medium">Allergies:</span> {patientMedicalContext.medicalHistory.allergies.join(', ')}</div>
            )}
            {patientMedicalContext.medicalHistory.contraindications.length > 0 && (
              <div><span className="font-medium">Contraindications:</span> {patientMedicalContext.medicalHistory.contraindications.join(', ')}</div>
            )}
          </div>
        </div>
      </div>
    )}
  </div>
)}
```

## Benefits of This Enhancement

### For AI Quality
1. **Evidence-Based + Patient-Specific**: Combines medical literature with real patient data
2. **Contextually Aware**: Knows what has been tried, what worked, what didn't
3. **Continuity of Care**: Understands the patient's treatment journey
4. **Safety**: Aware of allergies, contraindications, and medical history

### For Dentists
1. **No Manual Entry**: Automatic context from database
2. **Comprehensive View**: All patient data in one place
3. **Better Decisions**: Informed by complete patient history
4. **Time Saving**: No need to review records manually

### For Patient Care
1. **Personalized Recommendations**: Based on actual patient history
2. **Safer Treatment Plans**: Considers medical history and contraindications
3. **Treatment Continuity**: AI knows what's planned, what's done, what's pending
4. **Follow-up Aware**: Considers outcomes of previous treatments

## Example Use Cases

### Use Case 1: Root Canal Treatment for Patient with Diabetes

**Without Enhancement:**
```
Dentist: "What's the best approach for root canal treatment?"
AI: "Here are general RCT protocols from the literature..."
```

**With Enhancement:**
```
Dentist links patient John Smith (who has diabetes and previous failed RCT on tooth 16)

AI Response:
"Based on medical literature and John Smith's medical history:

PATIENT CONSIDERATIONS:
- History: Type 2 Diabetes (controlled with Metformin)
- Previous Treatment: RCT on tooth 16 (2023-01-15) - failed due to incomplete debridement
- Active Issue: Tooth 36 - Irreversible pulpitis (diagnosed 2024-01-10)
- Pending: RCT on tooth 36 scheduled

RECOMMENDED APPROACH FOR TOOTH 36:
Given John's diabetic status and previous RCT complication, I recommend:

1. **Pre-treatment glucose control verification** (Evidence: Diabetes patients have 2.3x higher endodontic failure rates with poor glucose control [Source 1])

2. **Extended irrigation protocol** (Based on previous incomplete debridement on tooth 16, use 2.5% NaOCl with ultrasonic activation for 5 minutes minimum)

3. **Antibiotic prophylaxis consideration** (John's diabetes increases infection risk; consider Amoxicillin 2g 1hr pre-op [Source 2])

4. **Modified obturation timing** (Given diabetic healing patterns, consider calcium hydroxide dressing for 2 weeks before final obturation [Source 3])

TREATMENT PLAN MODIFICATION:
- Schedule 2-visit RCT instead of single visit
- Plan follow-up at 1 week, 1 month, 6 months
- Coordinate with primary physician for glucose monitoring
- Document thoroughly given previous failure

This approach is tailored to John's specific case and supported by evidence."
```

### Use Case 2: Treatment Planning for Patient with Multiple Active Issues

**Without Enhancement:**
```
Dentist: "What treatments should I prioritize?"
AI: "Here are standard treatment sequencing guidelines..."
```

**With Enhancement:**
```
Dentist links patient Sarah Johnson

AI Response:
"Treatment prioritization for Sarah Johnson:

PATIENT OVERVIEW:
- 3 consultations in past 6 months
- 5 active diagnoses across multiple teeth
- 2 treatments completed, 3 pending
- Last visit: 2024-01-05 (Follow-up on tooth 12 extraction)

ACTIVE ISSUES BY PRIORITY:

HIGH PRIORITY (Urgent - Pain/Infection):
1. Tooth 36: Acute apical abscess (diagnosed 2024-01-10)
   → Immediate: Drainage + antibiotics, RCT within 48 hours
   → Evidence: Delay >72hrs increases risk of spread [Source 1]

MEDIUM PRIORITY (Symptomatic):
2. Tooth 26: Deep caries with reversible pulpitis (diagnosed 2023-12-15)
   → Schedule within 2 weeks: Deep filling with IPC
   → Risk: May progress to irreversible pulpitis [Source 2]

LOW PRIORITY (Asymptomatic):
3. Tooth 46: Chronic apical periodontitis (diagnosed 2023-11-20)
   → Can schedule after acute issues resolved
   → Note: Has been stable for 2 months

COMPLETED (For Context):
- Tooth 12: Extraction (2023-12-20) - healing well per 2024-01-05 follow-up
- Tooth 14: Composite restoration (2023-11-01) - no complications

SEQUENCING RECOMMENDATION:
1. Week 1: Emergency RCT on tooth 36 (urgent)
2. Week 3: Deep restoration on tooth 26 (prevent progression)
3. Week 6: RCT on tooth 46 (elective)
4. Week 8: Implant planning for tooth 12 site (if patient desires)

CONTRAINDICATIONS TO CONSIDER:
- Sarah is on Warfarin for atrial fibrillation
- INR check required before any surgical procedures
- Coordinate with cardiologist for implant planning
- Avoid NSAIDs, use Tylenol for pain management

This plan addresses Sarah's specific clinical situation with evidence-based prioritization."
```

## Database Schema Requirements

All required tables already exist:
- ✅ `consultations` - Patient consultation records
- ✅ `tooth_diagnoses` - Tooth-level diagnoses
- ✅ `treatments` - Treatment history
- ✅ `patients` - Patient demographics
- ✅ `appointments` - Appointment history

**No schema changes required!** We just need to fetch and structure the data properly.

## Implementation Files

1. **New File**: `lib/actions/patient-context.ts`
   - `getPatientFullContext()` - Main fetcher
   - `PatientMedicalContext` interface

2. **Update**: `lib/services/rag-service.ts`
   - Add `patientMedicalContext` parameter to RAG queries
   - Add `formatPatientMedicalContext()` helper

3. **Update**: `lib/actions/self-learning.ts`
   - Modify all 3 actions to fetch full patient context
   - Enhance AI prompts with complete patient data

4. **Update**: `components/dentist/self-learning-assistant.tsx`
   - Add patient medical context state
   - Display patient summary when linked
   - Show active issues, pending treatments, medical alerts

## Testing Plan

### Test Scenarios

1. **Patient with No History**
   - Link new patient
   - Verify graceful handling of empty context
   - Ensure AI provides general guidance

2. **Patient with Single Consultation**
   - Link patient with 1 consultation
   - Verify consultation details appear in context
   - Check AI references the consultation in response

3. **Patient with Complex History**
   - Link patient with multiple consultations, diagnoses, treatments
   - Verify all data is fetched correctly
   - Confirm AI generates comprehensive, context-aware response

4. **Patient with Medical Contraindications**
   - Link patient with allergies/contraindications
   - Verify medical alerts displayed in UI
   - Confirm AI warnings about contraindications in response

5. **Performance Test**
   - Link patient and measure fetch time
   - Ensure context fetching doesn't slow down UI
   - Verify RAG query performance with large patient context

## Success Metrics

- ✅ Patient medical context fetches in <2 seconds
- ✅ AI responses reference actual patient history
- ✅ AI provides patient-specific warnings and recommendations
- ✅ UI displays patient summary accurately
- ✅ Dentists report improved relevance of AI responses
- ✅ Reduction in manual context entry by dentists

## Future Enhancements

1. **Real-time Context Updates**: Update context when new consultations are saved
2. **Context Caching**: Cache patient context to avoid repeated DB queries
3. **Context Versioning**: Track which context version was used for each query
4. **Timeline Visualization**: Visual timeline of patient's treatment journey
5. **Predictive Analytics**: AI suggests next steps based on patient trajectory

## Conclusion

The current patient context feature is a **great foundation** but is missing the **critical piece**: actual patient medical data from the database.

This enhancement transforms the RAG system from:
- **"General medical knowledge lookup"**

To:
- **"Personalized clinical decision support system with complete patient context"**

By automatically fetching and structuring all patient data (consultations, diagnoses, treatments, medical history), the AI can provide truly personalized, evidence-based recommendations that consider the patient's complete medical journey.

This is **the missing link** that will make the Self-Learning Assistant genuinely useful for real-world clinical decision-making.
