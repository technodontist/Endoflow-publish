# JSONB Research Filtering - Quick Start Guide

## 🚀 Setup (One-Time)

### Step 1: Create Performance Indexes
Run this SQL in **Supabase SQL Editor**:
```bash
# File location: sql/CREATE_JSONB_RESEARCH_INDEXES.sql
```

This creates 50+ optimized indexes for fast JSONB queries.

### Step 2: Verify Setup
```bash
node test-jsonb-research-filtering.js
```

Expected output:
- ✅ Consultations with JSONB data found
- ✅ JSONB path queries working
- ✅ Performance indexes created

---

## 📊 Using JSONB Filters

### Access the Dashboard
1. Login as dentist ([dr.nisarg@endoflow.com](mailto:dr.nisarg@endoflow.com) / `endoflow123`)
2. Go to **Research V2 (Advanced)** tab
3. Click **"Create New Project"**

### Build Your First Query

#### Example 1: High Pain Patients Needing Root Canals
```
Filter 1: Pain Intensity > 7
Filter 2: AND Primary Diagnosis contains "Pulpitis"
Filter 3: AND Treatment Procedure = "root_canal"
```

**Result**: Patients with severe pain diagnosed with pulpitis requiring endodontic treatment

#### Example 2: Diabetic Patients with Periodontal Disease
```
Filter 1: Diabetes Control Status = "poorly_controlled"
Filter 2: AND Periodontal Pocket Depth > 5
Filter 3: AND Bleeding on Probing = true
Filter 4: AND Age > 50
```

**Result**: Diabetic seniors with active periodontal disease

#### Example 3: Antibiotic Prescription Patterns
```
Filter 1: Antibiotic Prescribed = true
Filter 2: AND Primary Diagnosis contains "Abscess"
Filter 3: AND Radiograph Type = "periapical"
```

**Result**: Patients with abscesses requiring antibiotics

---

## 🎨 Filter Categories (Color-Coded)

| Category | Icon | Color | Fields | Example Uses |
|----------|------|-------|--------|--------------|
| **Pain Assessment** | 🩹 | Teal | 4 | Pain intensity, location, duration, character |
| **Diagnosis** | 🔬 | Blue | 4 | Primary/secondary diagnosis, severity, ICD codes |
| **Treatment Plan** | 🦷 | Purple | 4 | Procedures, complexity, tooth numbers, duration |
| **Clinical Examination** | 🔍 | Green | 4 | Periodontal depth, bleeding, mobility, soft tissue |
| **Medical History** | 📋 | Red | 4 | Diabetes, anticoagulants, allergies, cardiovascular |
| **Investigations** | 📊 | Indigo | 3 | X-rays, pulp tests, percussion tests |
| **Prescriptions** | 💊 | Pink | 2 | Antibiotics, analgesic types |
| **Follow-Up** | 📅 | Orange | 3 | Follow-up required, days, reasons |

---

## 💡 Filter Field Reference

### Pain Assessment (🩹 Teal)
- **Pain Intensity (1-10)**: Numeric comparison (>, <, =, between)
- **Pain Location**: Text search (equals, contains)
- **Pain Duration**: Dropdown (acute, subacute, chronic)
- **Pain Character**: Dropdown (sharp, dull, throbbing, etc.)

### Diagnosis (🔬 Blue)
- **Primary Diagnosis (JSONB)**: Text search from consultation data
- **Secondary Diagnosis (JSONB)**: Text search
- **Diagnosis Severity**: Dropdown (mild, moderate, severe)
- **ICD Diagnosis Code**: Text search (starts with, equals)

### Treatment Plan (🦷 Purple)
- **Treatment Procedure (JSONB)**: Dropdown (root_canal, extraction, filling, etc.)
- **Treatment Complexity**: Dropdown (simple, moderate, complex)
- **Affected Tooth Numbers**: Text search (contains specific teeth)
- **Treatment Duration (minutes)**: Numeric comparison

### Clinical Examination (🔍 Green)
- **Periodontal Pocket Depth (mm)**: Numeric comparison (>, <, between)
- **Bleeding on Probing**: Boolean (true/false)
- **Tooth Mobility Grade**: Numeric (0-3)
- **Soft Tissue Findings**: Text search

### Medical History (📋 Red)
- **Diabetes Control Status**: Dropdown (well_controlled, poorly_controlled, uncontrolled)
- **On Anticoagulant Therapy**: Boolean (true/false)
- **Penicillin Allergy**: Boolean (true/false)
- **Cardiovascular Disease History**: Boolean (true/false)

### Investigations (📊 Indigo)
- **Radiograph Type**: Dropdown (periapical, panoramic, bitewing, CBCT)
- **Pulp Vitality Test Result**: Dropdown (vital, non_vital, uncertain)
- **Percussion Test Result**: Dropdown (negative, positive, severe)

### Prescriptions (💊 Pink)
- **Antibiotic Prescribed**: Boolean (true/false)
- **Pain Medication Type**: Dropdown (NSAID, opioid, paracetamol)

### Follow-Up (📅 Orange)
- **Follow-up Appointment Required**: Boolean (true/false)
- **Follow-up in Days**: Numeric comparison
- **Follow-up Review Reason**: Text search

---

