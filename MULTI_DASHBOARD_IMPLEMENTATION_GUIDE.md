# Multi-Dashboard Implementation Guide for EndoFlow

## Table of Contents
1. [Overview](#overview)
2. [System Architecture](#system-architecture)
3. [Database Schema & PostgREST Patterns](#database-schema--postgrest-patterns)
4. [Authentication & Role-Based Access](#authentication--role-based-access)
5. [Supabase Service Client Patterns](#supabase-service-client-patterns)
6. [Data Fetching & Error Handling](#data-fetching--error-handling)
7. [Date Formatting & Field Mapping](#date-formatting--field-mapping)
8. [Real-time Data Synchronization](#real-time-data-synchronization)
9. [Common Pitfalls & Solutions](#common-pitfalls--solutions)
10. [Code Patterns & Best Practices](#code-patterns--best-practices)
11. [Troubleshooting Guide](#troubleshooting-guide)
12. [Migration Examples](#migration-examples)

---

## Overview

This guide documents the successful implementation of multi-dashboard realtime features in EndoFlow, covering the patterns and solutions that enable seamless data sharing between Patient, Dentist, and Assistant dashboards.

**Key Achievements:**
- ✅ Fixed PostgREST foreign key relationship errors
- ✅ Implemented robust consultation fetching with 3+ consultations working
- ✅ Resolved date formatting RangeErrors
- ✅ Established role-based data access patterns
- ✅ Created reusable server action patterns

**Last Updated:** September 21, 2025  
**Version:** 1.0  
**Applied to:** EndoFlow v3

---

## System Architecture

### Dashboard Relationships
```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Patient   │    │   Dentist   │    │  Assistant  │
│  Dashboard  │    │  Dashboard  │    │  Dashboard  │
└─────────────┘    └─────────────┘    └─────────────┘
       │                   │                   │
       └───────────────────┼───────────────────┘
                           │
                ┌─────────────────┐
                │  Shared Data    │
                │  - Consultations │
                │  - Appointments │
                │  - Patient Files │
                │  - Messages     │
                └─────────────────┘
```

### Data Flow Pattern
1. **Server Actions** handle all data mutations
2. **Role-based filtering** ensures data security
3. **Real-time updates** sync changes across dashboards
4. **Optimistic UI** provides immediate feedback

### Component Architecture
```
app/
├── patient/page.tsx        # Patient dashboard entry
├── dentist/page.tsx        # Dentist dashboard entry
├── assistant/page.tsx      # Assistant dashboard entry
├── components/
│   ├── consultation-history.tsx    # Shared consultation component
│   ├── patient-files-viewer.tsx    # Shared file viewer
│   └── appointment-calendar.tsx    # Shared calendar
└── lib/
    ├── actions/
    │   ├── consultations.ts        # Consultation server actions
    │   ├── patient-files.ts        # File management actions
    │   └── auth.ts                 # Authentication helpers
    └── supabase/
        ├── client.ts              # Client-side Supabase
        └── server.ts              # Server-side Supabase
```

---

## Database Schema & PostgREST Patterns

### The PostgREST Foreign Key Problem

**❌ Original Issue:**
```typescript
// This FAILS when foreign keys aren't properly set up
const { data, error } = await supabase
  .from('consultations')
  .select(`
    *,
    dentists!dentist_id (
      id,
      full_name,
      specialty
    )
  `)
```

**Error:** `Could not find a relationship between 'consultations' and 'dentists' using the hint 'dentist_id'`

### ✅ Solution: Separate Queries with Manual Mapping

```typescript
// lib/actions/consultations.ts
export async function getPatientConsultations(patientId?: string) {
  // 1. Fetch main data without joins
  const { data: consultations, error } = await supabase
    .schema('api')
    .from('consultations')
    .select('*')  // No joins!
    .eq('patient_id', targetPatientId)
    .order('consultation_date', { ascending: false })

  // 2. Get related data separately
  let dentistsData: any[] = []
  if (consultations && consultations.length > 0) {
    const dentistIds = [...new Set(consultations.map(c => c.dentist_id).filter(Boolean))]
    
    const { data: dentists } = await supabase
      .schema('api')
      .from('dentists')
      .select('id, full_name, specialty')
      .in('id', dentistIds)
    
    dentistsData = dentists || []
  }

  // 3. Map relationships manually
  const consultationData = consultations?.map(consultation => {
    const consultationDentist = dentistsData.find(d => d.id === consultation.dentist_id)
    
    return {
      ...consultation,
      dentistName: consultationDentist?.full_name || 'Unknown Dentist',
    }
  })

  return { success: true, data: consultationData }
}
```

### Database Schema Requirements

**Essential Tables:**
```sql
-- Core tables that must exist
api.consultations
api.dentists  
api.patients
api.patient_files
api.appointments
api.messages
api.treatments

-- With proper foreign key constraints for PostgREST
ALTER TABLE api.consultations 
ADD CONSTRAINT fk_consultations_dentist_id 
FOREIGN KEY (dentist_id) REFERENCES auth.users(id);
```

### Row Level Security (RLS) Patterns

```sql
-- Patients can view their own consultations
CREATE POLICY "users_can_access_own_consultations" ON api.consultations
FOR SELECT TO authenticated USING (
    patient_id = auth.uid() OR
    dentist_id = auth.uid() OR
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND role IN ('assistant', 'dentist') 
        AND status = 'active'
    )
);

-- Service role has full access (for server actions)
CREATE POLICY "service_role_can_access_consultations" ON api.consultations
FOR ALL TO service_role USING (true);
```

---

## Authentication & Role-Based Access

### Authentication Flow

```typescript
// lib/actions/auth.ts
export async function getCurrentUser() {
  const supabase = await createServiceClient()
  
  // Get auth user
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (!user || authError) return null

  // Get profile with role
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, role, status, full_name')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) return null

  return {
    id: user.id,
    email: user.email,
    role: profile.role,
    status: profile.status,
    fullName: profile.full_name
  }
}
```

### Role-Based Data Filtering

```typescript
// In server actions - always check role before data access
export async function getPatientConsultations(patientId?: string) {
  const user = await getCurrentUser()
  if (!user) {
    return { success: false, error: 'Unauthorized' }
  }

  // Role-based access control
  const targetPatientId = patientId || (user.role === 'patient' ? user.id : null)
  
  // Patients can only access their own data
  if (user.role === 'patient' && user.id !== targetPatientId) {
    return { success: false, error: 'Access denied' }
  }

  // Staff can access any patient's data
  if (!['assistant', 'dentist'].includes(user.role) && user.role !== 'patient') {
    return { success: false, error: 'Insufficient permissions' }
  }

  // Proceed with data fetching...
}
```

### Protected Route Middleware

```typescript
// middleware.ts
export async function middleware(request: NextRequest) {
  const { supabase, response } = createServerClient(request)
  
  // Get user session
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user && request.nextUrl.pathname.startsWith('/patient')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Role-based redirects
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role === 'patient' && request.nextUrl.pathname.startsWith('/dentist')) {
      return NextResponse.redirect(new URL('/patient', request.url))
    }
  }

  return response
}
```

---

## Supabase Service Client Patterns

### Server-Side Service Client

```typescript
// lib/supabase/server.ts
import { createClient } from '@supabase/supabase-js'

export async function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!, // Service role key for elevated permissions
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  )
}
```

**Key Benefits:**
- ✅ Bypasses RLS for administrative operations
- ✅ Can access any table/row regardless of user context
- ✅ Perfect for server actions that need elevated permissions

### Client-Side Client

```typescript
// lib/supabase/client.ts  
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! // Anon key for user-level operations
  )
}
```

**Usage Pattern:**
- ✅ Use for client-side authentication
- ✅ Use for real-time subscriptions
- ✅ Respects RLS policies
- ✅ Limited to user's permitted data

### Environment Variables Required

```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key  # Keep secret!
```

---

## Data Fetching & Error Handling

### Server Action Pattern

```typescript
export async function getPatientConsultations(patientId?: string): Promise<{
  success: boolean
  data?: ConsultationData[]
  error?: string
}> {
  try {
    // 1. Authentication check
    const user = await getCurrentUser()
    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    // 2. Authorization check
    const targetPatientId = patientId || (user.role === 'patient' ? user.id : null)
    if (user.role === 'patient' && user.id !== targetPatientId) {
      return { success: false, error: 'Access denied' }
    }

    // 3. Data fetching with error handling
    const supabase = await createServiceClient()
    const { data: consultations, error: consultationsError } = await supabase
      .schema('api')
      .from('consultations')
      .select('*')
      .eq('patient_id', targetPatientId)
      .order('consultation_date', { ascending: false })

    // 4. Handle database errors
    if (consultationsError) {
      console.error('Error fetching consultations:', consultationsError)
      return { success: false, error: 'Failed to fetch consultation data' }
    }

    // 5. Process and return data
    return { success: true, data: consultations || [] }

  } catch (error) {
    // 6. Catch unexpected errors
    console.error('Error in getPatientConsultations:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    }
  }
}
```

### Client-Side Usage Pattern

```typescript
// components/consultation-history.tsx
const [consultations, setConsultations] = useState<ConsultationData[]>([])
const [loading, setLoading] = useState(true)
const [error, setError] = useState<string | null>(null)

const loadConsultations = async () => {
  try {
    setLoading(true)
    setError(null)

    const result = await getPatientConsultations(patientId)

    if (result.success) {
      setConsultations(result.data || [])
    } else {
      setError(result.error || 'Failed to load consultation history')
    }
  } catch (err) {
    console.error('Error loading consultations:', err)
    setError('Failed to load consultation history')
  } finally {
    setLoading(false)
  }
}

useEffect(() => {
  loadConsultations()
}, [patientId])
```

### Loading States & Error Boundaries

```typescript
if (loading) {
  return (
    <Card>
      <CardContent>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
        </div>
      </CardContent>
    </Card>
  )
}

if (error) {
  return (
    <Card>
      <CardContent>
        <div className="text-center py-8">
          <p className="text-red-600 mb-4">{error}</p>
          <Button onClick={loadConsultations} variant="outline">
            Try Again
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
```

---

## Date Formatting & Field Mapping

### The Date Formatting Problem

**❌ Original Error:**
```
RangeError: Invalid time value at format()
```

**Root Cause:** Database returns `created_at` but component expects `createdAt`

### ✅ Solution: Field Mapping + Safe Date Formatting

```typescript
// lib/actions/patient-files.ts
const filesWithUploaders = files?.map(file => {
  return {
    // Map database fields to camelCase
    id: file.id,
    patientId: file.patient_id,
    uploadedBy: file.uploaded_by,
    fileName: file.file_name,
    originalFileName: file.original_file_name,
    filePath: file.file_path,
    fileSize: file.file_size,
    mimeType: file.mime_type,
    fileType: file.file_type,
    description: file.description,
    isArchived: file.is_archived,
    createdAt: file.created_at,  // ✅ Consistent naming
    updatedAt: file.updated_at,
    uploader: uploader ? { id: uploader.id, full_name: uploader.full_name } : null
  }
})
```

### Safe Date Formatting Pattern

```typescript
// components/patient-files-viewer.tsx
const formatDateSafely = (dateValue: string | null | undefined, formatStr: string = 'MMM d, yyyy') => {
  try {
    if (!dateValue) return 'Unknown date'
    const date = new Date(dateValue)
    if (isNaN(date.getTime())) return 'Invalid date'
    return format(date, formatStr)
  } catch {
    return 'Invalid date'
  }
}

// Usage in component
{formatDateSafely(file.createdAt)}
```

### TypeScript Interfaces for Type Safety

```typescript
export interface ConsultationData {
  id: string
  consultationDate: string
  dentistId: string
  dentistName: string
  appointmentId?: string
  chiefComplaint?: string
  hopi?: string
  painScore?: number
  diagnosis?: string
  treatmentPlan?: string
  // ... other fields
}

export interface PatientFile {
  id: string
  patientId: string
  uploadedBy: string
  fileName: string
  originalFileName: string
  filePath: string
  fileSize: number
  mimeType: string
  fileType: string
  description: string
  isArchived: boolean
  createdAt: string  // Always string from API
  updatedAt: string
  uploader?: {
    id: string
    full_name: string
  }
}
```

---

## Real-time Data Synchronization

### Supabase Real-time Setup

```typescript
// hooks/useRealtimeConsultations.ts
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export function useRealtimeConsultations(patientId: string) {
  const [consultations, setConsultations] = useState<ConsultationData[]>([])
  const supabase = createClient()

  useEffect(() => {
    // Initial data load
    loadConsultations()

    // Set up real-time subscription
    const channel = supabase
      .channel(`consultations:${patientId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'api',
          table: 'consultations',
          filter: `patient_id=eq.${patientId}`
        },
        (payload) => {
          console.log('Consultation updated:', payload)
          
          if (payload.eventType === 'INSERT') {
            setConsultations(prev => [payload.new, ...prev])
          } else if (payload.eventType === 'UPDATE') {
            setConsultations(prev => 
              prev.map(c => c.id === payload.new.id ? payload.new : c)
            )
          } else if (payload.eventType === 'DELETE') {
            setConsultations(prev => 
              prev.filter(c => c.id !== payload.old.id)
            )
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [patientId])

  return { consultations, loading, error }
}
```

### Optimistic Updates Pattern

```typescript
const [consultations, setConsultations] = useState<ConsultationData[]>([])

const createConsultation = async (data: CreateConsultationData) => {
  // 1. Optimistic update
  const tempId = `temp-${Date.now()}`
  const optimisticConsultation = {
    id: tempId,
    ...data,
    createdAt: new Date().toISOString()
  }
  
  setConsultations(prev => [optimisticConsultation, ...prev])

  try {
    // 2. Server request
    const result = await createConsultationAction(data)
    
    if (result.success) {
      // 3. Replace optimistic with real data
      setConsultations(prev =>
        prev.map(c => c.id === tempId ? result.data : c)
      )
    } else {
      // 4. Rollback on error
      setConsultations(prev =>
        prev.filter(c => c.id !== tempId)
      )
      throw new Error(result.error)
    }
  } catch (error) {
    // 5. Handle error and rollback
    setConsultations(prev =>
      prev.filter(c => c.id !== tempId)
    )
    throw error
  }
}
```

---

## Common Pitfalls & Solutions

### 1. PostgREST Relationship Errors

**❌ Problem:**
```
PGRST200: Could not find a relationship between 'consultations' and 'dentists'
```

**✅ Solution:**
- Use separate queries instead of joins
- Map relationships manually in server actions
- Ensure foreign key constraints exist in database

### 2. Authentication Context Issues

**❌ Problem:**
```typescript
// This fails in server components
const supabase = createClient()
const { data: user } = await supabase.auth.getUser() // null in server context
```

**✅ Solution:**
```typescript
// Use service client for server-side operations
const supabase = await createServiceClient()
const user = await getCurrentUser() // Custom helper that works server-side
```

### 3. Date Formatting Race Conditions

**❌ Problem:**
```typescript
format(new Date(file.createdAt), 'MMM d, yyyy') // RangeError if createdAt is null/invalid
```

**✅ Solution:**
```typescript
const formatDateSafely = (dateValue: unknown) => {
  try {
    if (!dateValue) return 'Unknown date'
    const date = new Date(dateValue as string)
    if (isNaN(date.getTime())) return 'Invalid date'
    return format(date, 'MMM d, yyyy')
  } catch {
    return 'Invalid date'
  }
}
```

### 4. Component Re-render Loops

**❌ Problem:**
```typescript
useEffect(() => {
  loadData()
}, [user]) // Re-renders on every user object change
```

**✅ Solution:**
```typescript
useEffect(() => {
  loadData()
}, [user?.id, user?.role]) // Only re-render on meaningful changes
```

### 5. TypeScript Type Mismatches

**❌ Problem:**
```typescript
interface Patient {
  createdAt: Date // Expected Date object
}

// But API returns string
const patient = { createdAt: "2023-01-01T00:00:00Z" }
```

**✅ Solution:**
```typescript
interface Patient {
  createdAt: string // API always returns strings
}

// Transform in component if needed
const createdAtDate = new Date(patient.createdAt)
```

---

## Code Patterns & Best Practices

### 1. Reusable Data Fetching Hook

```typescript
// hooks/useAsyncData.ts
export function useAsyncData<T>(
  asyncFn: () => Promise<{ success: boolean; data?: T; error?: string }>,
  deps: React.DependencyList = []
) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const execute = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      
      const result = await asyncFn()
      
      if (result.success) {
        setData(result.data || null)
      } else {
        setError(result.error || 'Unknown error')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, deps)

  useEffect(() => {
    execute()
  }, [execute])

  return { data, loading, error, refetch: execute }
}

// Usage
const { data: consultations, loading, error } = useAsyncData(
  () => getPatientConsultations(patientId),
  [patientId]
)
```

### 2. Consistent Server Action Structure

```typescript
export async function serverActionTemplate<T>(
  // Parameters
  params: any
): Promise<{ success: boolean; data?: T; error?: string }> {
  try {
    // 1. Authentication
    const user = await getCurrentUser()
    if (!user) return { success: false, error: 'Unauthorized' }

    // 2. Authorization
    if (!hasPermission(user, 'required-permission')) {
      return { success: false, error: 'Access denied' }
    }

    // 3. Validation
    const validatedParams = validateParams(params)
    if (!validatedParams.valid) {
      return { success: false, error: validatedParams.error }
    }

    // 4. Database operation
    const supabase = await createServiceClient()
    const { data, error: dbError } = await supabase
      .from('table')
      .insert(validatedParams.data)
      .select()

    if (dbError) {
      console.error('Database error:', dbError)
      return { success: false, error: 'Database operation failed' }
    }

    // 5. Revalidation (for caching)
    revalidatePath('/relevant-paths')

    // 6. Return success
    return { success: true, data }

  } catch (error) {
    console.error('Server action error:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }
  }
}
```

### 3. Component Composition Pattern

```typescript
// Separate concerns into focused components

// Data Container Component
function ConsultationHistoryContainer({ patientId }: { patientId: string }) {
  const { data: consultations, loading, error, refetch } = useAsyncData(
    () => getPatientConsultations(patientId),
    [patientId]
  )

  if (loading) return <ConsultationHistoryLoading />
  if (error) return <ConsultationHistoryError error={error} onRetry={refetch} />
  if (!consultations?.length) return <ConsultationHistoryEmpty />

  return <ConsultationHistoryList consultations={consultations} />
}

// Presentation Component
function ConsultationHistoryList({ consultations }: { consultations: ConsultationData[] }) {
  return (
    <div className="space-y-4">
      {consultations.map(consultation => (
        <ConsultationCard key={consultation.id} consultation={consultation} />
      ))}
    </div>
  )
}
```

---

## Troubleshooting Guide

### Common Error Messages

#### 1. `PGRST200: Could not find a relationship...`
**Cause:** PostgREST can't find foreign key relationship  
**Fix:** Use separate queries instead of joins  
**Prevention:** Set up proper foreign key constraints

#### 2. `RangeError: Invalid time value`
**Cause:** Attempting to format null/invalid dates  
**Fix:** Add null checks before date formatting  
**Prevention:** Use safe date formatting helper functions

#### 3. `Unauthorized` in server actions
**Cause:** User session not found or expired  
**Fix:** Check authentication flow and session persistence  
**Prevention:** Implement proper middleware and auth checks

#### 4. `Access denied` for cross-role data access
**Cause:** Patient trying to access dentist data or vice versa  
**Fix:** Review role-based authorization logic  
**Prevention:** Implement consistent permission checking

### Debugging Strategies

#### 1. Server Action Debugging
```typescript
export async function debuggableAction() {
  console.log('🔍 [ACTION] Starting action execution')
  
  try {
    const user = await getCurrentUser()
    console.log('✅ [AUTH] User authenticated:', user?.id, user?.role)
    
    const result = await performDatabaseOperation()
    console.log('✅ [DB] Database operation successful:', result)
    
    return { success: true, data: result }
  } catch (error) {
    console.error('❌ [ERROR] Action failed:', error)
    return { success: false, error: error.message }
  }
}
```

#### 2. Component State Debugging
```typescript
function DebuggableComponent() {
  const [data, setData] = useState(null)
  
  useEffect(() => {
    console.log('🔍 [COMPONENT] Data changed:', data)
  }, [data])

  useEffect(() => {
    console.log('🔍 [COMPONENT] Component mounted/unmounted')
    return () => console.log('🔍 [COMPONENT] Cleanup')
  }, [])

  // Component implementation...
}
```

#### 3. Network Request Debugging
```typescript
// In browser dev tools, monitor:
// - Network tab for failed requests
// - Console for server action logs
// - Application tab for Supabase session state
```

### Performance Profiling

#### 1. React Developer Tools
- Install React Developer Tools browser extension
- Use Profiler tab to identify slow components
- Look for unnecessary re-renders

#### 2. Database Query Optimization
```sql
-- Enable query logging in Supabase
-- Monitor slow queries in Dashboard > Settings > Database
-- Add indexes for frequently queried columns

CREATE INDEX IF NOT EXISTS idx_consultations_patient_date 
ON api.consultations(patient_id, consultation_date);
```

#### 3. Bundle Analysis
```bash
# Analyze bundle size
npm run build
npm run analyze  # If configured

# Look for large dependencies that could be lazy-loaded
```

---

## Migration Examples

### Before/After: Consultation Fetching

#### ❌ Before (Broken)
```typescript
const { data: consultations, error } = await supabase
  .from('consultations')
  .select(`
    *,
    dentists!dentist_id (
      id,
      full_name,
      specialty
    )
  `)
  .eq('patient_id', patientId)

// This would fail with PGRST200 error
```

#### ✅ After (Working)
```typescript
// 1. Fetch consultations without joins
const { data: consultations, error: consultationsError } = await supabase
  .schema('api')
  .from('consultations')
  .select('*')
  .eq('patient_id', targetPatientId)
  .order('consultation_date', { ascending: false })

// 2. Get dentist information separately
let dentistsData: any[] = []
if (consultations && consultations.length > 0) {
  const dentistIds = [...new Set(consultations.map(c => c.dentist_id).filter(Boolean))]
  if (dentistIds.length > 0) {
    const { data: dentists } = await supabase
      .schema('api')
      .from('dentists')
      .select('id, full_name, specialty')
      .in('id', dentistIds)
    
    dentistsData = dentists || []
  }
}

// 3. Map relationships manually
const consultationData = consultations?.forEach(consultation => {
  const consultationDentist = dentistsData.find(d => d.id === consultation.dentist_id)
  
  return {
    ...consultation,
    dentistName: consultationDentist?.full_name || 'Unknown Dentist',
  }
})
```

### Before/After: Date Formatting

#### ❌ Before (Error-Prone)
```typescript
// This could throw RangeError
<p>{format(new Date(file.createdAt), 'MMM d, yyyy')}</p>
```

#### ✅ After (Safe)
```typescript
// Safe date formatting with error handling
{(() => {
  try {
    if (!file.createdAt) return 'Unknown date'
    const date = new Date(file.createdAt)
    if (isNaN(date.getTime())) return 'Invalid date'
    return format(date, 'MMM d, yyyy')
  } catch {
    return 'Invalid date'
  }
})()}
```

### Migration Checklist

When implementing new multi-dashboard features:

- [ ] ✅ Use separate queries instead of complex joins
- [ ] ✅ Implement proper role-based authorization
- [ ] ✅ Add safe date formatting with null checks
- [ ] ✅ Use TypeScript interfaces for type safety
- [ ] ✅ Implement loading states and error boundaries
- [ ] ✅ Add proper logging for debugging
- [ ] ✅ Set up real-time subscriptions if needed
- [ ] ✅ Test with different user roles
- [ ] ✅ Verify RLS policies are working
- [ ] ✅ Add revalidation for cached data

---

## Conclusion

This guide captures the essential patterns and solutions that make multi-dashboard realtime features work reliably in EndoFlow. The key insights are:

1. **Avoid complex PostgREST joins** - Use separate queries and manual mapping
2. **Always validate authentication and authorization** - Check user context in every server action
3. **Handle edge cases gracefully** - Safe date formatting, null checks, error boundaries
4. **Use consistent patterns** - Server action structure, error handling, loading states
5. **Leverage TypeScript** - Type safety prevents many runtime errors

By following these patterns, you can implement new features efficiently without spending time debugging the same issues repeatedly.

---

**📝 Keep this guide updated** as you implement new features and discover additional patterns!