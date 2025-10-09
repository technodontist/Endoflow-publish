# Voice Recognition Integration for Investigations Tab

## Overview
This document explains the implementation of voice recognition integration for the Investigations tab in the consultation component. The integration allows voice-recorded investigation data (radiographic findings, vitality tests, percussion tests, and palpation findings) to be automatically extracted and populated into the Investigations tab.

## Implementation Summary

### 1. Voice Processing API
**File**: `app/api/voice/process-global-transcript/route.ts`

The API already extracts investigation data through the `extractInvestigations()` function:

```typescript
function extractInvestigations(transcript: string) {
  const radiographicKeywords = ['x-ray', 'radiograph', 'cbct', 'panoramic', 'opg']
  const testKeywords = ['vitality test', 'percussion', 'palpation', 'mobility']

  let content = {
    radiographic: { type: [], findings: '' },
    clinical_tests: {}
  }
  
  // Extracts radiographic types and findings
  // Extracts clinical test results (vitality, percussion, palpation)
  
  return content
}
```

The extracted data is returned in the API response under `processedContent.investigations`.

### 2. Voice Content Distribution
**File**: `components/dentist/enhanced-new-consultation-v3.tsx`

#### Updated `distributeContentToTabs` Function (lines 1074-1240)

The function now maps extracted investigation data to checkbox-compatible formats:

**Radiographic Types Mapping:**
- Maps extracted types like 'x-ray', 'iopa', 'panoramic', 'cbct' to standardized checkbox options
- Example: 'x-ray' → 'IOPA (Intraoral Periapical)', 'opg' → 'Panoramic (OPG)'

**Vitality Tests Mapping:**
- Maps extracted test results to checkbox options
- Example: 'cold positive' → 'Cold test positive', 'ept negative' → 'Electric pulp test negative'

**Percussion Tests Mapping:**
- Maps extracted results to checkbox options
- Example: 'vertical positive' → 'Vertical percussion positive', 'tender to percussion' → 'Tender to percussion'

**Palpation Findings Mapping:**
- Maps extracted findings to checkbox options
- Example: 'palpation tender' → 'Tender to palpation', 'lymph node' → 'Lymph node enlargement'

**Data Storage:**
```typescript
updated.investigationsData = {
  radiographic_findings: investigations.radiographic?.findings || '',
  radiographic_types: mappedRadiographicTypes,
  vitality_tests: mappedVitalityTests,
  percussion_tests: mappedPercussionTests,
  palpation_findings: mappedPalpationFindings,
  laboratory_tests: '',
  recommendations: '',
  auto_extracted: true,
  extraction_timestamp: new Date().toISOString()
}
```

### 3. Investigations Tab Data Structure
**File**: `components/consultation/tabs/InvestigationsTab.tsx`

The InvestigationsTab component expects data in the following format:

```typescript
{
  radiographic_findings: string,          // Textarea content
  radiographic_types: string[],           // Checkbox array
  vitality_tests: string[],               // Checkbox array
  percussion_tests: string[],             // Checkbox array
  palpation_findings: string[],           // Checkbox array
  laboratory_tests: string,               // Textarea content
  recommendations: string                 // Textarea content
}
```

### 4. Section Builder Integration (lines 395-420)

The Investigations section in the section builder now properly uses `investigationsData`:

```typescript
{
  id: 'investigations',
  title: 'Investigations',
  icon: <FileText className="w-5 h-5" />,
  status: getSectionStatus('investigations'),
  description: 'Radiographic findings, tests',
  data: consultationData.investigationsData || {
    radiographic_findings: consultationData.radiographicFindings || '',
    radiographic_types: consultationData.radiographicTypes || [],
    vitality_tests: /* converted from string to array */,
    percussion_tests: /* converted from string to array */,
    palpation_findings: /* converted from string to array */,
    laboratory_tests: consultationData.laboratoryTests || '',
    recommendations: consultationData.investigationRecommendations || '',
    auto_extracted: consultationData.investigationsData?.auto_extracted,
    extraction_timestamp: consultationData.investigationsData?.extraction_timestamp,
    confidence: consultationData.confidence
  },
  voiceEnabled: true,
  component: InvestigationsTab
}
```

### 5. Tab Data Update Handler (lines 1352-1362)

The `updateConsultationFromTabData` function already handles updates from the Investigations tab:

