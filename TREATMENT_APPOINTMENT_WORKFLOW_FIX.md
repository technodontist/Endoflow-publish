# Treatment Appointment Workflow Fix

## Issue Description

**Problem:** When creating a treatment-type appointment via contextual appointment, the treatment was automatically marked as "Completed" instead of staying in "Planned" status.

**Expected Behavior:**
1. Create treatment appointment → Treatment status: **"Planned"**
2. Start appointment → Treatment status: **"In Progress"**
3. Mark appointment complete → Treatment status: **"Completed"**

**Actual Behavior (Before Fix):**
1. Create treatment appointment → Treatment status: **"Completed"** ❌ (WRONG!)

---

## Root Cause

In `lib/actions/contextual-appointments.ts` (lines 74-88), when creating a treatment appointment, the code was automatically setting:

```typescript
.update({
  planned_status: 'In Progress',  // ❌ Wrong - should be 'Planned'
  status: 'in_progress',           // ❌ Wrong - should be 'planned'
  started_at: new Date().toISOString()  // ❌ Wrong - should only set when started
})
```

This meant that **scheduling** a treatment appointment immediately moved it to "In Progress", which then triggered the completion logic when the appointment status changed, resulting in the treatment being marked as complete.

---

## The Fix

### File Modified: `lib/actions/contextual-appointments.ts`

**Before (Lines 74-88):**
```typescript
// 2) If Treatment: move treatment to In Progress in both planned and legacy flows
if (appointmentType === 'treatment' && treatmentId) {
  const { error: treatErr } = await supabase
    .schema('api')
    .from('treatments')
    .update({
      planned_status: 'In Progress',
      status: 'in_progress',
      started_at: new Date().toISOString()
    })
    .eq('id', treatmentId);

  if (treatErr) {
    console.warn('[CTX_APPT] Could not bump treatment to In Progress:', treatErr);
  }
}
```

**After (Fixed):**
```typescript
// 2) If Treatment: keep treatment as Planned (will be moved to In Progress when appointment starts)
// Don't auto-start treatment just because appointment is scheduled
if (appointmentType === 'treatment' && treatmentId) {
  const { error: treatErr } = await supabase
    .schema('api')
    .from('treatments')
    .update({
      planned_status: 'Planned',
      status: 'planned',
      // Don't set started_at until appointment actually starts
      updated_at: new Date().toISOString()
    })
    .eq('id', treatmentId);

  if (treatErr) {
    console.warn('[CTX_APPT] Could not update treatment status:', treatErr);
  }
}
```

---

## Correct Workflow

### Step 1: Create Treatment Appointment
```
User Action: Create treatment appointment via contextual appointment
↓
Database Changes:
- appointments table: status = 'scheduled' ✅
- treatments table: planned_status = 'Planned', status = 'planned' ✅
```

### Step 2: Start Appointment
```
User Action: Click "Start Appointment" button
↓
API Call: updateAppointmentStatusAction(appointmentId, 'in_progress')
↓
Database Changes:
- appointments table: status = 'in_progress' ✅
- treatments table (via trigger): planned_status = 'In Progress', status = 'in_progress' ✅
- treatments table: started_at = timestamp ✅
```

### Step 3: Complete Appointment
```
User Action: Click "Mark Complete" button
↓
API Call: updateAppointmentStatusAction(appointmentId, 'completed')
↓
Database Changes:
- appointments table: status = 'completed' ✅
- treatments table (via trigger): planned_status = 'Completed', status = 'completed' ✅
- treatments table: completed_at = timestamp ✅
```

---

## Status Flow Diagram

```
Treatment Appointment Lifecycle:

CREATE APPOINTMENT
    ↓
┌────────────────────┐
│ Status: Scheduled  │
│ Treatment: Planned │  ← Initial state after creation
└────────────────────┘
    ↓
START APPOINTMENT (User clicks "Start")
    ↓
┌───────────────────────┐
│ Status: In Progress   │
│ Treatment: In Progress│  ← Active treatment session
└───────────────────────┘
    ↓
COMPLETE APPOINTMENT (User clicks "Mark Complete")
    ↓
┌──────────────────────┐
│ Status: Completed    │
│ Treatment: Completed │  ← Treatment finished
└──────────────────────┘
```

