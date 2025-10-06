# Treatment Filtering Guide - Research Projects

## 🎯 Understanding Treatment Plans vs. Completed Treatments

### **The Critical Difference**

| Aspect | Treatment Plan | Completed Treatment |
|--------|---------------|-------------------|
| **What it is** | What dentist *plans* to do | What was *actually done* |
| **Source Table** | `api.consultations` | `api.treatments` |
| **Database Column** | `treatment_plan` (JSONB) | `treatment_type` (TEXT) |
| **Status** | Proposed during consultation | Recorded after completion |
| **Filter Name** | "Treatment Procedures (Planned)" | "Completed Treatment Type" |

---

## 📊 Data Flow Architecture

### **Treatment Plan (Consultations)**

```
┌──────────────────────────────────────────────────────────────┐
│  CONSULTATION PHASE - Planning Stage                         │
└──────────────────────────────────────────────────────────────┘

1. Dentist examines patient
2. Creates consultation record
3. Documents treatment_plan as JSONB:

   {
     "plan": [
       "Root Canal Treatment - Tooth #16",
       "Temporary Filling",
       "Crown Preparation - 2nd Visit",
       "Final Crown Placement - 3rd Visit"
     ],
     "notes": "Patient needs multi-visit endodontic treatment"
   }

TABLE: api.consultations
COLUMN: treatment_plan (TEXT storing JSON)
STATUS: Planned, not yet done
```

### **Completed Treatment (Treatments)**

```
┌──────────────────────────────────────────────────────────────┐
│  TREATMENT PHASE - Execution Stage                           │
└──────────────────────────────────────────────────────────────┘

1. Patient returns for appointment
2. Dentist performs treatment
3. Records actual treatment in treatments table:

   Row 1:
   - treatment_type: "Root Canal Treatment"
   - tooth_number: "16"
   - status: "completed"
   - completed_at: "2025-01-15"

   Row 2:
   - treatment_type: "Crown Placement"
   - tooth_number: "16"
   - status: "completed"
   - completed_at: "2025-02-20"

TABLE: api.treatments
COLUMNS:
  - treatment_type (TEXT)
  - status (pending|in_progress|completed|cancelled)
  - completed_at (TIMESTAMP)
  - tooth_number, consultation_id, etc.
```

---

## 🔍 Available Filters

### **1. Treatment Procedures (Planned)** - From Consultations

**Filter Key**: `treatment_procedures`
**Source**: `api.consultations.treatment_plan`
**Data Type**: JSONB Array

**Use Cases**:
- Find patients who were PLANNED to receive a specific treatment
- Research on treatment planning patterns
- Compare planned vs. actual treatments

**Example Queries**:
```
• Contains "Root Canal" → Find all patients planned for RCT
• Contains "Crown" → Find patients planned for crown work
• Not Contains "Extraction" → Patients with non-extraction plans
```

**Limitations**:
- ❌ Doesn't tell you if treatment was actually done
- ❌ Searches only the latest consultation
- ❌ May include treatments never performed

---

### **2. Completed Treatment Type** - From Treatments Table ✨ NEW

**Filter Key**: `completed_treatment_type`
**Source**: `api.treatments.treatment_type`
**Data Type**: String

**Use Cases**:
- Find patients who ACTUALLY received a treatment
- Research on completed treatment outcomes
- Track treatment completion rates

**Example Queries**:
```
• Contains "Root Canal" → Patients who got RCT done
• Equals "Crown Placement" → Exact match for crowns
• In "Filling,Extraction" → Multiple treatment types
```

**Advantages**:
- ✅ Searches ALL treatments for a patient (not just latest)
- ✅ Confirms treatment was actually performed
- ✅ Can filter by completion status

---

### **3. Treatment Status** ✨ NEW

**Filter Key**: `treatment_status`
**Source**: `api.treatments.status`
**Data Type**: Enum (pending|in_progress|completed|cancelled)

**Use Cases**:
- Find patients with completed treatments only
- Track ongoing treatments
- Identify cancelled treatments

**Example Queries**:
```
• Equals "completed" → Only finished treatments
• Equals "in_progress" → Currently undergoing treatment
• Not Equals "cancelled" → All non-cancelled treatments
```

---

### **4. Treatment Completion Date** ✨ NEW

**Filter Key**: `treatment_completion_date`
**Source**: `api.treatments.completed_at`
**Data Type**: Date

