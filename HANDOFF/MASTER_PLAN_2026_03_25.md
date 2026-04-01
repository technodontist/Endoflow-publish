# ENDOFLOW MASTER DEVELOPMENT PLAN
## Created: 2026-03-25 | Session: Restart after 5-month break

---

## PHASE A: DATABASE & AUTH REPAIR (Current Priority)

### A1: Fix Supabase Auth (CRITICAL - Blocking Everything)
- **Problem**: `auth.users` returns "Database error querying schema" after project pause/restore
- **Impact**: Nobody can log in - not patients, not dentists, not assistants
- **Action Items**:
  - [ ] Go to Supabase Dashboard → restart database
  - [ ] Run `SELECT * FROM auth.users LIMIT 1;` in SQL Editor to verify
  - [ ] If still broken, check Extensions (pgcrypto, uuid-ossp, pgjwt must be enabled)
  - [ ] Test login with `dr.nisarg@endoflow.com` / `endoflow123`
  - [ ] Contact Supabase support if restart doesn't fix it

### A2: Create 3 Separate Login Portals
- **Problem**: Single login page can't properly route users by role; causes confusion
- **Action Items**:
  - [ ] Create `/login/patient` - patient-specific login page
  - [ ] Create `/login/assistant` - assistant-specific login page
  - [ ] Create `/login/dentist` - dentist-specific login page
  - [ ] Update landing page with 3 login buttons
  - [ ] Each portal validates role after auth, rejects wrong-role logins
  - [ ] Add proper error messages ("This email is not registered as a dentist")

### A3: Fix Table Permission Grants (34 tables inaccessible)
- **Problem**: 34 tables exist in DB but lack proper GRANT permissions for PostgREST
- **Tables needing grants**: `assistant_tasks`, `consultations`, `tooth_diagnoses`, `voice_sessions`, `patient_files`, `notifications`, `clinical_templates`, `appointment_requests`, `appointment_teeth`, `clinic_analysis_chat_sessions`, `clinic_analysis_messages`, `endoflow_conversations`, `medical_knowledge`, `medication_reminders`, `message_threads`, `patient_prescriptions`, `patient_referrals`, `research_ai_conversations`, `research_analytics`, `research_cohorts`, `research_criteria`, `research_exports`, `self_learning_chat_sessions`, `self_learning_messages`, `task_activity_log`, `task_comments`, `template_categories`, `template_usage_history`, `thread_messages`, `alarm_sounds`, `prescription_alarms`, `alarm_instances`, `ai_diagnosis_cache`, `ai_suggestion_cache`
- **Action Items**:
  - [ ] Generate SQL GRANT statements for all 34 tables
  - [ ] Grant SELECT, INSERT, UPDATE, DELETE to `authenticated` role
  - [ ] Grant SELECT to `anon` role where needed
  - [ ] Run in Supabase SQL Editor
  - [ ] Verify each table is accessible via PostgREST

### A4: Clean Up Database Data
- **Problems found**:
  - Old seed data in `api.dentists` (id: `4f313e09`) uses different UUID than profile (id: `86bb73d5`)
  - `api.assistants` table is EMPTY (Test Assistant has profile but no role-specific record)
  - `sarah.assistant@endoflow.com` has role=`patient` instead of `assistant`
  - 21 pending patients (TMKOC test characters) never approved
  - 1 inactive patient ("me my")
  - 3 stale `pending_registrations` from September 2025
  - Duplicate dentist entries: "Dr. Nisarg" (General Dentistry) AND "Dr.Nisarg" (MICRO-ENDODONTIST)
- **Action Items**:
  - [ ] Fix `api.dentists` to use correct profile UUIDs
  - [ ] Create `api.assistants` record for Test Assistant
  - [ ] Fix sarah.assistant's role to `assistant`
  - [ ] Decide: approve or delete test patients
  - [ ] Clean up stale pending_registrations
  - [ ] Resolve duplicate dentist entries