---

## How Status Transitions Work

The system uses `lib/actions/treatments.ts` function `updateTreatmentsForAppointmentStatusAction()` to sync treatment status with appointment status:

### When Appointment Changes to "in_progress":
```typescript
if (newStatus === 'in_progress') {
  if (tr.status !== 'completed') {
    patch.status = 'in_progress'
    if (!tr.started_at) patch.started_at = new Date().toISOString()
  }
}
```

### When Appointment Changes to "completed":
```typescript
else if (newStatus === 'completed') {
  const total = tr.total_visits || 1
  const done = (tr.completed_visits || 0) + 1
  if (done >= total) {
    patch.status = 'completed'
    patch.completed_visits = total
    patch.completed_at = new Date().toISOString()
  } else {
    patch.status = 'in_progress'
    patch.completed_visits = done
    if (!tr.started_at) patch.started_at = new Date().toISOString()
  }
}
```

---

## Testing the Fix

### Test Case 1: Create Treatment Appointment
```javascript
// 1. Create treatment appointment
const result = await createContextualAppointment({
  patientId: 'patient-123',
  dentistId: 'dentist-456',
  scheduledDate: '2025-10-15',
  scheduledTime: '14:00',
  appointmentType: 'treatment',
  treatmentId: 'treatment-789',
  consultationId: 'consultation-101'
});

// 2. Verify appointment status
const appointment = await getAppointment(result.data.id);
expect(appointment.status).toBe('scheduled'); // ✅

// 3. Verify treatment status
const treatment = await getTreatment('treatment-789');
expect(treatment.status).toBe('planned'); // ✅
expect(treatment.planned_status).toBe('Planned'); // ✅
expect(treatment.started_at).toBeNull(); // ✅
```

### Test Case 2: Start Appointment
```javascript
// 1. Start the appointment
await updateAppointmentStatus(appointmentId, 'in_progress');

// 2. Verify appointment status
const appointment = await getAppointment(appointmentId);
expect(appointment.status).toBe('in_progress'); // ✅

// 3. Verify treatment status
const treatment = await getTreatment('treatment-789');
expect(treatment.status).toBe('in_progress'); // ✅
expect(treatment.planned_status).toBe('In Progress'); // ✅
expect(treatment.started_at).not.toBeNull(); // ✅
```

### Test Case 3: Complete Appointment
```javascript
// 1. Complete the appointment
await updateAppointmentStatus(appointmentId, 'completed');

// 2. Verify appointment status
const appointment = await getAppointment(appointmentId);
expect(appointment.status).toBe('completed'); // ✅

// 3. Verify treatment status
const treatment = await getTreatment('treatment-789');
expect(treatment.status).toBe('completed'); // ✅
expect(treatment.planned_status).toBe('Completed'); // ✅
expect(treatment.completed_at).not.toBeNull(); // ✅
```

---

## Manual Testing Steps

### 1. Create Treatment Appointment

**Steps:**
1. Go to Dentist Dashboard
2. Click on a patient
3. Click "Create Contextual Appointment"
4. Select appointment type: **"Treatment"**
5. Fill in date, time, and treatment details
6. Click "Create Appointment"

**Expected Result:**
- ✅ Appointment shows status: **"Scheduled"**
- ✅ Treatment shows status: **"Planned"** (not "Completed")
- ✅ FDI chart shows tooth with orange/attention color (not green/filled)

**Verify in UI:**
- Appointment card should show "Scheduled" badge
- Treatment plan should show "Planned" status
- No "started_at" timestamp

---

### 2. Start Treatment Appointment

**Steps:**
1. Find the scheduled treatment appointment
2. Click "Start Appointment" button
3. Observe status changes