**Use Cases**:
- Find treatments completed in specific time period
- Track recent vs. old treatments
- Longitudinal outcome studies

**Example Queries**:
```
• Greater Than "2025-01-01" → Treatments after Jan 1, 2025
• Less Than "2024-12-31" → Treatments before 2024
• Between "2024-06-01,2024-12-31" → H2 2024 treatments
```

---

## 🧪 Example Research Scenarios

### **Scenario 1: Find patients who completed Root Canal in last 6 months**

```
Filter 1: Completed Treatment Type CONTAINS "Root Canal"
Filter 2: Treatment Status EQUALS "completed"
Filter 3: Treatment Completion Date GREATER_THAN "2024-07-01"
```

This searches the `api.treatments` table and finds actual completed RCTs.

---

### **Scenario 2: Compare planned vs. performed**

**Step 1**: Find patients PLANNED for extraction
```
Filter: Treatment Procedures (Planned) CONTAINS "Extraction"
→ Results: 50 patients
```

**Step 2**: Find patients who ACTUALLY got extraction
```
Filter: Completed Treatment Type CONTAINS "Extraction"
Filter: Treatment Status EQUALS "completed"
→ Results: 35 patients
```

**Insight**: 15 patients (30%) had extraction planned but not performed.

---

### **Scenario 3: Ongoing multi-visit treatments**

```
Filter 1: Treatment Status EQUALS "in_progress"
Filter 2: Completed Treatment Type CONTAINS "Root Canal"
```

Finds patients currently undergoing RCT (between visits).

---

## 🔧 Technical Implementation

### **Filter Detection (research-projects.ts:320-363)**

```typescript
// System detects which filters need which data sources
if (filterCriteria.some(c => c.field === 'treatment_procedures')) {
  needsConsultations = true  // Fetch from consultations table
}

if (filterCriteria.some(c =>
  ['completed_treatment_type', 'treatment_status', 'treatment_completion_date'].includes(c.field)
)) {
  needsTreatments = true  // Fetch from treatments table
}
```

### **Data Enrichment (research-projects.ts:432-449)**

```typescript
// Attach ALL treatments to patient object
enrichedPatients = enrichedPatients.map(patient => {
  const patientTreatments = treatments.filter(t => t.patient_id === patient.id)

  return {
    ...patient,
    treatments: patientTreatments  // Full array for filtering
  }
})
```

### **Filter Logic (research-projects.ts:1112-1184)**

```typescript
if (field === 'completed_treatment_type') {
  const treatments = patient.treatments || []

  // Search across ALL treatments
  for (const treatment of treatments) {
    if (treatment.treatment_type.toLowerCase().includes(searchValue)) {
      return true
    }
  }
}
```

---

## 📋 Database Schema Reference

### **api.consultations**
```sql
CREATE TABLE api.consultations (
  id UUID PRIMARY KEY,
  patient_id UUID NOT NULL,
  dentist_id UUID NOT NULL,
  consultation_date TIMESTAMP,
  treatment_plan TEXT,  -- JSON: {"plan": ["Treatment 1", "Treatment 2"]}
  status TEXT CHECK (status IN ('draft', 'completed', 'archived')),
  -- ... other fields
);
```

### **api.treatments**
```sql
CREATE TABLE api.treatments (
  id UUID PRIMARY KEY,
  patient_id UUID NOT NULL,
  dentist_id UUID NOT NULL,
  appointment_id UUID,
  consultation_id UUID,
  treatment_type TEXT NOT NULL,  -- Actual treatment performed
  description TEXT,
  notes TEXT,
  status TEXT CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  tooth_number TEXT,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,  -- When treatment was finished
  total_visits INTEGER DEFAULT 1,
  completed_visits INTEGER DEFAULT 0,
  -- ... other fields
);
```

---

## ✅ Summary

### Use **Treatment Procedures (Planned)** when you want to:
- Analyze treatment planning patterns
- See what dentists propose as treatment
- Compare different dentists' planning approaches

### Use **Completed Treatment Type** when you want to:
- Find patients who actually received treatment
- Track treatment outcomes
- Research on performed procedures
- Measure completion rates

### Use **Treatment Status** when you want to:
- Filter by completion state
- Track ongoing treatments
- Identify cancelled procedures

### Use **Treatment Completion Date** when you want to:
- Time-based analysis
- Recent vs. historical treatments
- Longitudinal outcome studies

---

**Last Updated**: 2025-10-03
**Version**: 2.0 - Added Completed Treatment Filters
