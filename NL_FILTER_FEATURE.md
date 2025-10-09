# 🎤 Natural Language Filter Feature

## Overview

The Natural Language Filter feature allows dentists to create patient cohort filters in the Research Projects V2 dashboard using plain English via **voice transcription** or **typed text** instead of manual filter creation.

Just like how we extract keywords from PDFs for the medical knowledge system, we now extract structured filter criteria from natural language input using **Gemini AI**.

---

## ✨ Key Features

### 1. **Voice Input** 🎙️
- Click "Voice Input" button to start recording
- Speak your filter criteria naturally
- Real-time transcription displayed
- Stop recording when done
- AI automatically extracts filters

### 2. **Text Input** ⌨️
- Type filter criteria in plain English
- No need to know field names or operators
- Click "Extract Filters" to process
- AI converts to structured filters

### 3. **AI Processing** 🤖
- Uses Gemini AI to understand natural language
- Maps to available database fields
- Determines appropriate operators
- Handles logical operators (AND/OR)
- Provides confidence score

### 4. **Visual Validation** ✅
- Shows extracted filters in human-readable form
- Displays AI confidence score (0-100%)
- Provides explanation of what was understood
- Allows review before applying

---

## 🎯 Example Usage

### Voice/Text Examples:

```
Input: "Find patients over 30 with moderate caries"
↓
Filters:
- Age greater than 30
- Provisional Diagnosis contains "moderate caries"
```

```
Input: "Show me patients with pain intensity above 5 or severe pain"
↓
Filters:
- Pain Intensity greater than 5
OR Pain Intensity greater than 7
```

```
Input: "Patients between 25 and 45 years old who had root canal treatment"
↓
Filters:
- Age between 25 and 45
- Treatment Plan contains "root canal"
```

```
Input: "All female patients with irreversible pulpitis and pain duration more than 2 days"
↓
Filters:
- Gender equals "female"
- Final Diagnosis contains "irreversible pulpitis"
- Pain Duration greater than 2
```

---

## 📁 File Structure

### New Files Created:

1. **`lib/services/nl-filter-extractor.ts`**
   - Core AI service for extracting filters
   - Uses Gemini AI to parse natural language
   - Validates against available filter fields
   - Converts filters back to readable text

2. **`app/api/research/extract-filters/route.ts`**
   - API endpoint for processing NL input
   - Handles POST requests with text input
   - Returns structured filter criteria

3. **`components/dentist/nl-filter-input.tsx`**
   - React component for UI
   - Voice recording with Web Speech API
   - Text input with live processing
   - Results display with confidence scores

### Modified Files:

4. **`components/dentist/research-projects-v2.tsx`**
   - Integrated NL Filter component
   - Added above manual filter section
   - Replaces existing filters when applied

---

## 🔧 Technical Architecture

### Flow Diagram:

```
┌─────────────────────┐
│  User Input         │
│  • Voice 🎤         │
│  • Text ⌨️          │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Speech Recognition │  (Browser Web Speech API)
│  • Real-time        │
│  • Transcript       │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  API Route          │
│  /api/research/     │
│  extract-filters    │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Gemini AI Service  │
│  • Parse NL input   │
│  • Map to fields    │
│  • Extract values   │
│  • Validate         │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Structured Filters │
│  FilterCriteria[]   │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Research Dashboard │
│  • Display preview  │
│  • Apply filters    │
│  • Match patients   │
└─────────────────────┘
```

---

## 💡 AI Prompt Engineering

The AI uses a carefully crafted prompt that includes:

1. **Available Filter Fields** - Complete list with data types
2. **Operator Mapping Guide** - Natural language → operators
3. **Logical Operators** - AND/OR handling
4. **Examples** - Few-shot learning for accuracy
5. **Validation Rules** - Field compatibility checks

### Example AI Prompt Structure:

```
You are an expert medical data analyst...

AVAILABLE FILTER FIELDS:
- age (number): patient age
- pain_intensity (number): pain level 1-10
- provisional_diagnosis_jsonb (jsonb): diagnosis text
...

USER INPUT:
"patients over 30 with moderate caries"

INSTRUCTIONS:
1. Identify filter conditions
2. Map to available fields
3. Determine operators
4. Extract values
5. Handle AND/OR logic

OUTPUT: JSON structured filters
```