**Expected Result:**
- ✅ Appointment status changes to: **"In Progress"**
- ✅ Treatment status changes to: **"In Progress"**
- ✅ "started_at" timestamp is set
- ✅ Consultation form opens for treatment documentation

**Verify in UI:**
- Appointment card should show "In Progress" badge (blue)
- Treatment plan should show "In Progress" status
- Timer/duration tracking may appear

---

### 3. Complete Treatment Appointment

**Steps:**
1. While appointment is "In Progress"
2. Document treatment performed
3. Click "Mark as Complete" button
4. Confirm completion

**Expected Result:**
- ✅ Appointment status changes to: **"Completed"**
- ✅ Treatment status changes to: **"Completed"**
- ✅ "completed_at" timestamp is set
- ✅ FDI chart updates (tooth color may change based on treatment outcome)

**Verify in UI:**
- Appointment card should show "Completed" badge (green)
- Treatment plan should show "Completed" status with checkmark
- Completion timestamp visible
- Tooth status reflects successful treatment

---

## Related Files

### Files Modified:
- ✅ `lib/actions/contextual-appointments.ts` (Lines 74-89)

### Related Files (No Changes Needed):
- `lib/actions/treatments.ts` - Contains the status update logic
- `lib/services/appointments.ts` - Handles appointment status changes
- `components/dentist/appointment-organizer.tsx` - UI for managing appointments
- `components/appointments/PatientTreatmentAppointments.tsx` - Patient-facing appointments

---

## Database Schema Verification

### Appointments Table:
```sql
SELECT id, patient_id, appointment_type, status, scheduled_date, scheduled_time, treatment_id
FROM api.appointments
WHERE id = 'appointment-id';
```

**Expected After Creation:**
- status: 'scheduled'
- treatment_id: (linked treatment ID)

### Treatments Table:
```sql
SELECT id, tooth_number, treatment_type, status, planned_status, started_at, completed_at
FROM api.treatments
WHERE id = 'treatment-id';
```

**Expected After Creation:**
- status: 'planned'
- planned_status: 'Planned'
- started_at: NULL
- completed_at: NULL

**Expected After Starting:**
- status: 'in_progress'
- planned_status: 'In Progress'
- started_at: (timestamp)
- completed_at: NULL

**Expected After Completion:**
- status: 'completed'
- planned_status: 'Completed'
- started_at: (timestamp)
- completed_at: (timestamp)

---

## Validation Queries

### Check Treatment Status After Creation:
```sql
SELECT 
  a.id as appointment_id,
  a.status as appointment_status,
  t.id as treatment_id,
  t.status as treatment_status,
  t.planned_status,
  t.started_at,
  t.completed_at
FROM api.appointments a
JOIN api.treatments t ON t.id = a.treatment_id
WHERE a.id = 'YOUR_APPOINTMENT_ID';
```

**Expected Output After Creation:**
```
appointment_status: scheduled
treatment_status: planned
planned_status: Planned
started_at: NULL
completed_at: NULL
```

---

## Fix Summary

✅ **Fixed:** Treatment appointments no longer auto-complete on creation  
✅ **Correct Flow:** Planned → In Progress → Completed  
✅ **User Control:** Dentist must explicitly start and complete appointments  
✅ **Data Integrity:** Status timestamps only set at appropriate times  

---

## Impact

### Before Fix:
- ❌ Treatments marked complete immediately
- ❌ Confusing workflow for dentists
- ❌ Inaccurate treatment tracking
- ❌ FDI chart showed incorrect tooth status

### After Fix:
- ✅ Treatments stay in "Planned" status until started
- ✅ Clear workflow: Schedule → Start → Complete
- ✅ Accurate treatment lifecycle tracking
- ✅ FDI chart reflects actual treatment progress
- ✅ Better analytics and reporting

---

## Conclusion

The fix ensures that treatment appointments follow the correct lifecycle:
1. **Scheduled/Planned** when appointment is created
2. **In Progress** when dentist starts the appointment
3. **Completed** when dentist marks treatment as done

This provides better control, accurate tracking, and aligns with real-world clinical workflows.
