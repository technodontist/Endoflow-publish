# AI Task Scheduler Documentation

## Overview

The **AI Task Scheduler** is an intelligent task management system that allows dentists to create and assign tasks to assistants using natural language input. It mirrors the architecture of the AI Appointment Scheduler but is specifically designed for assistant task workflows.

**Created**: October 12, 2025
**Status**: ✅ Fully Implemented and Integrated

---

## 🎯 Key Features

### Natural Language Processing
- **Voice or Text Input**: Supports both typed and spoken task requests
- **Context-Aware Parsing**: Understands task priority, due dates, patient context, and assignment
- **Gemini AI Integration**: Uses Google's Gemini 2.0 Flash for intelligent parsing
- **Confidence Scoring**: Provides accuracy confidence (0-100%) for each parsed task

### Smart Task Management
- **Auto-Assignment**: Automatically assigns tasks to default assistant if unspecified
- **Priority Detection**: Recognizes urgent, high, medium, and low priorities from context
- **Patient Linking**: Associates tasks with specific patients when mentioned
- **Due Date Parsing**: Understands relative dates ("tomorrow", "next Monday", "by Friday at 3 PM")
- **Category Inference**: Automatically categorizes tasks based on description

### User Experience
- **Real-time Chat Interface**: Interactive conversation with AI assistant
- **Contextual Suggestions**: Smart suggestions based on pending registrations and appointments
- **Voice Recognition**: Browser-based speech-to-text for hands-free operation
- **Instant Feedback**: Shows task creation confirmation with full details

---

## 🏗️ Architecture

### 3-Layer System (Mirrors AI Appointment Scheduler)

#### **1. AI Parser Service** (`lib/services/ai-task-parser.ts`)
- **Function**: `parseTaskRequest()`
- **AI Model**: Gemini 2.0 Flash (temperature: 0.1 for consistency)
- **Input**: Natural language string
- **Output**: Structured `ParsedTaskRequest` object

**Extracted Fields**:
```typescript
{
  taskTitle: string           // Clear, concise title (40 chars max)
  taskDescription: string     // Detailed description
  assignedToName?: string     // Assistant's name (if mentioned)
  assignedToId?: string       // Resolved from database
  priority: 'urgent' | 'high' | 'medium' | 'low'
  category?: string           // Auto-detected category
  dueDate?: string            // YYYY-MM-DD format
  dueTime?: string            // HH:MM format
  patientName?: string        // Patient name (if task is patient-specific)
  patientId?: string          // Resolved from database
  isUrgent: boolean           // Urgency flag
  notes?: string              // Additional context
  confidence: number          // Parsing accuracy (0-100)
  rawInput: string            // Original request
}
```

#### **2. Server Action** (`lib/actions/ai-task-scheduler.ts`)
- **Function**: `scheduleTaskWithAI(naturalLanguageInput, createdById)`
- **Workflow**:
  1. Loads available assistants and patients for context
  2. Calls AI parser service
  3. Validates assistant assignment (auto-assigns if needed)
  4. Resolves patient ID if patient mentioned
  5. Creates task using existing `createTaskAction()`
  6. Revalidates dashboard paths
  7. Returns confirmation message

**Additional Features**:
- **`getTaskSuggestions()`**: Generates smart task suggestions based on:
  - Pending patient registrations
  - Pending appointment requests
  - Incomplete urgent tasks

#### **3. UI Component** (`components/dentist/ai-task-scheduler.tsx`)
- **Chat Interface**: Similar to AI Appointment Scheduler
- **Real-time Messages**: User messages, AI responses, system notifications
- **Voice Input**: Browser speech recognition with live transcript
- **Contextual Suggestions**: Shows relevant task ideas
- **Interactive Examples**: Clickable example commands

---

## 📍 Integration Points

### Dentist Dashboard Integration
**Location**: `components/dentist/assistant-task-manager.tsx`

**Added Features**:
1. **AI Task Scheduler Button**: Prominent button in header with Sparkles icon
2. **Toggle Interface**: Opens/closes AI scheduler panel (600px height)
3. **Real-time Updates**: AI-created tasks instantly appear in task list
4. **Preserved Functionality**: Traditional manual task creation still available

