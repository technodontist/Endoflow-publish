# Self-Learning AI Chat Persistence Setup

## Overview

This guide explains how to add **chat history and persistence** to the Self-Learning AI Assistant, matching the functionality of the Clinical Analysis AI chatbot.

## Problem

Currently, the Self-Learning AI:
- ❌ Does NOT save conversation history
- ❌ Cannot recall previous learning sessions
- ❌ Loses all context when page refreshes
- ❌ No way to switch between different learning topics

## Solution

Add the same chat persistence system used by Clinical Analysis AI:
- ✅ Save all conversations to database
- ✅ Multiple conversation threads (sessions)
- ✅ Full conversation history
- ✅ Auto-save messages
- ✅ Auto-title based on first message
- ✅ Link patient context to learning sessions
- ✅ Switch between learning topics easily

## Architecture

### Database Structure

Based on the proven `clinic_analysis_chat_sessions` design:

```
api.self_learning_chat_sessions
├── id (UUID)
├── dentist_id (UUID) → auth.users.id
├── title (TEXT)
├── diagnosis (TEXT) - optional learning context
├── treatment (TEXT) - optional learning context
├── patient_id (UUID) - optional patient link
├── patient_name (TEXT) - optional patient name
├── message_count (INTEGER)
├── last_message_preview (TEXT)
├── created_at, updated_at, last_activity_at

api.self_learning_messages
├── id (UUID)
├── session_id (UUID) → self_learning_chat_sessions.id
├── role (TEXT: 'user' | 'assistant')
├── content (TEXT)
├── metadata (JSONB) - treatment_options, sources, etc.
├── timestamp (TIMESTAMP)
├── sequence_number (INTEGER)
```

### Server Actions

**File**: `lib/actions/self-learning-chat.ts`

Provides CRUD operations:
- `createLearningSessionAction()` - Create new chat session
- `getLearningSessionsAction()` - Get all sessions for user
- `getLearningMessagesAction()` - Get messages for a session
- `saveLearningMessageAction()` - Save user/assistant message
- `deleteLearningSessionAction()` - Delete session
- `renameLearningSessionAction()` - Rename session
- `autoTitleLearningSessionAction()` - Auto-title from first message

### Component Integration

The `self-learning-assistant.tsx` component needs to:
1. Load existing sessions on mount
2. Create new session when starting chat
3. Save each message (user and assistant)
4. Display session list/history
5. Allow switching between sessions
6. Auto-title sessions

## Setup Instructions

### Step 1: Run Database Migration

**Run the SQL in Supabase:**

```bash
# Display the SQL to run
node fix-self-learning-chat.js
```

Or manually copy from: `lib/db/migrations/add_self_learning_chat_sessions.sql`

**Steps:**
1. Open Supabase Dashboard
2. Navigate to SQL Editor
3. Paste the entire SQL content
4. Click RUN
5. Verify: Should show "Self-Learning Chat tables created successfully!"

### Step 2: Update Component (Future)

The `self-learning-assistant.tsx` component will be updated to use the new chat actions. Key changes:

```typescript
import {
  createLearningSessionAction,
  getLearningSessionsAction,
  getLearningMessagesAction,
  saveLearningMessageAction,
  deleteLearningSessionAction,
  renameLearningSessionAction,
  autoTitleLearningSessionAction
} from '@/lib/actions/self-learning-chat'

// Load sessions on mount
useEffect(() => {
  loadSessions()
}, [])

// Create session when starting new chat
const startNewSession = async () => {
  const result = await createLearningSessionAction({
    diagnosis: selectedDiagnosis,
    treatment: selectedTreatment,
    patientId: patientContext?.patientId,
    patientName: patientContext?.patientName
  })
  setCurrentSessionId(result.data.id)
}

// Save messages as they're sent
const sendMessage = async (content: string) => {
  await saveLearningMessageAction({
    sessionId: currentSessionId,
    role: 'user',
    content
  })
  // ... get AI response ...
  await saveLearningMessageAction({
    sessionId: currentSessionId,
    role: 'assistant',
    content: aiResponse
  })
}
```

## Features Enabled

### 1. **Multi-Session Management**
- Create unlimited learning sessions
- Each session focused on a diagnosis/treatment
- Switch between topics easily
- Organized by last activity

