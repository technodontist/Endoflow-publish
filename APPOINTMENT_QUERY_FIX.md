# Appointment Query Fix

## Problem
When asking "How many patients do I have today in my appointment", the AI was:
- ❌ Misclassifying as appointment creation/scheduling
- ❌ Trying to create a new appointment
- ❌ Returning error: "Unable to schedule appointment. Missing patient name."

## Root Cause
The appointment scheduler agent had logic to detect schedule QUERIES vs BOOKING requests, but was missing common query patterns like:
- "how many patients do I have today"
- "today in my appointment"
- "count appointments"

## Solution

### 1. Enhanced Schedule Query Detection
**File**: `lib/services/endoflow-master-ai.ts` (lines 293-305)

Added more query patterns to `isScheduleQuery`:
```typescript
const isScheduleQuery =
  userQuery.toLowerCase().includes('my schedule') ||
  userQuery.toLowerCase().includes('how many patients') ||  // NEW
  userQuery.toLowerCase().includes('how many appointments') ||  // NEW - specifically for "how many appointments"
  userQuery.toLowerCase().includes('today\'s appointments') ||  // NEW
  userQuery.toLowerCase().includes('today appointment') ||  // NEW
  userQuery.toLowerCase().includes('today in my appointment') ||  // NEW
  userQuery.toLowerCase().includes('appointments today') ||  // NEW
  (userQuery.toLowerCase().includes('count') && userQuery.toLowerCase().includes('appointment')) ||  // NEW - fixed AND logic
  (userQuery.toLowerCase().includes('list') && userQuery.toLowerCase().includes('appointment')) ||  // NEW
  (userQuery.toLowerCase().includes('how many') && userQuery.toLowerCase().includes('today'))  // NEW - catch-all
```

### 2. Improved Intent Classification Examples
**File**: `lib/services/endoflow-master-ai.ts` (lines 81-139)

Updated the AI intent classification to better understand the distinction:
```typescript
2. appointment_scheduling - BOTH viewing schedules AND creating/booking appointments
   - Viewing: "How many patients today?", "What's my schedule?", "Show appointments"
   - Creating: "Schedule appointment for John", "Book RCT tomorrow"
```

Added specific examples:
- ✅ "How many patients do I have today in my appointment" → `appointment_scheduling`
- ✅ "Show me today's appointments" → `appointment_scheduling`

## How It Works

### Query Flow
1. User asks: "How many patients do I have today?"
2. **Intent Classification**: Gemini AI classifies as `appointment_scheduling`
3. **Scheduler Agent**: Detects it's a QUERY (not booking) via pattern matching
4. **Database Query**: Fetches today's appointments for the dentist
5. **Response Synthesis**: Returns formatted list with count

### Response Format
```
You have 4 upcoming appointments:

• John Smith - 2025-10-10 at 09:00 (consultation)
• Jane Doe - 2025-10-10 at 10:30 (treatment)  
• Bob Johnson - 2025-10-10 at 14:00 (follow-up)
• Alice Brown - 2025-10-10 at 16:00 (consultation)
```

## Files Modified
1. `lib/services/endoflow-master-ai.ts` - Enhanced query detection

## Testing
Try these queries:
- ✅ "How many patients do I have today?"
- ✅ "How many appointments do I have today?"  ← Fixed!
- ✅ "What's my schedule for today?"
- ✅ "Show me today's appointments"
- ✅ "List appointments for today"
- ✅ "Count appointments today"
- ✅ "Today in my appointment"

All should now return your actual appointment list instead of trying to create a new appointment!

## Notes
- The system now handles both viewing (queries) and creating (booking) appointment requests
- Queries fetch actual appointments from the database
- Booking requests still require patient name, date, and time
