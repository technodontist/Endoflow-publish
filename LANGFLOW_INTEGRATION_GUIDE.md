# LangFlow Integration Guide - Research AI Assistant

## 📋 Overview

The Research AI Assistant in ENDOFLOW now supports LangFlow integration for AI-powered clinical research analysis. The system includes conversation persistence, fallback mechanisms, and comprehensive error handling.

## 🎯 Features Implemented

### ✅ **1. Database Persistence**
- **Table**: `api.research_ai_conversations`
- **Purpose**: Store all AI conversations with metadata
- **Features**:
  - Project-based conversation history
  - Processing time tracking
  - AI source tracking (LangFlow, N8N, or fallback)
  - Metadata storage for analysis parameters
  - Row Level Security (RLS) for dentist-only access

### ✅ **2. LangFlow Integration**
- **API Route**: `/api/research/ai-query`
- **Supports**: LangFlow, N8N (legacy), and fallback responses
- **Features**:
  - Automatic endpoint detection
  - Graceful fallback when LangFlow unavailable
  - Processing time measurement
  - Response source tracking

### ✅ **3. UI Components**
- **Component**: `components/dentist/research-ai-assistant.tsx`
- **Features**:
  - Real-time chat interface
  - Automatic conversation history loading
  - Message persistence after each AI response
  - Enhanced UI with gradients and better visibility
  - Support for multiple analysis types

### ✅ **4. Server Actions**
- **File**: `lib/actions/research-ai.ts`
- **Actions**:
  - `saveResearchConversationAction()` - Save AI conversations
  - `getProjectConversationsAction()` - Load project history
  - `getAllConversationsAction()` - Get all dentist conversations
  - `deleteConversationAction()` - Delete specific conversation
  - `getConversationStatsAction()` - Conversation analytics

## 🚀 Setup Instructions

### Step 1: Run Database Migration

Execute the SQL migration in Supabase SQL Editor:

```bash
# Migration file location
lib/db/migrations/add_research_ai_conversations.sql
```

**What it does:**
- Creates `api.research_ai_conversations` table
- Sets up indexes for performance
- Configures Row Level Security policies
- Grants necessary permissions

### Step 2: Configure Environment Variables

Add to your `.env.local`:

```env
# LangFlow Configuration (Primary)
LANGFLOW_API_URL=https://your-langflow-instance.com/api/v1/run
LANGFLOW_API_KEY=your_langflow_api_key
LANGFLOW_FLOW_ID=your_research_ai_flow_id

# Legacy N8N (Optional - for backward compatibility)
N8N_RESEARCH_WEBHOOK_URL=http://localhost:5678/webhook/research-ai
N8N_API_KEY=your_n8n_api_key

# Supabase (Already configured)
NEXT_PUBLIC_SUPABASE_URL=https://pxpfbeqlqqrjpkiqlxmi.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### Step 3: Test Integration

Run the test script to verify everything works:

```bash
# Set environment variables first
export NEXT_PUBLIC_SUPABASE_URL="your-supabase-url"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

# Optional: LangFlow credentials
export LANGFLOW_API_URL="your-langflow-url"
export LANGFLOW_API_KEY="your-api-key"
export LANGFLOW_FLOW_ID="your-flow-id"

# Run test suite
node test-langflow-integration.js
```

**Test Coverage:**
1. ✅ Database table exists and is accessible
2. ⚠️  LangFlow connection (optional - uses fallback if not configured)
3. ✅ Conversation persistence works
4. ✅ API endpoint responds correctly

## 🔧 Technical Architecture

### Data Flow

```
User Input
    ↓
Research AI Assistant Component
    ↓
API Route (/api/research/ai-query)
    ↓
┌─────────────────────────────┐
│  LangFlow Available?        │
│  ├─ Yes → Use LangFlow      │
│  └─ No  → Use Fallback      │
└─────────────────────────────┘
    ↓
Format Response
    ↓
Save to Database (if project selected)
    ↓
Display in UI
```

### LangFlow Payload Structure

```typescript
{
  "input_value": "User's research query",
  "tweaks": {
    "cohort_data": "[{patient data}]",  // JSON string
    "analysis_type": "analyze_cohort",
    "cohort_size": 150,
    "context": {
      "clinicType": "dental",
      "specialty": "endodontics",
      "anonymized": true,
      "projectId": "project-uuid"
    }
  }
}
```

### Expected LangFlow Response

```typescript
{
  "response": "AI analysis results...",
  // OR
  "output": "AI analysis results...",
  // Additional fields are optional
}
```

## 📊 Database Schema

### Table: `api.research_ai_conversations`

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `project_id` | UUID | Research project (nullable for temp analysis) |
| `dentist_id` | UUID | Dentist who created conversation |
| `user_query` | TEXT | Original user question |
| `ai_response` | TEXT | AI-generated response |
| `analysis_type` | TEXT | Type of analysis performed |
| `cohort_size` | INTEGER | Number of patients in analysis |
| `metadata` | TEXT | JSON metadata (filters, params) |
| `source` | TEXT | AI source: `langflow`, `n8n`, `fallback` |
| `confidence` | TEXT | Response confidence level |
| `processing_time` | INTEGER | Response time in milliseconds |
| `created_at` | TIMESTAMP | Creation timestamp |

### Indexes

- `idx_research_ai_conversations_project_id` - Fast project lookups
- `idx_research_ai_conversations_dentist_id` - Fast dentist lookups
- `idx_research_ai_conversations_created_at` - Chronological queries
- `idx_research_ai_conversations_analysis_type` - Analysis type filtering

## 🔐 Security

### Row Level Security Policies

1. **SELECT Policy**: Dentists can only view their own conversations
2. **INSERT Policy**: Dentists can only create conversations for themselves
3. **DELETE Policy**: Dentists can only delete their own conversations

### Authentication Flow

```
User Request
    ↓
