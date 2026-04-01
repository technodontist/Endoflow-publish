# EndoFlow Platform Summary for Thesis Protocol
## (Self-Contained Reference — No Codebase Access Needed)

---

## 1. What is EndoFlow?

EndoFlow is an AI-powered SaaS clinical workflow management system designed for dental clinics, specifically optimized for Conservative Dentistry & Endodontics. It replaces conventional paper-based documentation, scheduling, and clinical decision-making with a unified digital platform.

**Developer:** Dr. Nisarg Dalal, 3rd Year JR, Dept. of Conservative Dentistry & Endodontics, CDER, AIIMS New Delhi (AIR 16, NEET MDS)

**Thesis Guide:** Dr. Amrita Chawla, Additional Professor, CDER, AIIMS New Delhi

**Tech Stack:** Next.js 14+ (App Router), PostgreSQL via Supabase, Drizzle ORM, Tailwind CSS, shadcn/ui components

---

## 2. Three Role-Based Dashboards

### 2.1 Patient Dashboard (Mobile-First)
- **Navigation:** Bottom tab bar — Home, Appointments, Messages, Library
- **Key Features:**
  - Self-registration with digital intake form
  - Appointment booking with pain level assessment (1-10 scale)
  - Real-time appointment status tracking
  - AI chatbot for patient queries
  - Urgent assistance feature
  - Document management (view own files/X-rays)
  - Educational content library