## 📝 Creating Test Data

### Required: Consultations with JSONB Data

1. **Go to Enhanced Consultation**:
   - Dentist Dashboard → Enhanced Consultation
   - Select a patient

2. **Fill Complete Clinical Data**:
   - **Pain Assessment**: Intensity (e.g., 7), Location (e.g., "Lower left molar")
   - **Diagnosis**: Primary (e.g., "Irreversible Pulpitis"), Severity (moderate)
   - **Treatment Plan**: Procedure (root_canal), Complexity (moderate)
   - **Clinical Exam**: Periodontal depth (5mm), Bleeding (yes)
   - **Medical History**: Diabetes control status, allergies, etc.
   - **Investigations**: X-ray type, pulp test results
   - **Prescriptions**: Add medications
   - **Follow-Up**: Schedule review

3. **Save Consultation** with status = "completed"

4. **Repeat for Multiple Patients** with varied data

---

## 🔍 Troubleshooting

### Problem: "No patients found"

**Diagnosis**:
```bash
node test-jsonb-research-filtering.js
```

**Check**:
- Are there completed consultations?
- Do consultations have JSONB data populated?
- Are filter values correct?

**Solution**:
- Create consultations with complete clinical data
- Verify JSONB structure in test output
- Adjust filter criteria

---

### Problem: Slow query performance

**Check**:
```sql
-- Run in Supabase SQL Editor
SELECT * FROM check_research_index_usage();
```

**Solution**:
- Run `sql/CREATE_JSONB_RESEARCH_INDEXES.sql`
- Reduce number of complex filters
- Add basic demographic filters first

---

### Problem: UI shows "undefined" for JSONB fields

**Check**:
- Browser console for JavaScript errors
- Network tab for server action responses
- JSONB data structure in database

**Solution**:
- Verify consultation form saves JSONB correctly
- Check JSONB field names match expected structure
- Review server action logs

---

## 📚 Advanced Usage

### Complex Multi-Condition Queries

**Research Question**: "Find diabetic patients over 50 with severe periodontal disease requiring complex treatment"

**Filters**:
```
1. Age > 50
2. AND Diabetes Control Status in ["poorly_controlled", "uncontrolled"]
3. AND Periodontal Pocket Depth > 6
4. AND Bleeding on Probing = true
5. AND Treatment Complexity = "complex"
6. AND Follow-up Required = true
```

### Combining JSONB and Non-JSONB Filters

**Research Question**: "Recent emergency cases with high pain requiring antibiotics"

**Filters**:
```
1. Last Visit Date > "2025-01-01"          (Non-JSONB)
2. AND Pain Intensity > 8                  (JSONB)
3. AND Antibiotic Prescribed = true        (JSONB)
4. AND Total Visits < 5                    (Non-JSONB)
```

### Using OR Logic

**Research Question**: "Patients with either severe diagnosis or high pain"

**Filters**:
```
1. Diagnosis Severity = "severe"
2. OR Pain Intensity > 8
3. AND Treatment Procedure in ["root_canal", "extraction"]
```

---

## 🎯 Real-World Research Scenarios

### Scenario 1: Treatment Outcome Analysis
**Goal**: Analyze success rates of root canal treatments

**Setup**:
- Create project: "RCT Outcomes 2025"
- Filters: Treatment Procedure = "root_canal", Follow-up Required = true
- Export patient list
- Track follow-up compliance and satisfaction

### Scenario 2: Risk Stratification
**Goal**: Identify high-risk patients needing special care

**Setup**:
- Create project: "High Risk Patients"
- Filters: Cardiovascular Disease = true, Anticoagulant Therapy = true, Age > 65
- Monitor for special protocols during treatment

### Scenario 3: Pain Management Study
**Goal**: Evaluate effectiveness of different pain medications

**Setup**:
- Create project: "Pain Management Efficacy"
- Filters: Pain Intensity > 7, Pain Medication Type = varies
- Track follow-up pain levels and satisfaction

---

## ✅ Best Practices

1. **Start with Demographics**: Add Age, Gender filters first for faster queries
2. **Use Specific JSONB Filters**: Narrow down with 2-3 clinical criteria
3. **Test Incrementally**: Add one filter at a time, check patient count
4. **Save Projects**: Name projects descriptively for future reference
5. **Export Data**: Use matched patient lists for external analysis
6. **Monitor Performance**: If slow, reduce filters or create indexes

---

## 🔗 Related Documentation

- **Full Documentation**: [docs/JSONB_RESEARCH_FILTERING.md](docs/JSONB_RESEARCH_FILTERING.md)
- **System Architecture**: [CLAUDE.md](CLAUDE.md)
- **Database Setup**: [sql/CREATE_JSONB_RESEARCH_INDEXES.sql](sql/CREATE_JSONB_RESEARCH_INDEXES.sql)
- **Testing Guide**: [test-jsonb-research-filtering.js](test-jsonb-research-filtering.js)

---

## 🆘 Getting Help

1. Run test script: `node test-jsonb-research-filtering.js`
2. Check browser console for errors
3. Review Supabase logs for server issues
4. Verify consultation data structure
5. Consult full documentation: `docs/JSONB_RESEARCH_FILTERING.md`

**Happy Researching! 🦷📊**
