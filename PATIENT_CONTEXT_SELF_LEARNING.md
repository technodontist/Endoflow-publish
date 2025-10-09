# Patient Context Feature for Self-Learning Assistant

## Overview
This document describes the implementation of patient context linking in the Self-Learning Assistant feature. This enhancement allows dentists to optionally link their learning queries to specific patients, enabling personalized AI responses tailored to individual patient cases.

## Feature Summary

The Self-Learning Assistant now supports an **optional** patient context feature that:
- Allows dentists to link learning queries to specific patients
- Provides patient-specific, personalized AI responses
- Maintains patient privacy and data security
- Works seamlessly with existing functionality

## Implementation Components

### 1. Patient Context Interface
**File**: `components/dentist/self-learning-assistant.tsx`

```typescript
interface PatientContext {
  patientId: string | null
  patientName: string | null
  toothNumber: string | null
  diagnosis: string | null
  treatment: string | null
  consultationId: string | null
}
```

### 2. UI Components

#### Patient Context Card
- **Collapsible card** with expand/collapse functionality
- **Patient search** with real-time autocomplete
- **Optional fields**:
  - Patient selection (required to enable context)
  - Tooth number
  - Diagnosis context
  - Treatment context
  - Consultation ID (for future linking)

#### Search Functionality
- Real-time patient search with debouncing (300ms)
- Searches across: first name, last name, email
- Displays up to 10 matching patients
- Shows patient name, email, and phone

#### Visual Indicators
- **Blue border** indicates patient context card
- **"Optional" badge** clarifies feature is not required
- **Clear button** to remove patient linkage
- **Alert message** confirms AI responses will be personalized

### 3. Server Actions Update

#### Modified Actions
All three main self-learning actions now accept optional patient context:

1. **`searchTreatmentOptionsAction`**
   - Searches for treatment options with patient-specific tailoring
   - Parameters: `diagnosis: string`, `patientContext?: {...}`

2. **`getTreatmentStepsAction`**
   - Provides step-by-step procedures customized to patient case
   - Parameters: `treatmentName: string`, `diagnosis?: string`, `patientContext?: {...}`

3. **`askTreatmentQuestionAction`**
   - Answers questions with patient-specific considerations
   - Parameters: `question: string`, `patientContext?: {...}`

### 4. AI Prompt Enhancement

When patient context is provided, the AI system instructions are enhanced with:

```typescript
const patientInfo = patientContext?.patientName ? `

PATIENT CONTEXT:
- Patient: ${patientContext.patientName}
- Tooth: ${patientContext.toothNumber || 'N/A'}
- Diagnosis: ${patientContext.diagnosis || 'N/A'}
- Planned Treatment: ${patientContext.treatment || 'N/A'}

IMPORTANT: Tailor your answer to this specific patient case. 
Provide patient-specific guidance and considerations.` : ''
```

This context is appended to the system instruction, guiding the AI to:
- Consider the specific patient case
- Provide tailored recommendations
- Include patient-specific warnings and tips
- Suggest approaches suited to the patient's condition

## Data Flow

```
┌────────────────────────────────┐
│ Dentist Opens Learning Tab     │
└──────────────┬─────────────────┘
               │
               ▼
┌────────────────────────────────┐
│ Optional: Click Patient Context│
│ Card to Expand                  │
└──────────────┬─────────────────┘
               │
               ▼
┌────────────────────────────────┐
│ Optional: Search and Select     │
│ Patient                         │
└──────────────┬─────────────────┘
               │
               ▼
┌────────────────────────────────┐
│ Optional: Add Tooth, Diagnosis, │
│ Treatment Context               │
└──────────────┬─────────────────┘
               │
               ▼
┌────────────────────────────────┐
│ Perform Learning Query          │
│ (Search/Steps/Chat)             │
└──────────────┬─────────────────┘
               │
               ▼
┌────────────────────────────────┐
│ Build Patient Context Object    │
│ (if patient selected)           │
└──────────────┬─────────────────┘
               │
               ▼
┌────────────────────────────────┐
│ Call Server Action with Context │
└──────────────┬─────────────────┘
               │
               ▼
┌────────────────────────────────┐
│ Server: Enhance AI Prompt with  │
│ Patient Context                 │
└──────────────┬─────────────────┘
               │
               ▼
┌────────────────────────────────┐
│ AI: Generate Patient-Specific   │
│ Response                        │
└──────────────┬─────────────────┘
               │
               ▼
┌────────────────────────────────┐
│ Display Tailored Response to    │
│ Dentist                         │
└────────────────────────────────┘
```

## Usage Examples

### Example 1: Treatment Search with Patient Context

**Scenario**: Dentist needs to learn about RCT for a specific patient

1. **Select Patient**: "John Smith"
2. **Add Context**:
   - Tooth: 16
   - Diagnosis: Irreversible Pulpitis
   - Treatment: Root Canal Treatment
3. **Search**: "Pulpitis"

**AI Response**:
> Based on the literature and considering patient John Smith's case (Tooth 16, Irreversible Pulpitis):
> 
> **Recommended Treatments:**
> 1. **Root Canal Therapy** (Recommended for Tooth 16)
>    - Success rate: 95% for maxillary first molars
>    - Duration: 90-120 minutes
>    - Difficulty: Intermediate
>    - **Note**: Given the irreversible pulpitis diagnosis, immediate RCT is indicated to preserve the tooth...

### Example 2: Procedure Steps with Patient Context

**Scenario**: Learning RCT steps for a specific patient