### 2. **Full Conversation History**
- All messages saved automatically
- Messages ordered chronologically
- Metadata includes sources, treatment options
- Never lose learning progress

### 3. **Patient Context Integration**
- Link learning sessions to specific patients
- Case-specific learning preserved
- Patient name displayed in session
- Filter sessions by patient

### 4. **Auto-Title Feature**
- Sessions auto-titled from first message
- "Learning: How to perform RCT" 
- "Treatment: Managing periapical abscess"
- Manual rename supported

### 5. **Learning Context**
- Diagnosis field for filtering
- Treatment field for categorization
- Metadata stores treatment options, sources
- Search/filter sessions by topic

### 6. **Security & Privacy**
- Row Level Security (RLS) enabled
- Dentists can only see their own sessions
- Messages cascade delete with session
- Proper authentication checks

## Comparison: Clinical vs Learning Chat

| Feature | Clinical Analysis | Self-Learning | Status |
|---------|-------------------|---------------|--------|
| Chat Sessions | ✅ | ✅ | Same |
| Message History | ✅ | ✅ | Same |
| Auto-Save | ✅ | ✅ | Same |
| Auto-Title | ✅ | ✅ | Same |
| Patient Link | ❌ | ✅ | **Enhanced** |
| Diagnosis Context | ❌ | ✅ | **Enhanced** |
| Treatment Context | ❌ | ✅ | **Enhanced** |
| Metadata Storage | Basic | **Rich** | **Enhanced** |

## Files Created/Modified

### New Files
1. `lib/db/migrations/add_self_learning_chat_sessions.sql` - Database migration
2. `lib/actions/self-learning-chat.ts` - Server actions
3. `fix-self-learning-chat.js` - Helper script
4. `SELF_LEARNING_CHAT_SETUP.md` - This documentation

### To Be Modified
1. `components/dentist/self-learning-assistant.tsx` - Add chat persistence
2. `lib/actions/self-learning.ts` - Integrate with chat actions

## Testing

After running the migration:

```sql
-- Verify tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'api' 
AND table_name LIKE 'self_learning%';

-- Should return:
-- self_learning_chat_sessions
-- self_learning_messages
```

## Benefits

### For Dentists
- ✅ Never lose learning progress
- ✅ Review past learning conversations
- ✅ Build knowledge repository
- ✅ Case-specific learning preserved
- ✅ Easy topic switching

### For System
- ✅ Proven architecture (same as clinic chat)
- ✅ Scalable design
- ✅ Indexed for performance
- ✅ Secure with RLS
- ✅ Auto-updating metadata

## Migration Details

### What the SQL Does

1. **Creates Tables**
   - `self_learning_chat_sessions` - Conversation threads
   - `self_learning_messages` - Individual messages

2. **Adds Indexes**
   - On dentist_id for fast user queries
   - On timestamps for sorting
   - On diagnosis/patient for filtering

3. **Enables Security**
   - Row Level Security (RLS)
   - Policies for CRUD operations
   - Dentist-only access

4. **Grants Permissions**
   - authenticated role: SELECT, INSERT, UPDATE, DELETE
   - service_role: ALL privileges

5. **Creates Triggers**
   - Auto-update session metadata on new message
   - Update message count, preview, timestamps

## Next Steps

1. **Run Migration** (This Document)
   - Execute SQL in Supabase
   - Verify tables created

2. **Update Component** (Future)
   - Integrate chat actions
   - Add session management UI
   - Implement message persistence

3. **Test Features**
   - Create sessions
   - Save messages
   - Switch between sessions
   - Link patient context

## Support

If you encounter issues:

1. **Table Not Found**
   - Run the migration SQL
   - Check Supabase logs
   - Verify schema is 'api'

2. **Permission Denied**
   - Check RLS policies
   - Verify user is authenticated dentist
   - Review service role permissions

3. **Messages Not Saving**
   - Check session exists
   - Verify user owns session
   - Review trigger function

## Conclusion

This setup provides the Self-Learning AI with the same robust chat persistence as the Clinical Analysis AI, plus enhanced features for learning context and patient linkage.

The architecture is proven, scalable, and secure.