### A5: Add Middleware Role Protection
- **Problem**: Role checking is client-side only; wrong-role users see page briefly before "Access Denied"
- **Current state**: `middleware.ts.backup` only checks if auth cookie exists, not the role
- **Action Items**:
  - [ ] Create proper `middleware.ts` (not backup)
  - [ ] Add role validation: dentist routes require role='dentist', etc.
  - [ ] Server-side redirect for wrong-role access
  - [ ] Handle unauthenticated users → redirect to landing page
  - [ ] Handle pending users → show "awaiting approval" page

---

## PHASE B: MULTI-DENTIST PROFILE ISOLATION

### B1: Scope Global Queries to Dentist
- **Problem**: Multiple functions return ALL data regardless of which dentist is logged in
- **Global functions needing dentist_id filter**:
  - [ ] `getClinicStatistics()` in `lib/db/queries.ts`
  - [ ] `getTreatmentDistribution()` in `lib/db/queries.ts`
  - [ ] `getPatientDemographics()` in `lib/db/queries.ts`
  - [ ] `getConsultationsAction()` in `lib/actions/consultation.ts` (dentistId filter is optional)
  - [ ] `getAllAnalyticsDataAction()` in `lib/actions/analytics.ts`
  - [ ] `getClinicalDataSummaryAction()` in `lib/actions/analytics.ts`
- **Already scoped (no changes needed)**:
  - `getDentistAppointments()` → filters by dentist_id ✅
  - `getTasksAction()` → role-aware ✅
  - `getPatientToothDiagnoses()` → patient-scoped ✅
- **Approach**: Add optional `dentistId` parameter to global functions (backward compatible)

### B2: Patient-Dentist Relationship Model
- **Problem**: No concept of "Dr. Nisarg's patients" vs "Dr. Pranav's patients"
- **Action Items**:
  - [ ] Design patient-dentist linking table or add `primary_dentist_id` to patients
  - [ ] Decide: shared patients (patient can see multiple dentists) vs exclusive
  - [ ] Update patient queries to filter by dentist relationship
  - [ ] Ensure assistant sees only their clinic's patients

### B3: Clinic/Tenant Concept (Future)
- **For later**: When multiple clinics use the system
- [ ] Add `clinic_id` to profiles, appointments, consultations
- [ ] Each clinic has its own dentists, assistants, patients
- [ ] Cross-clinic data is completely isolated

---

## PHASE C: AI MODEL UPGRADE

### C1: Evaluate & Replace Gemini 2.0
- **Current**: Gemini 2.0 Flash for all AI features
- **Files using Gemini directly**:
  - `lib/services/gemini-ai.ts` (central service - main file to change)
  - `lib/services/appointment-conversation-parser.ts`
  - `lib/services/ai-task-parser.ts`
  - `lib/services/ai-appointment-parser.ts`
  - `lib/services/nl-filter-extractor.ts`
  - `lib/services/endoflow-master-ai.ts`
  - `lib/services/medical-conversation-parser.ts`
- **Options**:
  - [ ] Upgrade to Gemini 2.5 Pro/Flash (easiest - same SDK)
  - [ ] Switch to Claude API (better reasoning, more context)
  - [ ] Hybrid approach (Gemini for simple tasks, Claude for complex RAG)
- **Action**: Swap model in `gemini-ai.ts` first, test, then update parser services

### C2: Improve RAG Pipeline
- **Problem**: Current RAG with Gemini 2.0 lacks context memory
- [ ] Evaluate embedding model (currently gemini-embedding-001, 768 dimensions)
- [ ] Consider better vector search with pgvector
- [ ] Add conversation memory/context window management

---

## PHASE D: WHISPER VOICE RECOGNITION

### D1: Replace Web Speech API with Whisper
- **Current**: Browser's `webkitSpeechRecognition` (poor Hindi support)
- **Target**: OpenAI Whisper API (excellent multilingual, Hindi/Hinglish)
- **Files to modify**:
  - [ ] `lib/hooks/use-speech-recognition.ts` (core hook - record audio, send to Whisper)
  - [ ] `components/dentist/endoflow-voice-controller.tsx`
  - [ ] `components/dentist/fdi-voice-control.tsx`
  - [ ] `components/consultation/GlobalVoiceRecorder.tsx`
  - [ ] `components/appointment/AppointmentVoiceRecorder.tsx`
