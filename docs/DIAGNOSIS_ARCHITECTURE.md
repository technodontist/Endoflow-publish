# Diagnosis Data Architecture - Complete Flow Explanation

## 🎯 Your Question Answered

> **"From the consultation when we save a diagnosis for a patient from the FDI chart diagnosis and treatment plan - it is linked to tooth no. status back and forth with the appointment is which diagnosis? And what are the diagnoses filtered in the research project dashboard? Cause I can't find many diagnosis?"**

## 📊 The Answer: TWO Different Diagnosis Systems

Your ENDOFLOW system has **TWO SEPARATE** diagnosis tracking systems:

### **System 1: Overall Consultation Diagnosis** (General/Whole Mouth)
- **Table**: `api.consultations`
- **Column**: `diagnosis` (JSONB/TEXT)
- **Scope**: Whole patient, general diagnosis
- **NOT linked to specific teeth**

### **System 2: Tooth-Specific Diagnosis** (FDI Chart)
- **Table**: `api.tooth_diagnoses`
- **Column**: `primary_diagnosis` (TEXT)
- **Scope**: Individual teeth (Tooth #11, #16, #32, etc.)
- **Linked to consultation_id**

---

## 🔄 Complete Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                        DENTIST CLINICAL COCKPIT WORKFLOW                              │
└─────────────────────────────────────────────────────────────────────────────────────┘

STEP 1: PATIENT CONSULTATION
   ↓
   Dentist opens Clinical Cockpit for Patient
   ↓
   Creates new Consultation record
   ↓
   ┌──────────────────────────────────────────────┐
   │  TABLE: api.consultations                    │
   │  ────────────────────────────────────────    │
   │  id: UUID                                    │
   │  patient_id: UUID                            │
   │  dentist_id: UUID                            │
   │  status: 'draft' → 'completed'               │
   │                                              │
   │  diagnosis: {                   ← JSONB      │
   │    "primary": "Moderate Caries",             │
   │    "provisional": ["Pulpitis"],              │
   │    "final": ["Irreversible Pulpitis"]        │
   │  }                                           │
   │                                              │
   │  treatment_plan: {              ← JSONB      │
   │    "plan": [                                 │
   │      "Root Canal Treatment",                 │
   │      "Crown Placement"                       │
   │    ]                                         │
   │  }                                           │
   └──────────────────────────────────────────────┘

STEP 2: FDI TOOTH CHART INTERACTION
   ↓
   Dentist clicks on specific tooth (e.g., Tooth #16)
   ↓
   Adds tooth-specific diagnosis
   ↓
   ┌──────────────────────────────────────────────┐
   │  TABLE: api.tooth_diagnoses                  │
   │  ────────────────────────────────────────    │
   │  id: UUID                                    │
   │  consultation_id: UUID ← Links to consult    │
   │  patient_id: UUID                            │
   │  tooth_number: "16"                          │
   │                                              │
   │  status: 'caries'                            │
   │  primary_diagnosis: "Moderate Caries"        │
   │  diagnosis_details: "MOD cavity"             │
   │  symptoms: ["pain", "sensitivity"]           │
   │                                              │
   │  recommended_treatment: "Root Canal + Crown" │
   │  treatment_priority: 'high'                  │
   │  estimated_duration: 120 (minutes)           │
   └──────────────────────────────────────────────┘

STEP 3: APPOINTMENT LINKAGE
   ↓
   Create appointment for treatment
   ↓
   ┌──────────────────────────────────────────────┐
   │  TABLE: api.appointments                     │
   │  ────────────────────────────────────────    │
   │  id: UUID                                    │
   │  patient_id: UUID                            │
   │  dentist_id: UUID                            │
   │  scheduled_date: Date                        │
   │  appointment_type: "Root Canal Treatment"    │
   │  status: 'scheduled'                         │
   └──────────────────────────────────────────────┘
             ↓
   ┌──────────────────────────────────────────────┐
   │  TABLE: api.appointment_teeth (Link table)   │
   │  ────────────────────────────────────────    │
   │  appointment_id: UUID                        │
   │  consultation_id: UUID                       │
   │  tooth_number: "16"                          │
   │  tooth_diagnosis_id: UUID ← Links to tooth   │
   │  diagnosis: "Moderate Caries" (copy)         │
   └──────────────────────────────────────────────┘

STEP 4: TREATMENT EXECUTION
   ↓
   Appointment marked as completed
   ↓
   Treatment record created
   ↓
   ┌──────────────────────────────────────────────┐
   │  TABLE: api.treatments                       │
   │  ────────────────────────────────────────    │
   │  id: UUID                                    │
   │  patient_id: UUID                            │
   │  appointment_id: UUID                        │
   │  consultation_id: UUID                       │
   │  tooth_number: "16"                          │
   │  tooth_diagnosis_id: UUID                    │
   │                                              │
   │  treatment_type: "Root Canal Treatment"      │
   │  status: 'completed'                         │
   │  completed_at: timestamp                     │
   └──────────────────────────────────────────────┘
```

---

## 🔍 Research Dashboard Filters - What Gets Searched

### **Available Diagnosis Filters**

| Filter Name | Source Table | Column | Data Type | What It Searches |
|-------------|--------------|--------|-----------|------------------|
| **Primary Diagnosis** | `consultations` | `diagnosis->>'primary'` | String | Overall patient diagnosis |
| **Final Diagnosis** | `consultations` | `diagnosis->'final'` | Array | Final diagnosis list |
| **Provisional Diagnosis** | `consultations` | `diagnosis->'provisional'` | Array | Provisional diagnosis list |
| **Primary Diagnosis (FDI Chart)** | `tooth_diagnoses` | `primary_diagnosis` | String | Tooth-specific diagnosis |
| **Tooth Status (FDI Chart)** | `tooth_diagnoses` | `status` | Enum | Tooth condition (caries, filled, etc.) |

---

## ❌ WHY YOU CAN'T FIND MANY DIAGNOSES

### **Problem Identified:**

Running the diagnostic script revealed:
```
✅ Found 10 consultations
❌ ALL Primary Diagnoses = "N/A"
```

### **Root Causes:**

1. **Consultations have diagnosis data structure** but values are "N/A"
   - The `diagnosis` JSONB field exists
   - But `diagnosis.primary` is set to "N/A" instead of actual diagnosis

2. **Tooth diagnoses may not be entered via FDI chart**
   - If dentists don't click on teeth and enter diagnosis
   - The `tooth_diagnoses` table will be empty

3. **Current workflow may not require diagnosis entry**
   - Diagnosis fields may be optional in the UI
   - Dentists might skip this step

---

## 🛠️ How to Fix: Enable Proper Diagnosis Entry

### **Option 1: Make Diagnosis Required in Consultation**

Modify the consultation save logic to require actual diagnosis:

```typescript
// Before saving consultation
if (!diagnosis || diagnosis.primary === 'N/A' || !diagnosis.primary) {
  throw new Error('Please enter a primary diagnosis before saving consultation')
}
```

### **Option 2: Use FDI Chart Diagnosis for Research**

Since tooth diagnoses are more detailed, prioritize them:

```typescript
// In research filtering
// Instead of searching consultations.diagnosis
// Search tooth_diagnoses.primary_diagnosis across all teeth
```

### **Option 3: Sync FDI Diagnoses to Consultation**

When dentist saves tooth diagnoses, automatically populate consultation diagnosis:

```typescript
// After saving tooth_diagnoses
const toothDiagnoses = await getToothDiagnoses(consultationId)
const primaryDiag = toothDiagnoses.find(t => t.treatment_priority === 'urgent')?.primary_diagnosis

await updateConsultation(consultationId, {
  diagnosis: {
    primary: primaryDiag || 'Multiple teeth affected',
    provisional: toothDiagnoses.map(t => `Tooth #${t.tooth_number}: ${t.primary_diagnosis}`)
  }
})
```

---

## 📋 Database Schemas - Reference

### **api.consultations**
```sql
CREATE TABLE api.consultations (
  id UUID PRIMARY KEY,
  patient_id UUID NOT NULL,
  dentist_id UUID NOT NULL,
  consultation_date TIMESTAMP,
  status TEXT CHECK (status IN ('draft', 'completed', 'archived')),

  -- Overall diagnosis (JSONB stored as TEXT)
  diagnosis TEXT,  -- JSON: {"primary": "...", "provisional": [...], "final": [...]}
  treatment_plan TEXT,  -- JSON: {"plan": ["Treatment 1", "Treatment 2"]}

  -- Other fields...
  pain_assessment TEXT,
  medical_history TEXT,
  clinical_examination TEXT,
  investigations TEXT,
  prognosis TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### **api.tooth_diagnoses**
```sql
CREATE TABLE api.tooth_diagnoses (
  id UUID PRIMARY KEY,
  consultation_id UUID NOT NULL,  -- ← Links to consultation
  patient_id UUID NOT NULL,
  tooth_number TEXT NOT NULL,  -- FDI notation: "11", "16", "32", etc.

  -- Tooth condition
  status TEXT CHECK (status IN (
    'healthy', 'caries', 'filled', 'crown', 'missing',
    'attention', 'root_canal', 'extraction_needed', 'implant'
  )),

  -- Diagnosis details
  primary_diagnosis TEXT,  -- e.g., "Moderate Caries", "Irreversible Pulpitis"
  diagnosis_details TEXT,  -- e.g., "MOD cavity", "Periapical abscess"
  symptoms TEXT,  -- JSON array: ["pain", "sensitivity", "swelling"]

  -- Treatment recommendations
  recommended_treatment TEXT,  -- e.g., "Root Canal Treatment + Crown"
  treatment_priority TEXT CHECK (priority IN ('urgent', 'high', 'medium', 'low', 'routine')),
  treatment_details TEXT,
  estimated_duration INTEGER,  -- in minutes

  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### **api.appointment_teeth** (Link table)
```sql
CREATE TABLE api.appointment_teeth (
  id UUID PRIMARY KEY,
  appointment_id UUID NOT NULL,  -- ← Links to appointment
  consultation_id UUID,  -- ← Optional link to consultation
  tooth_number TEXT NOT NULL,
  tooth_diagnosis_id UUID,  -- ← Links to tooth_diagnoses
  diagnosis TEXT,  -- Copy of diagnosis for quick access
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### **api.treatments**
```sql
CREATE TABLE api.treatments (
  id UUID PRIMARY KEY,
  patient_id UUID NOT NULL,
  dentist_id UUID NOT NULL,
  appointment_id UUID,  -- ← Links to appointment
  consultation_id UUID,  -- ← Links to original consultation

  -- Tooth linkage
  tooth_number TEXT,  -- Which tooth was treated
  tooth_diagnosis_id UUID,  -- ← Links back to original diagnosis

  -- Treatment details
  treatment_type TEXT NOT NULL,  -- "Root Canal", "Crown", "Filling", etc.
  description TEXT,
  notes TEXT,
  status TEXT CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),

  -- Timeline
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  total_visits INTEGER DEFAULT 1,
  completed_visits INTEGER DEFAULT 0,

  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

---

## 🎯 Summary

### **The Diagnosis Journey:**

1. **Consultation → Overall Diagnosis** (`consultations.diagnosis`)
   - General patient diagnosis
   - Searched by: "Primary Diagnosis" filter
   - **Current Issue**: All values are "N/A"

2. **FDI Chart → Tooth-Specific Diagnosis** (`tooth_diagnoses.primary_diagnosis`)
   - Individual tooth diagnosis
   - Searched by: "Primary Diagnosis (FDI Chart)" filter
   - **Current Issue**: May not be populated if chart not used

3. **Appointment → Links Diagnosis to Treatment** (`appointment_teeth.tooth_diagnosis_id`)
   - Connects diagnosis to scheduled treatment
   - Bridges consultation → appointment → treatment

4. **Treatment → Records What Was Done** (`treatments.treatment_type`)
   - Actual completed treatment
   - Searched by: "Completed Treatment Type" filter
   - **Status**: Working correctly

### **Why Research Shows Few Diagnoses:**

✅ **Data structure exists**
✅ **Filters are configured correctly**
❌ **Diagnosis values are "N/A"** instead of actual diagnoses
❌ **Dentists may not be entering diagnoses in the UI**

### **Recommended Fix:**

1. Make diagnosis entry mandatory in consultation workflow
2. Pre-fill diagnosis dropdown with common values
3. Auto-sync tooth diagnoses to consultation diagnosis
4. Add validation to prevent "N/A" diagnoses

---

**Last Updated**: 2025-10-05
**Version**: 1.0 - Initial Diagnosis Architecture Documentation
