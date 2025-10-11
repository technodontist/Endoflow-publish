# Self-Learning Chat Sessions Migration

## Overview
This migration adds persistent chat session storage for the Self-Learning AI Assistant feature. It creates two new tables:
- `api.self_learning_chat_sessions` - Stores chat session/thread information
- `api.self_learning_messages` - Stores individual messages within sessions

## Features Added
- ✅ Persistent chat session history
- ✅ Session sidebar with list of all chat threads
- ✅ Create new chat sessions
- ✅ Switch between different chat sessions
- ✅ Delete chat sessions
- ✅ Auto-title sessions from first user message
- ✅ Link patient context to learning sessions
- ✅ Message count and last activity tracking
- ✅ Row Level Security (RLS) policies - dentists only see their own sessions

## How to Apply Migration

### Option 1: Supabase Dashboard (Recommended)
1. Open your Supabase project dashboard
2. Go to **SQL Editor**
3. Click **New Query**
4. Copy the contents of `add_self_learning_chat_sessions.sql`
5. Paste into the SQL editor
6. Click **Run** to execute the migration

### Option 2: Supabase CLI
```bash
cd D:\endoflow\Endoflow-publish
supabase db push
```

### Option 3: psql Direct Connection
```bash
psql "postgresql://[YOUR_CONNECTION_STRING]" -f lib/db/migrations/add_self_learning_chat_sessions.sql
```

## Verification
After running the migration, verify it was successful by running this query in SQL Editor:
```sql
-- Check if tables were created
SELECT 
    'Self-Learning Chat tables created successfully!' AS status,
    (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'api' AND table_name = 'self_learning_chat_sessions') AS sessions_table_exists,
    (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'api' AND table_name = 'self_learning_messages') AS messages_table_exists;
```

Expected output:
- `sessions_table_exists`: 1
- `messages_table_exists`: 1

## What Changed in the Code

### New Files Created
1. **`lib/db/migrations/add_self_learning_chat_sessions.sql`**
   - Database schema for sessions and messages tables
   - Indexes for performance
   - RLS policies for security
   - Trigger for auto-updating session metadata

2. **`lib/actions/self-learning-chat.ts`**
   - `createLearningSessionAction()` - Create new session
   - `getLearningSessionsAction()` - Fetch all sessions
   - `getLearningMessagesAction()` - Load messages for a session
   - `saveLearningMessageAction()` - Save message to database
   - `deleteLearningSessionAction()` - Delete session
   - `renameLearningSessionAction()` - Rename session title
   - `autoTitleLearningSessionAction()` - Auto-generate title from first message

### Updated Files
1. **`components/dentist/self-learning-assistant.tsx`**
   - Added session management state variables
   - Integrated session sidebar UI in chat mode
   - Modified `handleChatSubmit()` to save messages to database
   - Added session switching, creation, and deletion handlers
   - Added auto-load of sessions on component mount

## Usage

### For Users
1. Navigate to **Self Learning Assistant** page
2. Click on **AI Chat Assistant** tab
3. Click **New Chat** to start a new learning session
4. All conversations are automatically saved
5. Switch between sessions by clicking on them in the sidebar
6. Delete sessions using the trash icon that appears on hover
7. Sessions are automatically titled based on your first question

### Session Context
When you link a patient in the **Patient Context** section, new chat sessions will:
- Automatically include patient information in session metadata
- Show patient name badge in session list
- Provide personalized, patient-specific AI responses

## Database Schema

### self_learning_chat_sessions
```sql
CREATE TABLE api.self_learning_chat_sessions (
    id UUID PRIMARY KEY,
    dentist_id UUID NOT NULL,
    title TEXT NOT NULL DEFAULT 'New Learning Session',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    message_count INTEGER DEFAULT 0,
    last_message_preview TEXT,
    last_activity_at TIMESTAMP DEFAULT NOW(),
    diagnosis TEXT,
    treatment TEXT,
    patient_id UUID,
    patient_name TEXT
);
```

### self_learning_messages
```sql
CREATE TABLE api.self_learning_messages (
    id UUID PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES api.self_learning_chat_sessions(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    timestamp TIMESTAMP DEFAULT NOW(),
    metadata JSONB,
    sequence_number INTEGER DEFAULT 0
);
```

## Security
- All tables have Row Level Security (RLS) enabled
- Dentists can only access their own sessions and messages
- Only active dentists with valid profiles can create/access sessions
- Cascade deletion: When a session is deleted, all its messages are automatically removed

## Performance
- Indexes on `dentist_id`, `patient_id`, `session_id`, and timestamp fields
- Efficient query patterns for loading sessions and messages
- Automatic session metadata updates via database triggers

## Troubleshooting

### Error: "Table does not exist"
- Make sure you've run the migration SQL
- Check that tables were created in the `api` schema, not `public`

### Error: "Permission denied"
- Verify RLS policies are correctly set up
- Ensure user is authenticated and has `dentist` role with `active` status

### Sessions not loading
- Check browser console for errors
- Verify service role key in `.env.local` has proper permissions
- Test the actions in isolation using the browser dev tools

## Migration Status
- ✅ Database schema created
- ✅ Server actions implemented
- ✅ UI integration completed
- ⏳ **Pending**: Run migration on database
- ⏳ **Pending**: Test in production environment

## Next Steps
1. Apply the migration to your Supabase database
2. Test creating a new chat session
3. Verify messages are persisting correctly
4. Test switching between sessions
5. Test deleting sessions
6. Verify patient context is correctly linked

---

**Created**: 2025-01-10
**Author**: AI Assistant
**Status**: Ready for deployment