- **UI:** Clean mobile interface, teal accent (#009688)

### 2.2 Assistant Dashboard (Task-Oriented Workflow)
- **Navigation:** Top horizontal nav — Dashboard, Verify Patients, New Appointment, File Upload
- **Key Features:**
  - Patient verification queue (approve/reject new registrations)
  - Appointment booking interface (dentist/patient selection, time slots)
  - Medical file uploader (drag-and-drop, X-rays, oral photos, CBCT scans)
  - Task management board (todo/in-progress/completed)
  - Real-time notifications for new registrations
  - Cross-dashboard synchronization

### 2.3 Dentist Dashboard (Clinical Command Center)
- **Navigation:** Top tab bar with comprehensive clinical tools
- **Key Features:**
  - **Patient Queue:** Real-time status tracking (waiting → in-consultation → completed)
  - **Clinical Cockpit:** Full patient overview — medical history, dental charts, previous treatments
  - **Interactive FDI Dental Chart:** 3D visualization, tooth-specific diagnosis entry
  - **History Taking Module:** Full-screen structured patient history forms
  - **Endo-AI Co-Pilot:** AI-powered clinical decision support using Gemini 2.0 / GPT-4
    - Differential diagnosis suggestions
    - Treatment planning assistance
    - Evidence-based recommendations with literature citations
  - **Master Calendar:** Advanced appointment management
  - **Templates Manager:** Clinical documentation template creation
  - **Research Studio:** Clinical data analysis, cohort filtering, research tools
  - **Task Manager:** Create/assign/track tasks for assistants
  - **Voice Dictation:** Dental-specific NLP parsing for hands-free documentation

---

## 3. AI Integration Details

### 3.1 Endo-AI Co-Pilot
- **Models:** Gemini 2.0 Flash, GPT-4 (configurable)
- **Capabilities:**
  - Analyzes patient symptoms, clinical findings, and radiographic data
  - Generates differential diagnoses with confidence scores
  - Suggests treatment plans based on current evidence
  - Provides literature references for recommendations
  - Context-aware: accesses full patient history within the system

### 3.2 Voice Dictation & NLP
- **Architecture:** Three-stage HIPAA-compliant pipeline
  1. ASR (Automatic Speech Recognition) — speech to text
  2. LLM Summarization — dental-specific NLP parsing
  3. Secure persistence — structured data storage
- **Dental-Specific:** Recognizes dental terminology, tooth numbers (FDI notation), clinical abbreviations

### 3.3 RAG (Retrieval-Augmented Generation)
- **Database:** pgvector for vector storage
- **Function:** Grounds AI responses in clinic-specific data and published literature
- **Use Case:** Research Studio queries, clinical decision support

---

## 4. Database Architecture (36+ Tables)

### Core Flow:
```
auth.users (Supabase Auth)
    ↓
public.profiles (role: patient/assistant/dentist, status: active/pending/inactive)
    ↓
api.patients / api.assistants / api.dentists (role-specific data)
```

### Key Clinical Tables:
- `api.appointments` — scheduling with status workflow
- `api.treatments` — treatment records
- `api.diagnoses` — diagnosis records with tooth-specific data
- `api.patient_files` — medical images (X-rays, CBCT, oral photos)
- `api.assistant_tasks` — task management with priority/assignment
- `api.task_comments` — communication thread on tasks
- `api.task_activity_log` — audit trail
- `api.messages` — in-app messaging
- `api.pending_registrations` — new user approval queue
- `api.notifications` — real-time notification system

### Storage:
- **Supabase Storage:** `medical-files` bucket for X-rays/images
- **Security:** Signed URLs (1-hour expiry), RLS policies, service role for backend

---

## 5. Clinical Workflow Comparison: EndoFlow vs Paper

| Workflow Step | Paper-Based (Conventional) | EndoFlow (Digital) |
|---|---|---|
| **Patient Registration** | Paper form, manual entry, file creation | Digital intake form, auto-profile creation, instant verification |
| **Appointment Booking** | Phone call, paper diary, manual scheduling | Real-time slot selection, dentist availability check, instant confirmation |
| **Patient Check-in** | Verbal confirmation, find paper file | Dashboard notification, digital file auto-loaded |
| **History Taking** | Handwritten on paper form | Structured digital form with dropdown fields, auto-populated from previous visits |
| **Clinical Examination** | Written notes, hand-drawn dental chart | Interactive FDI dental chart, tooth-specific digital entries |
| **Diagnosis** | Written in patient file | AI-assisted differential diagnosis, confidence scores, literature references |
| **Treatment Planning** | Written plan, verbal discussion | AI treatment suggestions, visual plan, patient consent tracking |
| **Clinical Documentation** | Handwritten notes during/after procedure | Voice dictation with dental NLP, structured templates, auto-timestamps |
| **File Storage** | Paper file in cabinet, physical X-ray storage | Cloud storage, instant retrieval, digital X-ray integration |
| **Follow-up Scheduling** | Manual diary entry | Automated scheduling, patient notification, reminder system |
| **Inter-clinician Communication** | Verbal handoff, written notes in file | Real-time task system, digital referral, complete history access |
| **Data Retrieval** | Manual search through physical files | Instant search, patient history timeline, filter by date/diagnosis |
| **Audit & Quality** | Manual chart review | Automated completeness checking, real-time compliance metrics |

---

## 6. Measurable Variables for Research

### Primary Variables:
1. **Documentation Completeness (%)** — Percentage of required clinical fields completed
2. **Documentation Time (minutes)** — Time per consultation for documentation

### Secondary Variables:
3. **System Usability Scale (SUS)** — 10-item validated questionnaire (0-100 score)
4. **AI Diagnostic Accuracy** — Cohen's Kappa, sensitivity/specificity vs expert
5. **Error Rate** — Missing/incorrect entries per 100 records
6. **Data Retrievability** — Time to retrieve specific patient information
7. **Technology Acceptance Model (TAM)** — Perceived usefulness & ease of use

### Tertiary Variables:
8. **Voice transcription accuracy** — Word error rate for dental terminology
9. **Inter-clinician variability** — Documentation consistency across operators
10. **AI suggestion adoption rate** — % of AI recommendations accepted by clinicians

---

## 7. Technical Specifications for Protocol

- **151 UI components** across 3 dashboards
- **45+ server action files** for backend operations
- **36+ database tables** covering full clinical workflow
- **Real-time subscriptions** via Supabase for live updates
- **Role-based access control** with middleware JWT validation
- **HIPAA-compliant architecture** — encrypted data, signed URLs, audit trails
- **Self-hosted n8n** workflows for complex automation
- **No-code/citizen developer approach** — built using modern frameworks, not traditional software engineering (relevant for "vibe coding" validity discussion)

---

## 8. Conference Presentation (Already Presented)

**Title:** "A No-Code Blueprint for an AI-Powered Endodontic Clinical Agent Using Open-Source Workflow Automation"

**Key Points from Abstract:**
- Modular "Compliance-First" architecture
- Self-hosted n8n for workflow automation
- HIPAA-compliant three-stage ASR → LLM → secure persistence
- Demonstrates feasibility of no-code approach for clinical AI systems
- Already presented at IES conference

---

## 9. ROI Analysis (from Platform Guide)

- **Annual ROI:** 486,000% (based on development cost vs. value delivered)
- **Time savings per consultation:** Estimated 40-60% reduction in documentation time
- **Error reduction:** Digital alerts eliminate diagnostic oversights (see gold-standard study PMID 41473735)
- **Paper cost savings:** Elimination of physical file storage, printing, manual scheduling

---

## 10. What Makes EndoFlow Unique (Thesis Differentiators)

1. **Specialty-Specific:** Built for Conservative Dentistry & Endodontics, not generic dental software
2. **AI-Integrated:** Not just EHR — has clinical decision support, voice dictation, research tools
3. **Full Pipeline:** Registration → consultation → diagnosis → treatment → follow-up in one system
4. **Three-Dashboard Architecture:** Purpose-built interfaces for each clinical role
5. **Academic Setting:** Designed for AIIMS-type high-volume, resource-variable environment
6. **Developed by a Clinician:** Built by an endodontic resident who understands the clinical workflow
