# EndoFlow Backup Thesis — Study Design Brief
## For AIIMS IEC Protocol Submission

---

## Investigator Details

- **Principal Investigator:** Dr. Nisarg Dalal, 3rd Year JR, CDER, AIIMS New Delhi (AIR 16, NEET MDS)
- **Guide:** Dr. Amrita Chawla, Additional Professor, CDER, AIIMS New Delhi
- **Department:** Conservative Dentistry & Endodontics, Centre for Dental Education & Research (CDER)
- **Institution:** All India Institute of Medical Sciences, New Delhi

---

## Proposed Title

**"A Cross-Sectional Comparative Study Evaluating an AI-Powered Digital Clinical Workflow Management System (EndoFlow) Versus Conventional Paper-Based Documentation in the Department of Conservative Dentistry & Endodontics, AIIMS New Delhi"**

---

## Study Type & CTRI Status

- **Study Design:** Cross-sectional comparative study (observational)
- **NOT interventional** — we are comparing two existing documentation methods
- **CTRI Registration: NOT REQUIRED**
  - Per CTRI FAQs and ICMR guidelines, CTRI registration is mandatory only for interventional clinical trials
  - This is an observational comparison study of a clinical workflow tool
  - This completely bypasses the CTRI deadlock that blocked the primary thesis

---

## Background & Rationale (Why This Study)

### The Problem:
Paper-based clinical documentation in dental departments suffers from:
- Incomplete records (endodontic audits show 30-70% incompleteness — PMIDs 36191029, 40277504, 41634727)
- Diagnostic oversights due to missed medical history (PMID 41473735)
- Time-consuming manual documentation reducing clinical time
- Poor data retrievability for follow-up, audit, and research
- No standardized documentation format across operators

### The Gap:
- EHR studies exist in general dentistry, but **ZERO published studies** evaluate a comprehensive AI-integrated workflow system in Conservative Dentistry & Endodontics
- Existing studies evaluate single modules (charting OR scheduling OR prescriptions), never a full pipeline system
- No study combines AI diagnostic support assessment WITH documentation quality evaluation
- No dental voice dictation + NLP study exists
- No SUS + TAM dual-framework evaluation of dental AI software
- No study in a resource-constrained academic dental setting like AIIMS

---

## 6 Identified Lacunae (from 93-Article Literature Review)

1. **No comprehensive AI-integrated dental workflow study** — Existing EHR studies evaluate individual modules, never a full pipeline (registration → consultation → AI diagnosis → treatment → follow-up)

2. **No endodontic-specific digital workflow evaluation** — Digital documentation studies exist in periodontics and oral surgery, but Conservative Dentistry & Endodontics has zero published comparative studies

3. **No study combining AI diagnostic support WITH documentation assessment** — AI studies measure diagnostic accuracy in isolation; documentation studies measure completeness in isolation

4. **No dental voice dictation + NLP study** — Voice-to-text with dental-specific NLP has been studied in radiology and general medicine, never in dental settings

5. **No TAM/SUS dual-framework usability study for dental AI software** — Technology acceptance studies in dentistry use TAM or SUS alone, never both together

6. **No study in a resource-constrained academic dental setting** — Most digital health studies come from well-funded private practices or Western centers

---

## Study Design Details

### Study Groups:
- **Group A (EndoFlow):** Clinical documentation using EndoFlow digital platform
- **Group B (Conventional):** Paper-based clinical documentation (current standard at AIIMS)

### Study Setting:
- Department of Conservative Dentistry & Endodontics, CDER, AIIMS New Delhi

### Study Population:
- Clinicians (JRs, SRs, faculty) performing endodontic consultations
- Patient records generated during routine clinical care

### Proposed Sample Size:
- **n = 40 per group (total N = 80)** — matching the power calculation approach of the primary thesis
- Power: 90%, Alpha: 5%
- Based on documentation completeness difference (primary outcome)
- Reference: PMID 41473735 used 200 records (100/group) with 20 evaluators

---

## Primary Outcome Measures

### 1. Documentation Completeness (%)
- **Definition:** Percentage of required clinical fields completed per consultation
- **Measurement:** Standardized checklist based on endodontic documentation requirements
- **Checklist items (proposed):**
  - Patient demographics (name, age, gender, UHID)
  - Chief complaint
  - History of present illness
  - Medical history
  - Dental history
  - Clinical examination findings
  - Pulp vitality test results
  - Radiographic findings
  - Diagnosis (pulpal + periapical)
  - Treatment plan
  - Tooth number (FDI notation)
  - Consent documentation
  - Treatment performed
  - Materials used
  - Post-operative instructions
  - Follow-up scheduled
- **Literature support:** PMIDs 36191029, 40277504, 41634727, 33911363