- **New files needed**:
  - [ ] `app/api/voice/transcribe/route.ts` (new API endpoint for Whisper)
- **Package changes**: Add `openai` SDK

---

## PHASE E: MOBILE-RESPONSIVE DENTIST DASHBOARD

### E1: Integrate Mobile Navigation
- **Exists but not used**: `components/dentist/mobile-dentist-navigation.tsx`
- [ ] Import into main dentist page
- [ ] Show mobile nav on small screens, desktop nav on large
- [ ] Add viewport detection (useMediaQuery or CSS breakpoints)

### E2: Fix Hard-Coded Layouts
- **Critical fixes**:
  - [ ] `clinical-cockpit.tsx`: 8-column grid → responsive (2 cols mobile, 4 tablet, 8 desktop)
  - [ ] Dialog components: `max-w-6xl` → responsive sizing
  - [ ] `ResizablePanel` components → stack vertically on mobile
  - [ ] Fixed SVG sizes → responsive scaling
- **Components needing work**:
  - [ ] `app/dentist/page.tsx` - main layout
  - [ ] `clinical-cockpit.tsx` - most complex
  - [ ] `interactive-dental-chart.tsx` - needs mobile version
  - [ ] `messages-chat-interface.tsx` - resizable panels
  - [ ] All dialog/modal components

### E3: Touch Optimization
- [ ] Larger touch targets for mobile
- [ ] Swipe gestures for navigation
- [ ] Mobile-friendly dental chart interaction

---

## PHASE F: PRODUCTION READINESS (Future)

### F1: Backend Clarification
- **RESOLVED**: Next.js IS full-stack. 47 server actions + 12 API routes = backend
- **No Python needed** unless self-hosting ML models
- **Already on Vercel** and running

### F2: Security Hardening
- [ ] Proper RLS policies on all tables
- [ ] Move from service role key to authenticated user queries where possible
- [ ] Add rate limiting
- [ ] HIPAA compliance review

### F3: Performance Optimization
- [ ] Connection pooling (PgBouncer)
- [ ] Query optimization for large datasets
- [ ] Caching strategy (SWR is already in place)
- [ ] CDN for static assets

---

## SUPABASE SCALABILITY REFERENCE

| Scale | Users | DB Size | Plan | Est. Cost |
|-------|-------|---------|------|-----------|
| Current (testing) | ~53 | <100 MB | Free | $0 |
| 10 dentists | ~5,500 | ~500 MB | Free/Pro | $0-25/mo |
| 100 dentists | ~55,000 | ~2 GB | Pro | $25/mo + storage |
| 500 dentists | ~251,000 | ~10 GB | Pro/Team | $100-600/mo |
| 5,000 dentists | ~2.5M | ~100 GB | Enterprise | Custom |

**Storage costs**: Medical files at $0.021/GB/mo
**Verdict**: Supabase is fine up to 5,000+ dentists. No need to migrate.

---

## CURRENT DATABASE STATE (as of 2026-03-25)

### Profiles Summary
- 53 total profiles
- 3 dentists (all active): Dr. Nisarg, Test Dentist, nisarg@endoflow.com
- 1 assistant (active): Test Assistant
- 49 patients (27 active, 21 pending, 1 inactive)

### Schema Architecture
- `public` schema: profiles table, views
- `api` schema: 40+ application tables
- `auth` schema: Supabase managed (currently broken after restore)

### Working Tables (10): profiles, patients, dentists, assistants, appointments, treatments, messages, consultations, pending_registrations, research_projects
### Broken/Inaccessible Tables (34): Need GRANT permissions

---

## SESSION NOTES

### Session 1 (2026-03-25): Project Restart
- Restored Supabase from pause
- Connected Supabase MCP plugin
- Full database audit completed
- Identified auth system broken after restore
- Created this master plan

### Checklist for Next Session
1. Fix auth (A1) - may need Supabase Dashboard action
2. Create 3 login portals (A2)
3. Fix table permissions (A3)
4. Clean up data (A4)
5. Add middleware protection (A5)
6. Begin multi-dentist scoping (B1)