1. **Select Patient**: "Jane Doe"
2. **Add Context**:
   - Tooth: 36
   - Diagnosis: Necrotic Pulp
3. **Select Treatment**: "Root Canal Treatment"

**AI Response**:
> Step-by-step RCT protocol for Jane Doe (Tooth 36 - Necrotic Pulp):
> 
> **Step 1: Access Cavity Preparation**
> - For mandibular first molars like tooth 36, ensure occlusal access preserves marginal ridges
> - **Patient-specific consideration**: Given necrotic pulp, expect minimal bleeding during access
> - **Tip**: Use rubber dam isolation to prevent contamination...

### Example 3: General Question without Patient Context

**Scenario**: General learning query without patient specifics

1. **No patient selected**
2. **Ask**: "What are the indications for RCT?"

**AI Response**:
> Root Canal Treatment is indicated in the following scenarios:
> 
> 1. **Irreversible Pulpitis**
>    - Persistent severe pain
>    - Hot/cold sensitivity that lingers
>    - Spontaneous pain
> ...

## Privacy and Security

### Data Handling
- Patient context is **optional** - queries work without it
- Patient data is passed to AI only for the duration of the request
- No patient data is stored in learning query logs (currently)
- Patient context is not saved in browser localStorage
- Cleared when browser tab is closed or user clicks "Clear"

### Future Enhancement: Query Logging
For audit trails and patient timeline integration, future implementation will:
- Log learning queries linked to patients in database
- Store: query text, patient ID, timestamp, query type
- Display in patient timeline as "Learning Activity"
- Allow dentists to review what they researched for each patient

## API Changes

### Before (No Patient Context)
```typescript
await searchTreatmentOptionsAction(diagnosis)
await getTreatmentStepsAction(treatment, diagnosis)
await askTreatmentQuestionAction(question)
```

### After (With Optional Patient Context)
```typescript
const patientCtx = patientContext.patientId ? {
  patientId: patientContext.patientId,
  patientName: patientContext.patientName || undefined,
  toothNumber: patientContext.toothNumber || undefined,
  diagnosis: patientContext.diagnosis || undefined,
  treatment: patientContext.treatment || undefined
} : undefined

await searchTreatmentOptionsAction(diagnosis, patientCtx)
await getTreatmentStepsAction(treatment, diagnosis, patientCtx)
await askTreatmentQuestionAction(question, patientCtx)
```

## Benefits

### For Dentists
1. **Personalized Learning**: Get answers tailored to specific patient cases
2. **Clinical Context**: Learn while considering real patient scenarios
3. **Better Decision Making**: Understand how treatments apply to individual cases
4. **Efficient Workflow**: Link learning to active patients directly

### For Patient Care
1. **Evidence-Based**: Treatments researched specifically for patient conditions
2. **Customized Plans**: Learning considers patient-specific factors
3. **Improved Outcomes**: Better-informed treatment decisions
4. **Documentation**: Future audit trail of research performed for patients

## Testing Checklist

- [ ] Patient search returns correct results
- [ ] Patient context card expands/collapses
- [ ] Patient selection populates context correctly
- [ ] Tooth number, diagnosis, treatment fields work
- [ ] Clear button removes all patient context
- [ ] Queries work WITHOUT patient context (backward compatible)
- [ ] Queries work WITH patient context
- [ ] AI responses are tailored when context provided
- [ ] AI responses are general when no context
- [ ] Patient data is not persisted inappropriately
- [ ] UI displays patient context indicators correctly

## Future Enhancements

### 1. Database Logging (Planned)
Create table: `self_learning_queries`
```sql
CREATE TABLE api.self_learning_queries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dentist_id UUID REFERENCES api.users(id),
  patient_id UUID REFERENCES api.patients(id),
  query_type TEXT, -- 'search', 'steps', 'chat'
  query_text TEXT,
  tooth_number TEXT,
  diagnosis_context TEXT,
  treatment_context TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 2. Patient Timeline Integration
- Show learning queries in patient timeline
- Display: "Dr. Smith researched Root Canal Treatment for Tooth 16"
- Link to view the learning session details

### 3. Consultation Integration
- Pre-fill patient context from active consultation
- Link learning queries to consultation records
- Show relevant learning in consultation summary

### 4. Quick Actions
- "Research this treatment" button in consultation
- Auto-populate context from current consultation state
- Seamless transition between consultation and learning

### 5. Collaboration Features
- Share patient-specific learning sessions with colleagues
- Team discussions on patient cases
- Annotate learning content with patient notes

## Related Files

- **Component**: `components/dentist/self-learning-assistant.tsx`
- **Actions**: `lib/actions/self-learning.ts`
- **Similar Pattern**: `components/consultation/AppointmentRequestDialog.tsx`
- **Database**: `lib/supabase/client.ts`

## Migration Notes

- ✅ Backward compatible - existing queries work without changes
- ✅ No database schema changes required (for basic feature)
- ✅ Optional feature - does not affect users who don't use it
- ⚠️ Database logging (planned) will require schema update

## Conclusion

The patient context feature transforms the Self-Learning Assistant from a general knowledge tool into a personalized clinical decision support system. By optionally linking learning queries to specific patients, dentists can:

- Get tailored, patient-specific guidance
- Make better-informed treatment decisions
- Learn in the context of real clinical cases
- Maintain a record of research performed for each patient (future)

This feature exemplifies the power of combining RAG-based medical knowledge with real-time patient context to deliver truly personalized AI assistance in dental practice.
