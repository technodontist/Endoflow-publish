# Clinic Analysis Chat Fix

## Problem
Unable to send messages in the Clinical Analysis AI chatbot. Error in console:
```
Could not find the table 'api.clinic_analysis_chat_sessions' in the schema cache
💬 [CLINIC CHAT] Error creating session
```

## Root Cause
The required database tables for the clinic analysis chatbot were never created:
- `api.clinic_analysis_chat_sessions` - Stores chat sessions/threads
- `api.clinic_analysis_messages` - Stores individual messages

## Solution

### Run the Migration SQL in Supabase

**File**: `lib/db/migrations/add_clinic_analysis_chat_sessions.sql`

This migration creates:

1. **Chat Sessions Table** - Stores conversation threads
   - Session ID, dentist ID
   - Title, timestamps
   - Message count, preview

2. **Messages Table** - Stores individual messages
   - Message content, role (user/assistant)
   - Timestamp, sequence number
   - Metadata (analysis info)

3. **Security**
   - Row Level Security (RLS) enabled
   - Policies for dentists to access only their own chats
   - Proper permissions for authenticated users

4. **Features**
   - Auto-updating session metadata
   - Indexed for performance
   - Cascading deletes

### Steps to Fix

1. **Open Supabase Dashboard**
   - Go to your project

2. **Navigate to SQL Editor**
   - Click on "SQL Editor" in the sidebar

3. **Copy the SQL**
   - Copy all contents from `lib/db/migrations/add_clinic_analysis_chat_sessions.sql`
   - OR run: `node fix-clinic-chat.js` to see the SQL

4. **Paste and Run**
   - Paste into SQL Editor
   - Click "RUN"

5. **Restart Dev Server**
   ```bash
   npm run dev
   ```

## What This Enables

### Clinic Analysis Chatbot Features
- ✅ Create new chat sessions
- ✅ Send messages with clinical data context
- ✅ Receive AI-powered analysis responses
- ✅ View chat history
- ✅ Multiple conversation threads
- ✅ Automatic session metadata updates

### Database Structure
```
api.clinic_analysis_chat_sessions
├── id (UUID)
├── dentist_id (UUID) → auth.users.id
├── title (TEXT)
├── message_count (INTEGER)
├── last_message_preview (TEXT)
├── created_at, updated_at, last_activity_at (TIMESTAMP)

api.clinic_analysis_messages
├── id (UUID)
├── session_id (UUID) → clinic_analysis_chat_sessions.id
├── role (TEXT: 'user' | 'assistant')
├── content (TEXT)
├── timestamp (TIMESTAMP)
├── metadata (JSONB)
├── sequence_number (INTEGER)
```

## Files
- Migration SQL: `lib/db/migrations/add_clinic_analysis_chat_sessions.sql`
- Helper script: `fix-clinic-chat.js`
- This guide: `CLINIC_CHAT_FIX.md`

## Verification

After running the SQL, you should see:
```
✅ Successfully created 2 tables
✅ Indexes created
✅ RLS policies applied
✅ Permissions granted
```

Test by:
1. Opening Clinic Analysis page
2. Creating a new chat
3. Sending a message
4. Should receive AI response without errors

## Notes
- This is a one-time setup
- Safe to run multiple times (uses `IF NOT EXISTS`)
- Each dentist can only access their own chat sessions
- Messages are automatically ordered by sequence number
- Session metadata updates automatically on new messages