---

## 🎨 UI Components

### Natural Language Filter Card

**Location**: Research Projects V2 → Create/Edit Project → Define Patient Cohort

**Features**:
- Purple gradient border for AI distinction
- "AI-Powered" badge
- Collapsible interface
- Voice recording with animation
- Real-time confidence display
- Color-coded confidence badges:
  - 🟢 Green (80%+): High confidence
  - 🟡 Yellow (60-79%): Medium confidence
  - 🟠 Orange (<60%): Low confidence

**States**:
- **Idle**: Ready for input
- **Recording**: Red pulsing mic button
- **Processing**: Loading spinner
- **Results**: Shows extracted filters
- **Error**: Red alert with message

---

## 🚀 How to Use

### As a Dentist:

1. **Navigate to Research Projects V2**
   - Go to Dentist Dashboard
   - Click "Research V2 (Advanced)"

2. **Create/Edit a Project**
   - Click "Create New Project"
   - Fill in project details
   - Scroll to "Define Patient Cohort"

3. **Use Natural Language Filters**
   
   **Option A - Voice Input:**
   - Click "Voice Input" button
   - Speak your filter criteria
   - Watch real-time transcription
   - Click "Stop Recording"
   - Review the transcript
   - Click "Extract Filters"

   **Option B - Text Input:**
   - Type your filter description
   - Click "Extract Filters"

4. **Review AI Results**
   - Check confidence score
   - Read AI explanation
   - Review extracted filters
   - Click "Apply These Filters" if correct
   - Or click "Clear" to try again

5. **Continue with Manual Filters** (Optional)
   - Below the divider "OR CREATE FILTERS MANUALLY"
   - Add/modify filters manually if needed

6. **Save Project**
   - Click "Save Project"
   - Filters are saved with the project

---

## 🔍 Supported Filter Types

### Demographics:
- Age (exact, range, greater/less than)
- Gender
- Contact information

### Clinical Data:
- Pain intensity (scale 1-10)
- Pain location
- Pain duration
- Pain characteristics

### Diagnosis:
- Provisional diagnosis
- Final diagnosis
- Diagnosis keywords

### Treatment:
- Treatment plan
- Treatment procedures
- Treatment outcomes

### Tooth-Specific:
- FDI tooth numbers
- Tooth conditions
- Restoration types

---

## 📊 Confidence Scoring

The AI provides a confidence score (0.0 to 1.0) based on:

- **0.9 - 1.0** (90-100%): Exact field matches, clear operators
- **0.7 - 0.89** (70-89%): Good matches, some interpretation needed
- **0.5 - 0.69** (50-69%): Fuzzy matches, multiple interpretations
- **< 0.5** (<50%): Low confidence, manual review recommended

---

## ⚠️ Limitations & Tips

### Current Limitations:

1. **Field Availability**: Only works with predefined filter fields
2. **Language**: English only (can be extended)
3. **Complexity**: Very complex nested logic may not parse correctly
4. **Medical Terms**: Requires standard dental terminology

### Tips for Best Results:

✅ **Do's**:
- Use clear, specific terms
- Mention exact numbers for age/pain
- Use standard dental terminology
- Separate conditions with "and" or "or"
- Be explicit about ranges

❌ **Don'ts**:
- Avoid ambiguous terms ("young", "old")
- Don't use abbreviations without context
- Avoid nested complex logic
- Don't mix multiple unrelated concepts

### Good Examples:

```
✅ "Patients over 30 with moderate caries"
✅ "Female patients between 25 and 45"
✅ "Pain intensity greater than 7 or severe pain"
✅ "Patients with irreversible pulpitis who had root canal treatment"
```

### Poor Examples:

```
❌ "Young people with tooth problems"
❌ "Patients who need treatment soon"
❌ "Everyone except those without pain"
```

---

## 🔧 Configuration

### Environment Variables Required:

```env
GEMINI_API_KEY=your_gemini_api_key_here
```

### Model Configuration:

- **Model**: `gemini-1.5-flash`
- **Purpose**: Fast, cost-effective NLP
- **Alternative**: Can upgrade to `gemini-1.5-pro` for better accuracy