```typescript
case 'investigations':
  const toStr = (v: any) => Array.isArray(v) ? v.join(', ') : (v || '')
  updated.radiographicFindings = tabData.radiographic_findings || ''
  updated.radiographicTypes = tabData.radiographic_types || []
  updated.vitalityTests = toStr(tabData.vitality_tests)
  updated.percussionTests = toStr(tabData.percussion_tests)
  updated.palpationFindings = toStr(tabData.palpation_findings)
  updated.laboratoryTests = tabData.laboratory_tests || ''
  updated.investigationRecommendations = tabData.recommendations || ''
  break
```

## Data Flow

```
Voice Recording
    ↓
Process Global Transcript API
    ↓
extractInvestigations() function
    ↓
AI/Keyword extraction of:
  - Radiographic types (x-ray, CBCT, OPG, etc.)
  - Radiographic findings (text)
  - Vitality test results
  - Percussion test results
  - Palpation findings
    ↓
Return processedContent.investigations
    ↓
distributeContentToTabs() function
    ↓
Map extracted data to checkbox options
    ↓
Store in consultationData.investigationsData
    ↓
Pass to InvestigationsTab component
    ↓
Display in UI with proper checkboxes and textareas
    ↓
User can review and modify
    ↓
Save with consultation
```

## Mapping Examples

### Radiographic Types
| Extracted | Mapped To |
|-----------|-----------|
| x-ray | IOPA (Intraoral Periapical) |
| panoramic | Panoramic (OPG) |
| cbct | CBCT |

### Vitality Tests
| Extracted | Mapped To |
|-----------|-----------|
| cold test positive | Cold test positive |
| ept negative | Electric pulp test negative |
| hyperresponsive | Hyperresponsive |

### Percussion Tests
| Extracted | Mapped To |
|-----------|-----------|
| vertical positive | Vertical percussion positive |
| tender to percussion | Tender to percussion |
| no tenderness | No tenderness |

### Palpation Findings
| Extracted | Mapped To |
|-----------|-----------|
| tender to palpation | Tender to palpation |
| swelling present | Swelling present |
| lymph node | Lymph node enlargement |

## Key Features

1. **Automatic Extraction**: Investigation data is automatically extracted from voice recordings
2. **Smart Mapping**: Extracted terms are intelligently mapped to standardized checkbox options
3. **Backward Compatibility**: Individual fields maintained for backward compatibility
4. **Auto-extracted Flag**: All voice-extracted data is marked with `auto_extracted: true`
5. **Timestamp**: Extraction timestamp is recorded for audit purposes
6. **Confidence Score**: AI confidence score is tracked (must be ≥60% to auto-fill)

## Usage Example

When a dentist says during recording:
> "I took a panoramic x-ray which showed periapical radiolucency around tooth 46. Cold test was positive with delayed response. Vertical percussion test is positive, tender to palpation."

The system will extract and populate:
- **Radiographic Types**: [Panoramic (OPG)] ✓
- **Radiographic Findings**: "periapical radiolucency around tooth 46"
- **Vitality Tests**: [Cold test positive ✓, Delayed response ✓]
- **Percussion Tests**: [Vertical percussion positive ✓]
- **Palpation Findings**: [Tender to palpation ✓]

## Testing Checklist

- [ ] Voice recording captures investigation mentions
- [ ] API extracts radiographic types correctly
- [ ] API extracts clinical test results correctly
- [ ] Checkboxes are pre-selected based on voice data
- [ ] Radiographic findings textarea is populated
- [ ] Manual modifications are preserved
- [ ] Data persists on consultation save
- [ ] Auto-extracted flag displays correctly
- [ ] Low confidence scores prevent auto-fill

## Future Enhancements

1. **Laboratory Tests Extraction**: Add AI extraction for laboratory test mentions
2. **Recommendations Extraction**: Extract investigation recommendations from voice
3. **Better NLP**: Improve natural language processing for complex medical terminology
4. **Multi-tooth Investigation Tracking**: Link investigations to specific tooth numbers
5. **Investigation History**: Show previous investigation results in the tab

## Related Files

- `app/api/voice/process-global-transcript/route.ts` - Voice processing API
- `components/dentist/enhanced-new-consultation-v3.tsx` - Main consultation component
- `components/consultation/tabs/InvestigationsTab.tsx` - Investigations tab UI
- `lib/actions/consultation.ts` - Consultation save actions

## Notes

- The voice-extracted data is **not saved immediately** to the database
- Data is saved only when the user explicitly saves the consultation
- Users can review and modify all voice-extracted data before saving
- All checkbox mappings are case-insensitive for robust matching
