# FDI Chart Color Update Diagnostic Guide

Based on my analysis of your system, here's what's happening and how to debug the missing color updates:

## How The System Is Supposed to Work

1. **Initial Diagnosis**: When a consultation is saved, tooth diagnoses are created with initial colors
2. **Appointment Creation**: When appointments are linked to treatments, this creates relationships between appointments, treatments, and tooth diagnoses
3. **Status Updates**: When appointment status changes (scheduled → in_progress → completed), the `updateTreatmentsForAppointmentStatusAction` is called
4. **Tooth Color Updates**: This triggers `updateToothStatusForAppointmentStatus` which updates the tooth diagnosis colors
5. **Real-time Updates**: The InteractiveDentalChart subscribes to changes and updates colors in real-time

## Diagnostic Steps

### Step 1: Check if Real-time Subscriptions Are Working

Open your browser console when viewing the FDI chart and look for these logs:
- `🦷 [DENTAL-CHART] Tooth diagnoses subscription status: SUBSCRIBED`  
- `📅 Real-time appointment status update affecting tooth colors:`
- `🔧 Real-time treatment status update affecting tooth colors:`

If you don't see these, the subscriptions aren't working.

### Step 2: Check if InteractiveDentalChart Has Correct Props

Make sure the InteractiveDentalChart component is being used with:
- `patientId` prop set to the correct patient UUID
- `subscribeRealtime={true}` (this is the default)

### Step 3: Verify Appointment Status Updates Trigger Treatment Updates

When you change an appointment status, check the server logs for:
- `[TREATMENTS] Updating tooth status: [status] -> [new_status] for treatment [type]`
- `[TREATMENTS] Successfully updated tooth status to [status] for appointment [id]`

### Step 4: Check Database Data Integrity

Verify these relationships exist in your database:

#### Check if tooth diagnoses exist:
```sql
SELECT id, patient_id, tooth_number, status, color_code 
FROM api.tooth_diagnoses 
WHERE patient_id = 'your-patient-id' 
ORDER BY updated_at DESC;
```

#### Check if treatments are linked to appointments:
```sql
SELECT t.id, t.appointment_id, t.tooth_number, t.treatment_type, t.status,
       a.status as appointment_status
FROM api.treatments t
JOIN api.appointments a ON t.appointment_id = a.id
WHERE t.patient_id = 'your-patient-id';
```

#### Check appointment-teeth linkages:
```sql
SELECT * FROM api.appointment_teeth 
WHERE appointment_id IN (
  SELECT id FROM api.appointments WHERE patient_id = 'your-patient-id'
);
```

### Step 5: Test Appointment Status Update Flow

1. Create a test appointment with a treatment linked to a tooth diagnosis
2. Try changing the appointment status from "scheduled" to "in_progress"
3. Check if `updateTreatmentsForAppointmentStatusAction` is called
4. Check if tooth diagnosis status gets updated in the database
5. Check if the FDI chart colors update in real-time

## Common Issues and Fixes

### Issue 1: Missing Treatment-Tooth Linkages

If treatments aren't properly linked to tooth diagnoses, the color updates won't work.

**Fix**: Ensure when creating treatments (via `linkAppointmentToTreatmentAction`), the `toothNumber` and `toothDiagnosisId` are properly set.

### Issue 2: Real-time Subscriptions Not Working

If the chart isn't subscribing to real-time updates.

**Fix**: Check network connectivity to Supabase and ensure the `patientId` prop is set correctly.

### Issue 3: Status Mapping Issues

If the appointment-to-tooth status mapping isn't working correctly.

**Fix**: Check the `mapAppointmentStatusToToothStatus` function in `lib/utils/toothStatus.ts`. The mapping should be:
- `scheduled/confirmed` → Keep original status or `attention`
- `in_progress` → `attention` (orange)
- `completed` → Final status based on treatment type (e.g., `filled`, `crown`, etc.)
- `cancelled` → Return to original diagnosis status

### Issue 4: Database Permissions

If the server actions don't have permission to update tooth diagnoses.

**Fix**: Check that the service role has UPDATE permissions on the `tooth_diagnoses` table.

## Manual Test Commands

You can test the color update flow manually by running these in your browser console while viewing a patient's chart:

```javascript
// Test real-time subscription manually
const supabase = createClient()
supabase
  .channel('test-tooth-diagnoses')
  .on('postgres_changes', {
    event: '*',
    schema: 'api', 
    table: 'tooth_diagnoses',
    filter: `patient_id=eq.YOUR_PATIENT_ID`
  }, (payload) => {
    console.log('Manual test - tooth diagnosis update:', payload)
  })
  .subscribe()

// Test appointment status change (replace with actual IDs)
updateAppointmentStatusAction('appointment-id', 'in_progress', 'user-id')
  .then(result => console.log('Status update result:', result))
```

## Expected Log Flow

When everything is working correctly, you should see this sequence in your logs:

1. User changes appointment status
2. `[TREATMENTS] Updating tooth status: scheduled -> in_progress for treatment Filling`
3. `🦷 Real-time appointment status update affecting tooth colors:`
4. `🔄 Appointment status changed from scheduled to in_progress, reloading tooth data`
5. `🦷 [DENTAL-CHART] Debounced reload triggered`
6. Chart colors update visually

If you're missing any of these steps, that's where the issue lies.