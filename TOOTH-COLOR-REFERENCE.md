# Tooth Color & Status Reference

## 🎨 Color Mappings

### Primary Tooth Colors (Background/Fill)

| Status | Color Name | Hex Code | Visual | Meaning |
|--------|-----------|----------|--------|---------|
| `healthy` | Green | `#22c55e` | 🟢 | Healthy tooth, no issues |
| `caries` | Red | `#ef4444` | 🔴 | Cavity/decay detected, needs treatment |
| `filled` | Blue | `#3b82f6` | 🔵 | Filling/restoration completed |
| `crown` | Purple | `#a855f7` | 🟣 | Crown/cap placed |
| `root_canal` | Orange | `#f97316` | 🟠 | Root canal treatment completed |
| `missing` | Gray | `#6b7280` | ⚪ | Tooth extracted or missing |
| `attention` | Orange | `#f97316` | 🟠 | Needs attention/monitoring |
| `extraction_needed` | Dark Red | `#dc2626` | 🔴 | Extraction recommended |
| `implant` | Cyan | `#06b6d4` | 🔷 | Dental implant |

### Status Dots (Small Indicator)

The small colored dot on the tooth indicates:
- **Present**: Tooth has a non-healthy, non-missing status
- **Color**: Matches the tooth's current status
- **Purpose**: Quick visual indicator for teeth needing attention

## 📊 Dental Chart Sections

### 1. **FDI Chart (Main Visual)**
Shows all 32 permanent teeth with:
- Background color = Current status
- Border highlight = Selected tooth
- Small dot = Status indicator

### 2. **Statistics Cards**
Show count of teeth in each status category:
- **Healthy** (Green): Normal teeth
- **Caries** (Red): Teeth with cavities
- **Filled** (Blue): Restored teeth
- **Crown** (Purple): Crowned teeth
- **RCT** (Orange): Root canal treated
- **Attention** (Orange): Monitoring needed
- **Missing** (Gray): Extracted/missing
- **Extraction** (Dark Red): Extraction planned

### 3. **Recent Dental Procedures**
Shows last 3 treatments with:
- Tooth number badge
- Treatment description
- Date performed

## 🔄 Color Transition Flow

### Example: Caries → Root Canal

```
1. Initial Diagnosis:
   Status: caries
   Color: Red 🔴
   Display: "Tooth needs root canal"

2. Appointment Created:
   Status: caries
   Color: Red 🔴
   Display: "RCT scheduled"

3. Treatment In Progress:
   Status: attention
   Color: Orange 🟠
   Display: "Treatment underway"

4. Treatment Completed:
   Status: root_canal
   Color: Orange 🟠
   Display: "RCT completed"
```

### Example: Caries → Filling

```
1. Initial Diagnosis:
   Status: caries
   Color: Red 🔴

2. Treatment Completed:
   Status: filled
   Color: Blue 🔵
```

## ❓ FAQ

### Q: Why is my tooth orange after completing RCT?
**A:** Orange is the correct color for a completed root canal treatment. It indicates the tooth has had RCT and is being monitored.

### Q: Should the tooth change color when treatment is completed?
**A:** Yes! The color should change from:
- Red (caries) → Orange (root_canal) for RCT
- Red (caries) → Blue (filled) for fillings
- Red (caries) → Purple (crown) for crowns
- Any → Gray (missing) for extractions

### Q: What's the difference between Orange "attention" and Orange "root_canal"?
**A:** They use the same color (#f97316) but represent different states:
- **attention**: In-progress treatment or needs monitoring
- **root_canal**: Completed RCT, long-term status

### Q: Why don't I see treatments in "Recent Dental Procedures"?
**A:** The procedure must have both:
1. A treatment/recommended treatment recorded
2. A date recorded (examination date or update date)

If either is missing, it won't appear in the list.

## 🔍 Debugging Colors

### Browser Console Checks

Check the actual tooth data:
```javascript
// In browser console
document.querySelector('[data-tooth-number="11"]')
// Look at className - should contain "tooth-root_canal" or similar
```

Check the tooth data state:
```javascript
// This should show tooth 11 with status and color
console.log(toothData['11'])
```

### Expected Log Output

When completing RCT appointment:
```
📝 Extracted from notes: "Root Canal Treatment"
🦷 Extracted tooth number from notes: 11
🦷 [TREATMENTS] Starting tooth status update:
  📅 Appointment Status: completed
  🔧 Treatment Type: Root Canal Treatment
  🦷 Current Diagnosis Status: caries
  🎯 New Tooth Status: root_canal         ← Should say root_canal
  🎨 Color Code: #f97316                  ← Should be orange
  🦷 Target Tooth: 11
  ✅ Updated via patient_id + tooth_number
```

## 🎯 Summary

- **Orange is correct** for completed root canal treatments
- **The small dot** indicates non-healthy status
- **Background color** shows the primary treatment status
- **Recent Procedures** requires both treatment text and date
- **Real-time updates** happen automatically via subscriptions