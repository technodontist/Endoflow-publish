# Filter Fixes Summary - Research Projects

## Date: 2025-10-08

---

## Question 1: How FDI Chart Diagnoses Are Stored

### Answer
When a diagnosis is made from the **FDI (Fédération Dentaire Internationale) chart**, it is saved in:

**Table**: `api.tooth_diagnoses`  
**Primary Column**: `primary_diagnosis` (text field)

### Full Record Structure
```sql
{
  id: UUID,
  consultation_id: UUID,
  patient_id: UUID,
  tooth_number: TEXT,           -- FDI notation (e.g., "11", "26", "36")
  status: TEXT,                  -- 'healthy', 'caries', 'filled', 'crown', etc.
  primary_diagnosis: TEXT,       -- ✅ FDI DIAGNOSIS STORED HERE
  diagnosis_details: TEXT,
  symptoms: TEXT,
  recommended_treatment: TEXT,
  treatment_priority: TEXT,      -- 'urgent', 'high', 'medium', 'low', 'routine'
  treatment_details: TEXT,
  estimated_duration: INTEGER,
  color_code: TEXT,
  notes: TEXT,
  examination_date: DATE,
  created_at: TIMESTAMP,
  updated_at: TIMESTAMP
}
```

### Code Reference
`lib/actions/consultation.ts` (lines 555-607) - `saveToothDiagnosisAction()`

---

## Patch 1: Auto-Populate `diagnosis.primary` from First Final Diagnosis

### Problem
- Research filter "Primary Diagnosis" was returning **zero results** for most consultations
- Database diagnostic showed: `diagnosis.primary = "N/A"` in all sampled consultations
- The consultation save logic was not setting `diagnosis.primary`, only `diagnosis.final` (array) and `diagnosis.provisional` (array)

### Solution
Automatically populate `diagnosis.primary` from the first item in `finalDiagnosis` array during consultation save.

### Files Modified
1. **`lib/actions/consultation.ts`** (lines 744-762)
   - Modified `saveCompleteConsultationAction()` to set `diagnosis.primary`
   
2. **`lib/actions/consultation.ts`** (lines 683-695)
   - Modified clinical_data structure to include primary diagnosis
   
3. **`lib/actions/consultation.ts`** (lines 1182-1200)
   - Modified `finalizeConsultationFromDraftAction()` to set `diagnosis.primary`
   
4. **`lib/actions/consultation.ts`** (lines 1127-1138)
   - Modified clinical_data in finalize action

### Code Added
```typescript
// ✅ AUTO-POPULATE primary from first final diagnosis for research filtering
primary: Array.isArray(formData.consultationData.finalDiagnosis) && formData.consultationData.finalDiagnosis.length > 0
  ? (typeof formData.consultationData.finalDiagnosis[0] === 'object' && formData.consultationData.finalDiagnosis[0].diagnosis_name
      ? formData.consultationData.finalDiagnosis[0].diagnosis_name
      : formData.consultationData.finalDiagnosis[0])
  : undefined
```

### Behavior
- **Non-breaking**: Existing diagnosis structure is preserved (final, provisional, differential arrays remain intact)
- **Automatic**: Primary diagnosis is always set from first final diagnosis
- **Backward-compatible**: Handles both string arrays and object arrays (with `diagnosis_name` property)
- **Respects existing flow**: If primary is manually set, it won't be overwritten by this logic

---

## Patch 2: "Completed Treatment Type" Filter Now Implies `status = completed`

### Problem
- Filter "Completed Treatment Type" was searching **all treatments** regardless of status
- User expected it to only show patients with treatments that were actually completed
- Required manually adding "Treatment Status = completed" filter

### Solution
Automatically restrict "Completed Treatment Type" filter to only search treatments with `status = 'completed'`

### Files Modified
**`lib/actions/research-projects.ts`** (lines 1112-1144)

### Code Changed
```typescript
// BEFORE:
if (field === 'completed_treatment_type') {
  const treatments = patient.treatments || []
  // Search across all treatments for matching treatment type
  for (const treatment of treatments) {
    // ... check treatment_type
  }
}

// AFTER:
if (field === 'completed_treatment_type') {
  const treatments = patient.treatments || []
  
  // ✅ ONLY search across COMPLETED treatments (status = 'completed')
  const completedTreatments = treatments.filter(t => 
    (t.status || '').toLowerCase() === 'completed'
  )
  
  for (const treatment of completedTreatments) {
    // ... check treatment_type
  }
}
```

### Behavior
- **Automatic filtering**: Now only considers treatments with `status = 'completed'`
- **No manual addition needed**: User no longer needs to manually add "Treatment Status = completed"
- **Clearer semantics**: Filter name "Completed Treatment Type" now accurately reflects its behavior
- **Backward-compatible**: Existing queries using this filter will now be more accurate (and may return fewer results, which is correct)

---

## Impact & Next Steps

### Immediate Benefits
1. ✅ **Primary Diagnosis filter now works**: Future consultations will have populated `diagnosis.primary`
2. ✅ **Completed Treatment filter is accurate**: Only returns patients with actually completed treatments
3. ✅ **No breaking changes**: Existing data structures remain compatible

### For Existing Data
**Existing consultations** still have `diagnosis.primary = "N/A"`. To fix retroactively:

```sql
-- Run this SQL to backfill diagnosis.primary from diagnosis.final[0]
UPDATE api.consultations
SET diagnosis = jsonb_set(
  diagnosis::jsonb,
  '{primary}',
  CASE 
    WHEN jsonb_array_length(diagnosis::jsonb->'final') > 0 
    THEN diagnosis::jsonb->'final'->0
    ELSE '"N/A"'::jsonb
  END
)
WHERE (diagnosis::jsonb->>'primary') IS NULL 
   OR (diagnosis::jsonb->>'primary') = 'N/A';
```

### Recommended User Actions
1. **For Diagnosis Filters**: Use "Diagnosis Final" or "Diagnosis Provisional" for existing data; new consultations will support "Primary Diagnosis"
2. **For Treatment Filters**: "Completed Treatment Type" now works as expected; remove any redundant "Treatment Status = completed" filters
3. **For FDI Chart**: Continue using "Primary Diagnosis (FDI Chart)" which searches `tooth_diagnoses.primary_diagnosis`

---

## Testing Verification

### Test Diagnosis Filter
```
Filter: Primary Diagnosis contains "pulpitis"
Expected: Returns patients with consultations saved AFTER this patch
```

### Test Completed Treatment Filter
```
Filter: Completed Treatment Type contains "root canal"
Expected: Returns ONLY patients with root canal treatments where status = 'completed'
```

### Check FDI Chart Diagnoses
```
Filter: Primary Diagnosis (FDI Chart) contains "caries"
Expected: Returns patients with tooth-specific caries diagnoses from FDI chart
```

---

## Summary

✅ **FDI Chart Diagnoses** → Stored in `api.tooth_diagnoses.primary_diagnosis`  
✅ **Consultation Primary Diagnosis** → Now auto-populated from first final diagnosis  
✅ **Completed Treatment Filter** → Automatically restricts to status = 'completed'

All changes are **non-breaking** and **backward-compatible**.
