# Testing Guide: JSONB Filter Fix

## Quick Test Steps

### 1. Start the Development Server
```bash
npm run dev
```

### 2. Navigate to Research Projects
1. Login as dentist (dr.nisarg@endoflow.com)
2. Go to **Research V2 (Advanced)** tab
3. Click **"Create New Project"**

### 3. Test Each Fixed Filter

#### Test A: Pain Intensity Filter
```
Field: Pain Intensity (1-10)
Operator: greater_than_or_equal
Value: 5
```
**Expected**: Should find patients with pain intensity >= 5
**Console**: Should NOT show "⚠️ [DB] Unsupported filter field: pain_intensity"

#### Test B: Primary Diagnosis Filter
```
Field: Primary Diagnosis
Operator: contains
Value: moderate caries
```
**Expected**: Should find patients with "moderate caries" in diagnosis
**Console**: Should NOT show "⚠️ [DB] Unsupported filter field: diagnosis_primary"

#### Test C: Combined Filters (The One From Your Logs)
```
Filter 1:
  Field: Pain Intensity (1-10)
  Operator: greater_than_or_equal
  Value: 5

Logical Operator: AND

Filter 2:
  Field: Primary Diagnosis
  Operator: contains
  Value: moderate caries
```
**Expected**: Should find patients matching BOTH criteria
**Console**: No unsupported field warnings

### 4. Check Console Logs
Open browser DevTools (F12) and look for:

**Before Fix** ❌:
```
⚠️ [DB] Unsupported filter field: pain_intensity
⚠️ [DB] Unsupported filter field: diagnosis_primary
✅ [DB] Filtered to 19 matching patients  (WRONG - includes all patients)
```

**After Fix** ✅:
```
🔍 [DB] Finding matching patients with criteria: [...]
🔍 [DB] Retrieved 19 patients for filtering
✅ [DB] Filtered to 3 matching patients  (CORRECT - only matching patients)
```

### 5. Test All Fixed JSONB Filters

| Filter Field | Test Value | Expected |
|--------------|------------|----------|
| Pain Intensity | `> 5` | Patients with high pain |
| Pain Location | `contains "upper"` | Patients with upper pain |
| Pain Duration | `contains "chronic"` | Chronic pain patients |
| Pain Character | `equals "throbbing"` | Throbbing pain patients |
| Primary Diagnosis | `contains "caries"` | Caries patients |
| Final Diagnosis | `contains "restored"` | Restored teeth patients |
| Provisional Diagnosis | `contains "moderate"` | Moderate condition patients |
| Treatment Procedures | `contains "root canal"` | Root canal patients |

## Visual Verification

### 1. Analytics Page
- Go to a research project
- Click on **Analytics** tab
- **Before Fix**: Analytics showed wrong data (all 19 patients)
- **After Fix**: Analytics show correct filtered data (e.g., 3 patients)

### 2. Cohort Patients
- Click on **Cohort** tab
- **Before Fix**: Cohort included patients that don't match criteria
- **After Fix**: Cohort only includes matching patients

### 3. Live Patient Matching Panel
- When creating/editing a project
- **Before Fix**: Live matching showed incorrect counts
- **After Fix**: Live matching shows correct patient counts

## Smoke Test Script

Run this quick verification:

```bash
# In browser console (F12), run:
console.log('Testing JSONB filters...');

# Create a test filter in the UI and check:
# 1. No console warnings about unsupported fields ✅
# 2. Patient count is reasonable (not 19 every time) ✅
# 3. Analytics load without errors ✅
```

## Common Issues & Solutions

### Issue: Still seeing "Unsupported filter field"
**Solution**: Hard refresh the browser (Ctrl+Shift+R) to clear cached JS

### Issue: Filter returns 0 patients but should work
**Solution**: 
1. Check if you have consultation data with that JSONB field
2. Run: `node test-jsonb-research-filtering.js` to verify data exists
3. Check browser console for JSON parsing errors

### Issue: TypeScript compilation errors
**Solution**: 
```bash
npm run build
```
If errors appear, check:
- All parentheses are balanced
- All `case` statements end with `break` or `return`
- No syntax errors in the new code

## Success Criteria

✅ No "Unsupported filter field" warnings in console
✅ Correct patient counts based on filter criteria
✅ Analytics calculate accurately
✅ Cohort patients match filter criteria
✅ Multiple filter combinations work (AND/OR logic)
✅ All 8 JSONB fields work independently
✅ No JavaScript errors in browser console
✅ Research project save/load works correctly

## Rollback Plan

If the fix causes issues:

```bash
git status
git diff lib/db/queries.ts
git checkout lib/db/queries.ts  # Revert changes
npm run dev  # Restart server
```

## Additional Testing

For comprehensive testing, run the full test suite:

```bash
node test-jsonb-research-filtering.js
node check-research-data.js
node test-all-filters-comprehensive.js  # If available
```

## Performance Check

Monitor query performance in console:
- Filter queries should complete in < 500ms
- Analytics should calculate in < 1000ms
- No memory leaks during repeated filtering

If performance is slow:
1. Check database indexes: `sql/CREATE_JSONB_RESEARCH_INDEXES.sql`
2. Limit patient query to 500 (already done)
3. Consider adding pagination for large datasets