### 2. Documentation Time (minutes)
- **Definition:** Total time from consultation start to documentation completion
- **Measurement:** Stopwatch timing / system timestamps
- **Literature support:** PMIDs 40193189, 38034181, 41625485

---

## Secondary Outcome Measures

### 3. System Usability Scale (SUS) — EndoFlow group only
- **Instrument:** Standard 10-item SUS questionnaire (Brooke, 1996)
- **Scale:** 0-100 (>68 = above average, >80.3 = excellent)
- **Literature support:** PMIDs 39075337, 41539203, 19047669

### 4. AI Diagnostic Concordance — EndoFlow group only
- **Definition:** Agreement between AI-suggested diagnosis and expert diagnosis
- **Measurement:** Cohen's Kappa coefficient
- **Categories:** Pulpal diagnosis (normal, reversible pulpitis, irreversible pulpitis, necrosis) + Periapical diagnosis (normal, symptomatic apical periodontitis, asymptomatic apical periodontitis, acute apical abscess, chronic apical abscess)
- **Literature support:** PMIDs 41675776, 41749771, 41685843

### 5. Error Rate
- **Definition:** Number of missing/incorrect entries per record
- **Measurement:** Blinded audit by independent reviewer
- **Literature support:** PMIDs 34658378, 40861569

### 6. Data Retrievability
- **Definition:** Time (seconds) to locate specific patient information
- **Measurement:** Timed retrieval tasks (find last diagnosis, find treatment history, find radiograph)
- **Literature support:** PMID 41473735 (EHR vs paper retrieval comparison)

---

## Proposed Statistical Analysis

| Variable | Type | Test |
|---|---|---|
| Documentation Completeness | Continuous (%) | Mann-Whitney U / Independent t-test |
| Documentation Time | Continuous (minutes) | Mann-Whitney U / Independent t-test |
| SUS Score | Continuous (0-100) | Descriptive statistics |
| AI Diagnostic Concordance | Categorical | Cohen's Kappa |
| Error Rate | Count data | Chi-square / Fisher's exact |
| Data Retrievability | Continuous (seconds) | Mann-Whitney U |

- **Normality test:** Kolmogorov-Smirnov (as used in gold-standard PMID 41473735)
- **Significance level:** p < 0.05
- **Software:** SPSS / GraphPad Prism

---

## Timeline (Compressed for Backup Thesis)

| Phase | Duration | Activities |
|---|---|---|
| IEC Submission | Week 1-2 | Protocol finalization, IEC submission |
| IEC Approval | Week 3-6 | Address IEC queries if any |
| Data Collection | Week 7-10 | Parallel documentation in both groups |
| Data Analysis | Week 11-12 | Statistical analysis, results compilation |
| Thesis Writing | Week 13-16 | Full thesis document preparation |
| **Target Submission** | **June-July 2026** | |

---

## Key Methodology Benchmarks from Literature

### From Gold-Standard Match (PMID 41473735, DOI: 10.1155/bmri/5527391):
- 200 patient records, 20 dental students, randomized to PMR vs EHR
- EHR eliminated ALL diagnostic oversights (vs 9.3 ± 0.46 mean oversights in paper)
- Recording/reporting time: 40 min (EHR) vs 325 min (paper) for 100 patients (p ≤ 0.01)
- Statistics: Mann-Whitney U, Kolmogorov-Smirnov normality test, GraphPad Prism 9

### From Endodontic Audit Studies:
- PMID 33911363: Endodontic clinical audit — 50-200 teeth, retrospective 12-month review
- PMID 36191029: Endodontic record-keeping quality — examined pulp vitality recording, diagnosis documentation
- PMID 40277504: Root canal therapy record quality — completeness assessment against standards
- PMID 41634727: Endodontic diagnostic documentation — undergraduate compliance audit

### From AI Documentation Studies:
- PMID 41625485: Pragmatic RCT, 66 practitioners, ambient AI reduced work exhaustion by 0.44 points (p<0.001), saved 0.36 hours/day
- PMID 41118162: LLM assistant for ED documentation — improved completeness
- PMID 41444572: Voice-enabled surgical checklist prototype — feasibility proven

### From Usability Studies:
- PMID 39075337: Trauma app — SUS score used, data completeness improved significantly
- PMID 41539203: Digital dental tool — SUS + TAM evaluation in dental practitioners
- PMID 19047669: Dental computer record usability — benchmark SUS evaluation in dental software

---

## Ethical Considerations

- **IEC Approval Required:** AIIMS Institute Ethics Committee
- **Informed Consent:** From clinician participants (for SUS/TAM surveys)
- **Patient Data:** De-identified, used only for documentation completeness assessment
- **No intervention on patients:** Documentation method comparison only
- **Conflict of Interest:** PI is the developer of EndoFlow — must be disclosed; independent blinded assessment of documentation quality mitigates bias