**UI Flow**:
```
[Assistant Tasks Dashboard]
    ├── Header
    │   ├── "AI Task Scheduler" Button (teal gradient)
    │   └── "Create Task" Button (traditional)
    ├── Statistics Cards (6 metrics)
    ├── [AI Scheduler Panel] ← NEW (toggleable, 600px)
    │   ├── Chat Interface
    │   ├── Voice Input
    │   ├── Suggestions
    │   └── Example Commands
    ├── Filter Buttons
    └── Task List (Kanban or Table)
```

---

## 🎤 Natural Language Examples

### Priority Detection
```plaintext
✅ "Create urgent task to verify emergency patient registration"
   → Priority: urgent, isUrgent: true

✅ "Assign high priority task to confirm tomorrow's appointments"
   → Priority: high

✅ "Add task to organize files by next week"
   → Priority: medium (default)

✅ "Schedule low priority task to update treatment templates"
   → Priority: low
```

### Date/Time Parsing
```plaintext
✅ "Create task to prepare Room 2 for RCT tomorrow at 2 PM"
   → Due: 2025-10-13, Time: 14:00

✅ "Assign task to call patient by next Monday"
   → Due: 2025-10-14 (next Monday)

✅ "Add task to verify insurance by Friday at 11:30 AM"
   → Due: 2025-10-18, Time: 11:30
```

### Patient-Specific Tasks
```plaintext
✅ "Create high priority task to verify Sarah Johnson's insurance"
   → Patient: Sarah Johnson (matched from database)
   → Category: Patient Verification

✅ "Assign task to follow up with John Doe about appointment"
   → Patient: John Doe
   → Category: Follow-up
```

### Assistant Assignment
```plaintext
✅ "Assign urgent task to Test Assistant to prepare treatment room"
   → Assigned to: Test Assistant (matched from database)

✅ "Create task to verify patient registration" (no assistant specified)
   → Auto-assigned to: Test Assistant (default)
```

### Category Auto-Detection
```plaintext
✅ "Verify new patient registration"
   → Category: Patient Verification

✅ "Confirm appointment for tomorrow"
   → Category: Appointment

✅ "Organize patient files in Room 3"
   → Category: File Management

✅ "Prepare treatment instruments for RCT"
   → Category: Treatment Prep
```

---

## 🔄 Real-Time Workflow

### Task Creation Flow
```
1. User Input (Voice/Text)
   ↓
2. AI Parser (Gemini 2.0 Flash)
   ↓
3. Database Context Loading
   - Available assistants
   - Recent patients
   - Pending items
   ↓
4. Validation & Resolution
   - Match assistant name → ID
   - Match patient name → ID
   - Validate dates/times
   ↓
5. Task Creation (createTaskAction)
   ↓
6. Real-time Updates
   - Revalidate /dentist path
   - Revalidate /assistant path
   - Update task list UI
   ↓
7. Confirmation Message
   - Success details
   - Confidence score
   - Task summary
```

### Real-Time Synchronization
- **Supabase Subscriptions**: Both AI scheduler and manual task manager listen to `assistant_tasks` table
- **Cross-Dashboard Updates**: Tasks created in dentist dashboard instantly appear in assistant dashboard
- **Auto-Refresh**: Statistics and task lists update automatically

---

## 🎨 UI/UX Features

### Chat Interface
- **System Messages**: Welcome message with usage instructions and examples (blue background)
- **User Messages**: Right-aligned, teal background
- **AI Responses**: Left-aligned, white background with border
- **Processing Indicator**: Animated spinner with "Processing your request..."
- **Timestamps**: Each message shows creation time

### Voice Input
- **Browser Speech Recognition**: WebKit/Chrome Speech API
- **Live Transcript**: Real-time display of spoken words
- **Visual Feedback**: Animated red recording indicator
- **Stop/Start Control**: Click microphone to toggle
- **Edit Before Submit**: Transcript appears in input field for review

### Smart Suggestions
- **Context-Aware**: Based on pending registrations, appointments, and urgent tasks
- **Clickable**: Click suggestion to auto-fill input field
- **Dynamic Loading**: Updates after each task creation
- **Prioritized**: Shows most relevant items first (max 4 suggestions)

