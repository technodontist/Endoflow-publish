# 🎯 Research Filters Quick Reference

## ✅ WORKING FILTERS (Copy & Paste Ready)

### Pain Assessment
```
✅ Pain Intensity > 2                          → 19 patients
✅ Pain Intensity > 7                          → 1 patient
✅ Pain Intensity between 5 and 10            → Multiple patients
✅ Pain Location contains "upper"              → Multiple patients
✅ Pain Location contains "molar"              → Multiple patients
✅ Pain Duration equals "2"                    → 4 patients
✅ Pain Character contains [text]              → Limited data (3 consultations)
```

### Diagnosis Filters
```
✅ Final Diagnosis contains "tooth"            → 6 patients
✅ Final Diagnosis contains "missing"          → Multiple patients
✅ Final Diagnosis contains "Irreversible"     → Multiple patients
✅ Provisional Diagnosis contains "caries"     → 11 patients
✅ Provisional Diagnosis contains "moderate"   → Multiple patients
✅ Primary Diagnosis contains "moderate caries" → Multiple patients (via fallback)
```

### Combined Filters (AND logic)
```
✅ Pain Intensity > 2
   AND Provisional Diagnosis contains "caries" → Multiple patients

✅ Pain Intensity > 2
   AND Primary Diagnosis contains "moderate caries" → 3 patients

✅ Pain Duration equals "2"
   AND Provisional Diagnosis contains "caries" → Multiple patients
```

---

## ❌ NOT WORKING (No Data Yet)

```
❌ Treatment Type (JSONB)                      → No data
❌ Proposed Procedure                          → No data
```

**Reason**: Enhanced consultation form not saving treatment plan data yet

---

## 🚨 TROUBLESHOOTING

### Filter Returns 0 But Should Work?
1. **Hard Refresh Browser**: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
2. **Check Spelling**: "moderate caries" not "moderate carys"
3. **Use "contains" for text**: Not "equals" for partial matching
4. **Case doesn't matter**: "CARIES" = "caries" = "Caries"

### Why Some Filters Don't Work?
- **No data saved**: Treatment plan filters need form updates
- **Field empty**: Some fields optional, not all consultations have all data
- **Wrong table**: Make sure using JSONB version (e.g., "Provisional Diagnosis (JSONB)" not legacy "Diagnosis")

---

## 📊 DATA AVAILABILITY

| Filter | Consultations | % Coverage |
|--------|--------------|------------|
| Pain Intensity | 45/45 | 100% ✅ |
| Diagnosis Final | 16/45 | 36% ⚠️ |
| Diagnosis Provisional | 15/45 | 33% ⚠️ |
| Pain Location | 13/45 | 29% ⚠️ |
| Pain Duration | 16/45 | 36% ⚠️ |
| Pain Character | 3/45 | 7% ⚠️ |
| Treatment Type | 0/45 | 0% ❌ |
| Proposed Procedure | 0/45 | 0% ❌ |

---

## 💡 RECOMMENDED STARTER FILTERS

**Simple Single Filter** (Best for testing):
```
Pain Intensity > 2
```

**Best Diagnosis Search**:
```
Provisional Diagnosis contains "caries"
```

**High Pain Patients**:
```
Pain Intensity between 5 and 10
```

**Complex Multi-Filter** (Best for real research):
```
Pain Intensity > 2
AND Provisional Diagnosis contains "moderate"
```

---

## 🎓 FILTER FIELD NAMES (For UI Dropdown)

### Working Fields:
- `pain_intensity` → Pain Intensity (1-10)
- `pain_location` → Pain Location
- `pain_duration` → Pain Duration
- `pain_character` → Pain Character
- `diagnosis_final` → Final Diagnosis (JSONB)
- `diagnosis_provisional` → Provisional Diagnosis (JSONB)
- `diagnosis_primary` → Primary Diagnosis (JSONB) ⚠️ Uses fallback

### Not Working Fields:
- `treatment_type_jsonb` → Treatment Type (JSONB) ❌
- `proposed_procedure` → Proposed Procedure ❌

---

## 🎯 USER'S EXACT FILTER - VERIFIED ✅

```
Filter 1: Pain Intensity > 2
Filter 2: Primary Diagnosis contains "moderate caries"
Logic: Match ALL (AND)

RESULT: 3 patients found ✅
```

**If UI shows 0**: Browser refresh needed (Ctrl+Shift+R)

---

## 📞 QUICK HELP

**Filter not in dropdown?** → Check category sections (🩹 Pain Assessment, 🔬 Diagnosis, etc.)

**0 patients found?** → Try simpler filter first: "Pain Intensity > 2"

**Want to test filters work?** → Run: `node test-all-filters-comprehensive.js`

**Need full documentation?** → See: `WORKING_FILTERS_COMPLETE_GUIDE.md`
