# Fix Summary: Unsupported Filter Field Error

## Problem
The research database query was showing "Unsupported filter field" warnings for JSONB fields like:
- `diagnosis_primary`
- `pain_intensity`
- `pain_location`
- `pain_duration`
- `pain_character`
- `diagnosis_final`
- `diagnosis_provisional`
- `treatment_procedures`

These warnings appeared in the console logs like:
```
⚠️ [DB] Unsupported filter field: diagnosis_primary
⚠️ [DB] Unsupported filter field: pain_intensity
```

## Root Cause
The `findMatchingPatients()` function in `lib/db/queries.ts` had a switch statement that only handled basic filter fields (age, medical_conditions, diagnosis, treatment_type, prognosis, etc.) but **did not have case handlers for JSONB fields** that query nested JSON data in the consultations table.

## Solution Applied
Added comprehensive case handlers for all JSONB filter fields in the switch statement at line ~1486 of `lib/db/queries.ts`:

### 1. Pain Assessment Fields (4 handlers added)
- `pain_intensity` - Parses `pain_assessment` JSON and extracts `intensity` value
- `pain_location` - Parses `pain_assessment` JSON and extracts `location` value
- `pain_duration` - Parses `pain_assessment` JSON and extracts `duration` value
- `pain_character` - Parses `pain_assessment` JSON and extracts `character` value

### 2. Diagnosis Fields (3 handlers added)
- `diagnosis_primary` - Parses `diagnosis` JSON and extracts `primary` field
- `diagnosis_final` - Parses `diagnosis` JSON and extracts `final` array
- `diagnosis_provisional` - Parses `diagnosis` JSON and extracts `provisional` array

### 3. Treatment Fields (1 handler added)
- `treatment_procedures` - Parses `treatment_plan` JSON and extracts `plan` array

## Technical Details

Each handler follows this pattern:
1. **Safe JSON parsing**: Handles both string and object formats
2. **Null safety**: Returns false if data is missing
3. **Try-catch**: Gracefully handles JSON parsing errors
4. **Operator support**: Implements multiple operators (equals, contains, greater_than, etc.)
5. **Case-insensitive matching**: Uses `.toLowerCase()` for string comparisons

Example handler structure:
```typescript
case 'pain_intensity':
  const hasMatchingPainIntensity = patient.consultations?.some(consultation => {
    try {
      const painData = consultation.pain_assessment
        ? (typeof consultation.pain_assessment === 'string' 
            ? JSON.parse(consultation.pain_assessment) 
            : consultation.pain_assessment)
        : null;
      const intensity = painData?.intensity || 0;
      const filterValue = parseFloat(filter.value) || 0;

      switch (filter.operator) {
        case 'equals':
          return intensity === filterValue;
        case 'greater_than':
          return intensity > filterValue;
        // ... more operators
      }
    } catch (e) {
      return false;
    }
  });
  return hasMatchingPainIntensity || false;
```

## Files Modified
- `lib/db/queries.ts` - Added 8 new case handlers in the `findMatchingPatients()` function

## Testing
To verify the fix works:
1. Run `npm run dev`
2. Go to Research Projects V2
3. Create a project with filters like:
   - "Pain Intensity > 5"
   - "Primary Diagnosis contains 'caries'"
4. Check console logs - should no longer show "Unsupported filter field" warnings
5. Verify patients are correctly matched based on JSONB criteria

## Expected Behavior After Fix
✅ No more "Unsupported filter field" warnings in console
✅ JSONB filters work correctly (pain_intensity, diagnosis_primary, etc.)
✅ Research analytics calculate correctly based on filter criteria
✅ Patient matching works for all documented filter fields

## Related Documentation
- `docs/JSONB_RESEARCH_FILTERING.md` - Complete JSONB filtering documentation
- `lib/utils/filter-engine.ts` - Filter field definitions
- `RESEARCH_FILTERS_WORKING_GUIDE.md` - User guide for working filters