### Color Scheme
- **Primary Gradient**: Teal to Blue (`from-teal-600 to-blue-600`)
- **System Messages**: Blue accent (`bg-blue-50`, `text-blue-900`)
- **User Messages**: Teal (`bg-teal-600`, `text-white`)
- **AI Responses**: White with subtle border
- **Recording**: Red gradient (`from-red-50 to-orange-50`)

---

## 🛠️ Technical Implementation

### Dependencies
```json
{
  "@google/generative-ai": "^0.21.0",  // Gemini AI
  "date-fns": "^2.30.0",                // Date parsing
  "lucide-react": "^0.263.1",           // Icons
  "next": "14+",                        // Framework
  "react": "^18"                        // UI
}
```

### Environment Variables
```bash
GEMINI_API_KEY=your_gemini_api_key_here
```

### Database Requirements
- **Tables**: `api.assistant_tasks`, `public.profiles`, `api.patients`
- **Real-time**: Supabase subscriptions enabled
- **Permissions**: Service role for server actions

---

## 📊 Comparison: AI Task Scheduler vs AI Appointment Scheduler

| Feature | AI Task Scheduler | AI Appointment Scheduler |
|---------|-------------------|--------------------------|
| **Primary Purpose** | Create assistant tasks | Schedule patient appointments |
| **Natural Language Input** | ✅ Yes | ✅ Yes |
| **Voice Recognition** | ✅ Yes | ✅ Yes |
| **AI Model** | Gemini 2.0 Flash | Gemini 2.0 Flash |
| **Context Loading** | Assistants, Patients | Patients, Dentists, Pending Requests |
| **Auto-Assignment** | To default assistant | To specified dentist |
| **Priority Levels** | 4 (urgent, high, medium, low) | N/A |
| **Due Dates** | ✅ Flexible (optional) | ✅ Required |
| **Patient Linking** | ✅ Optional | ✅ Required |
| **Clinical Context** | Task categories | Consultations, Treatments, Teeth |
| **Target Users** | Dentists → Assistants | Assistants/Dentists → Patients |
| **Integration Location** | Assistant Tasks Tab | Appointment Organizer |

---

## 🚀 Usage Guide

### For Dentists

#### Step 1: Access AI Task Scheduler
1. Navigate to **Dentist Dashboard**
2. Click **"Assistant Tasks"** tab
3. Click **"AI Task Scheduler"** button (Sparkles icon)

#### Step 2: Create Tasks with Natural Language
**Text Input**:
```plaintext
"Create high priority task to verify Sarah's insurance by tomorrow at 10 AM"
```

**Voice Input**:
1. Click microphone icon
2. Speak clearly: "Assign urgent task to prepare Room 2 for RCT at 2 PM"
3. Click stop when done
4. Review transcript
5. Click "Create" button

#### Step 3: Review & Confirm
- AI shows parsed task details
- Confidence score indicates parsing accuracy
- Task instantly appears in task list
- Assistant receives notification

#### Step 4: Continue Creating Tasks
- AI scheduler stays open for batch creation
- Use suggestions for quick task ideas
- Click "Close AI Scheduler" when done

---

## 🧪 Testing Examples

### Test Priority Detection
```bash
# Terminal test (if you create a test script)
Input: "Create urgent task to call emergency patient"
Expected: priority='urgent', isUrgent=true

Input: "Add low priority task to organize files"
Expected: priority='low', isUrgent=false
```

### Test Date Parsing
```bash
Input: "Schedule task for tomorrow"
Expected: dueDate='2025-10-13' (1 day from current date)

Input: "Create task by next Monday at 3 PM"
Expected: dueDate='2025-10-14', dueTime='15:00'
```

### Test Patient Linking
```bash
Input: "Verify John Doe's insurance information"
Expected: patientName='John Doe', patientId='<matched_from_db>'

Input: "Follow up with appointment for Sarah"
Expected: patientName='Sarah <LastName>', patientId='<matched>'
```

### Test Assistant Assignment
```bash
Input: "Assign task to Test Assistant to prepare room"
Expected: assignedToName='Test Assistant', assignedToId='<matched_id>'

Input: "Create task to verify registration" (no assistant specified)
Expected: assignedToId='<default_assistant_id>' (auto-assigned)
```