---

## 🧪 Testing

### Manual Testing:

1. Try each example from the "Example Usage" section
2. Test voice input in Chrome/Edge (best support)
3. Test text input in all browsers
4. Verify confidence scores are reasonable
5. Check that filters match patient data

### Test Cases:

```javascript
// Test 1: Simple age filter
Input: "patients over 30"
Expected: [{ field: 'age', operator: 'greater_than', value: 30 }]

// Test 2: Combined filters
Input: "patients with pain above 5 and moderate caries"
Expected: [
  { field: 'pain_intensity', operator: 'greater_than', value: 5 },
  { field: 'provisional_diagnosis_jsonb', operator: 'contains', value: 'moderate caries' }
]

// Test 3: OR logic
Input: "pain above 7 or severe pain"
Expected: [
  { field: 'pain_intensity', operator: 'greater_than', value: 7, logicalOperator: 'AND' },
  { field: 'pain_intensity', operator: 'greater_than', value: 7, logicalOperator: 'OR' }
]
```

---

## 🎯 Comparison: PDF Keywords vs NL Filters

### Similarities:

| Aspect | PDF Keywords | NL Filters |
|--------|-------------|------------|
| **Input** | PDF file | Voice/Text |
| **AI Service** | Gemini AI | Gemini AI |
| **Processing** | Extract text → keywords | Parse NL → filters |
| **Output** | Keyword arrays | Filter criteria |
| **Validation** | Field matching | Field + operator validation |

### Differences:

| Aspect | PDF Keywords | NL Filters |
|--------|-------------|------------|
| **Use Case** | Medical knowledge | Research cohorts |
| **Complexity** | Simple extraction | Complex parsing |
| **User Input** | File upload | Real-time voice/text |
| **Feedback** | Upload complete | Interactive preview |

---

## 📈 Future Enhancements

### Planned Features:

1. **Multi-language Support**
   - Spanish, French, German
   - Auto-detect language

2. **Saved Templates**
   - Common filter patterns
   - "Apply template" quick action

3. **Voice Commands**
   - "Clear filters"
   - "Add another filter"
   - "Apply filters"

4. **Smart Suggestions**
   - Autocomplete based on database
   - Common diagnoses
   - Typical age ranges

5. **Filter History**
   - Recent filter descriptions
   - Re-use previous filters

6. **Export/Import**
   - Share filter descriptions
   - Import from other projects

---

## 🐛 Troubleshooting

### Issue: Voice not working

**Solution**:
- Ensure using Chrome/Edge browser
- Check microphone permissions
- Allow microphone in browser settings

### Issue: Low confidence scores

**Solution**:
- Be more specific in description
- Use standard medical terms
- Break into simpler statements

### Issue: No filters extracted

**Solution**:
- Check input contains filter criteria
- Verify using supported field names
- Try rephrasing with "patients who..." format

### Issue: Wrong filters extracted

**Solution**:
- Review and clear
- Be more explicit about operators
- Specify exact values/ranges

---

## 📚 Related Documentation

- `WHAT_HAPPENS_TO_PDFS.md` - PDF keyword extraction workflow
- `RESEARCH_FILTERS_WORKING_GUIDE.md` - Manual filter creation guide
- `RESEARCH_PROJECTS_IMPLEMENTATION.md` - Research system overview

---

## ✅ Success Checklist

- [x] AI service created (`nl-filter-extractor.ts`)
- [x] API endpoint created (`/api/research/extract-filters`)
- [x] UI component created (`nl-filter-input.tsx`)
- [x] Integrated into Research V2 dashboard
- [x] Voice input with Web Speech API
- [x] Text input with processing
- [x] Confidence scoring
- [x] Visual feedback and validation
- [x] Error handling
- [x] Documentation

---

## 🎉 You're Ready!

The Natural Language Filter feature is now fully functional! 

**Try it out:**
1. Go to Research V2 → Create New Project
2. Look for the purple "Natural Language Filters" card
3. Click "Voice Input" or type a description
4. Watch AI extract your filters!

**Example to start with:**
> "Find patients over 30 years old with moderate caries and pain intensity greater than 5"

Happy researching! 🚀🦷