Verify Supabase Auth Token
    ↓
Check User Profile
    ↓
Verify role = 'dentist' AND status = 'active'
    ↓
Apply RLS Policies
    ↓
Grant/Deny Access
```

## 🎨 UI Features

### Enhanced Chat Interface

- **Message Bubbles**: Rounded with gradients (teal for users, white for AI)
- **Avatar Icons**: Bot icon for AI, User icon for humans
- **Timestamps**: Relative time display (e.g., "2 mins ago")
- **Source Indicators**: Badge showing response source (LangFlow/Fallback)
- **Processing Time**: Display AI response time

### Analysis Types Supported

1. **Analyze Cohort** - Comprehensive patient cohort analysis
2. **Compare Treatments** - Treatment modality comparison
3. **Predict Outcomes** - Treatment success prediction
4. **Find Patterns** - Clinical pattern recognition
5. **Generate Insights** - AI-generated clinical insights

### Message Persistence Behavior

- **With Project Selected**: All conversations saved to database
- **Without Project**: Messages displayed but NOT saved (temp analysis)
- **History Loading**: Automatic when project is selected
- **Real-time Updates**: Messages appear immediately

## 🔄 Fallback Mechanism

The system gracefully handles LangFlow unavailability:

### Fallback Triggers

1. LangFlow endpoint not configured
2. LangFlow server unreachable
3. LangFlow returns error response
4. Network timeout

### Fallback Response Generator

Located in: `app/api/research/ai-query/route.ts`

```typescript
function generateFallbackResponse(analysisType, query, cohortData) {
  // Returns realistic mock data based on analysis type
  // Used for development and when LangFlow is unavailable
}
```

## 📝 Usage Examples

### Frontend Usage

```typescript
// Send a research query
const response = await fetch('/api/research/ai-query', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    projectId: 'project-uuid-or-temp-analysis',
    query: 'What is the average success rate?',
    cohortData: matchingPatients,
    analysisType: 'analyze_cohort'
  })
})

const result = await response.json()
// result.source: 'langflow' | 'n8n' | 'fallback'
// result.response: AI response text
// result.processingTime: milliseconds
```

### Server Actions Usage

```typescript
import { saveResearchConversationAction } from '@/lib/actions/research-ai'

// Save a conversation
await saveResearchConversationAction({
  projectId: 'project-uuid',
  userQuery: 'What are the success rates?',
  aiResponse: 'The success rate is 85%...',
  analysisType: 'general_query',
  cohortSize: 150,
  metadata: { filters: [...] },
  source: 'langflow',
  processingTime: 250
})
```

## 🐛 Troubleshooting

### Issue: Messages Not Saving

**Symptoms**: Chat works but no database records
**Solution**:
1. Check migration ran successfully
2. Verify RLS policies are active
3. Ensure user has dentist role
4. Check browser console for errors

### Issue: LangFlow Connection Failed

**Symptoms**: All responses show `source: 'fallback'`
**Solution**:
1. Verify `LANGFLOW_API_URL` is correct
2. Check `LANGFLOW_API_KEY` is valid
3. Test LangFlow endpoint directly
4. Review API route logs in terminal

### Issue: Conversation History Not Loading

**Symptoms**: No previous messages when selecting project
**Solution**:
1. Check `project_id` matches exactly
2. Verify conversations exist in database
3. Check RLS policies allow access
4. Review browser network tab

## 📈 Monitoring & Analytics

### Conversation Statistics

Use `getConversationStatsAction()` to get:

- Total conversations count
- Breakdown by analysis type
- Breakdown by source (LangFlow vs fallback)
- Average processing time
- Recent activity

### Performance Metrics

Track in conversation metadata:
- `processing_time` - AI response latency
- `source` - Which AI service responded
- `confidence` - Response quality indicator
- `cohort_size` - Dataset size processed

## 🚧 Future Enhancements

### Planned Features

1. **Streaming Responses**: Real-time AI response streaming
2. **Conversation Export**: Download chat history as PDF
3. **Multi-turn Context**: Maintain conversation context
4. **Conversation Ratings**: User feedback on AI responses
5. **Advanced Analytics**: Deeper insights into AI usage patterns

### LangFlow Flow Recommendations

Your LangFlow flow should:
- Accept `input_value` as the main query
- Process `tweaks.cohort_data` as JSON patient data
- Consider `tweaks.context` for domain-specific behavior
- Return structured responses with clear formatting
- Handle errors gracefully with helpful messages

## 📚 Related Documentation

- [Research Projects V2 Architecture](./RESEARCH_PROJECTS_V2.md)
- [Database Schema](./lib/db/schema.ts)
- [Server Actions](./lib/actions/research-ai.ts)
- [API Routes](./app/api/research/)

## 🤝 Support

For issues or questions:
1. Check the test script: `node test-langflow-integration.js`
2. Review browser console and terminal logs
3. Verify database migration completed
4. Test with fallback responses first
5. Add LangFlow configuration gradually

---

**Status**: ✅ Fully Implemented & Ready for Production

**Last Updated**: January 2025