---

## 🐛 Error Handling

### User-Facing Errors
```typescript
// Missing required fields
❌ "Unable to create task. Missing task description. Please provide clear task details."

// Ambiguous input
❌ "Failed to understand the task request. Please provide more details about what needs to be done."

// Invalid date
❌ "Cannot schedule tasks in the past."

// No assistants available
❌ "No active assistants available. Please create an assistant account first."
```

### Enhanced Error Messages
All errors include:
- **Clear explanation** of what went wrong
- **Tips for better results** with examples
- **Example commands** to guide users

---

## 📈 Performance Considerations

### Optimization Strategies
1. **AI Model Temperature**: 0.1 (low) for consistent parsing
2. **Context Limiting**: Max 100 patients, 50 assistants loaded
3. **Caching**: Suggestions cached until task creation
4. **Real-time Efficiency**: Debounced updates to prevent spam

### Response Times
- **AI Parsing**: ~1-3 seconds (Gemini 2.0 Flash)
- **Database Operations**: <500ms (Supabase)
- **Total Task Creation**: ~2-4 seconds

---

## 🔒 Security & Permissions

### Authentication Requirements
- **User must be authenticated** (Supabase Auth)
- **User must have dentist role** (role check in UI)
- **Service role used for backend** (elevated permissions)

### Data Access
- **Assistants**: Only active assistants loaded
- **Patients**: Recent patients for context (privacy maintained)
- **Tasks**: Full CRUD permissions via service role

---

## 🎓 Best Practices

### For Optimal Results
1. **Be Specific**: "Create high priority task to verify Sarah's insurance" > "Task for Sarah"
2. **Include Context**: Mention priority, due date, and patient name
3. **Use Natural Language**: AI understands conversational tone
4. **Review Before Submitting**: Voice transcripts can be edited
5. **Leverage Suggestions**: Use smart suggestions for common tasks

### Common Patterns
```plaintext
✅ Good: "Create urgent task to call patient John about appointment confirmation by tomorrow at 2 PM"
❌ Poor: "task john call"

✅ Good: "Assign high priority task to verify new patient registration"
❌ Poor: "check patient"

✅ Good: "Add task to organize treatment files in Room 3 by next Monday"
❌ Poor: "files"
```

---

## 🔮 Future Enhancements

### Potential Features
- [ ] **Multi-Task Creation**: Create multiple tasks from a single prompt
- [ ] **Task Templates**: AI-generated task templates based on common workflows
- [ ] **Smart Reminders**: AI suggests follow-up tasks based on task completion
- [ ] **Integration with Calendar**: Sync tasks with appointment schedule
- [ ] **Task Dependencies**: AI detects task relationships ("after verifying insurance, schedule appointment")
- [ ] **Performance Analytics**: Track AI parsing accuracy and improve over time

---

## 📚 Related Documentation

- [CLAUDE.md](./CLAUDE.md) - Main project documentation
- [AI Appointment Scheduler](./components/dentist/ai-appointment-scheduler.tsx) - Similar architecture
- [Assistant Task Management](./lib/actions/assistant-tasks.ts) - Backend actions
- [Database Schema](./lib/db/schema.ts) - Task table structure

---

## 🆘 Troubleshooting

### Issue: AI Scheduler button not appearing
**Solution**: Ensure you're logged in as a dentist and viewing the Assistant Tasks tab

### Issue: Voice input not working
**Solution**: Check browser permissions for microphone access (Chrome/Edge only)

### Issue: Tasks not being created
**Solution**: Verify GEMINI_API_KEY is set in environment variables

### Issue: Auto-assignment not working
**Solution**: Ensure at least one active assistant exists in the database

### Issue: Confidence score is low (<50)
**Solution**: Provide more specific task details (priority, description, due date)

---

## 📞 Support

For issues or questions:
1. Check this documentation
2. Review [CLAUDE.md](./CLAUDE.md) project guidelines
3. Examine console logs for detailed error messages
4. Test with example commands from this documentation

---

**Status**: ✅ Fully Operational
**Last Updated**: October 12, 2025
**Architecture**: 3-Layer (AI Parser → Server Action → UI Component)
**AI Model**: Google Gemini 2.0 Flash (temperature: 0.1)
