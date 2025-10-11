# Appointment Organizer V2 - Color Legend

## Quick Reference Guide

### 🎨 Appointment Type Colors

| Type | Color | Background | Border | When to Use |
|------|-------|------------|--------|-------------|
| **First Visit** | 🟣 Purple | Light Purple | Purple Bar | New patient's first appointment |
| **Consultation** | 🔵 Indigo | Light Indigo | Indigo Bar | Diagnostic visits, assessments |
| **Follow-up** | 🟠 Amber/Yellow | Light Amber | Amber Bar | Post-treatment check-ups |
| **Treatment** | 🟢 Emerald/Green | Light Emerald | Emerald Bar | Active treatment procedures |
| **Other** | ⚪ Slate/Gray | Light Gray | Gray Bar | Unspecified appointment types |

### ⚡ Status Indicators (Overlays)

| Status | Visual Indicator | Effect |
|--------|------------------|--------|
| **Scheduled** | Default | Shows appointment type color as-is |
| **In Progress** | 🔵 Blue Ring | Adds blue outline ring around card |
| **Completed** | ✅ Darker + Green | Makes type color darker + green accent ring |
| **Cancelled** | ❌ Red Override | Changes entire card to red (overrides type) |

## Visual Examples

### Day View Example
```
┌──────────────────────────────────────────┐
│  9:00 AM  │ 🟣 John Smith              │  ← Purple = First Visit
│           │    First Visit              │
├──────────────────────────────────────────┤
│ 10:00 AM  │ 🔵 Sarah Jones             │  ← Indigo = Consultation
│           │    Consultation             │
├──────────────────────────────────────────┤
│ 11:00 AM  │ 🟠 Mike Brown              │  ← Amber = Follow-up
│           │    Follow-up [BLUE RING]   │     (In Progress)
├──────────────────────────────────────────┤
│ 12:00 PM  │ 🟢 Jane Doe                │  ← Emerald = Treatment
│           │    Treatment                │
├──────────────────────────────────────────┤
│  1:00 PM  │ ❌ Bob Wilson              │  ← Red = Cancelled
│           │    Cancelled                │
└──────────────────────────────────────────┘
```

### Week View Example
```
     Mon          Tue          Wed          Thu
   ┌─────┐    ┌─────┐    ┌─────┐    ┌─────┐
9  │ 🟣  │    │ 🟢  │    │     │    │ 🔵  │
   │First│    │Treat│    │     │    │Cons │
   └─────┘    └─────┘    └─────┘    └─────┘
   ┌─────┐    ┌─────┐    ┌─────┐    ┌─────┐
10 │ 🟢  │    │ 🟠  │    │ 🟣  │    │ 🟢  │
   │Treat│    │Foll │    │First│    │Treat│
   └─────┘    └─────┘    └─────┘    └─────┘
```

### Month View Example
```
┌───────────────────────┐
│  15            [3]    │  ← 3 appointments today
│  🟣 🟢 🟠            │
│  9:00 John (First)   │  ← Purple chip = First Visit
│  2:00 Jane (Treat)   │  ← Emerald chip = Treatment
│  +1 more             │  ← Hidden: Amber = Follow-up
└───────────────────────┘
```

## How to Read Appointments at a Glance

### 1. **Check the Background Color**
- **Purple** = New patient coming in (prepare welcome materials)
- **Indigo** = Assessment/diagnosis (prepare diagnostic tools)
- **Amber** = Follow-up visit (check treatment history)
- **Emerald** = Active treatment (ensure operatory ready)
- **Gray** = Check appointment details

### 2. **Look for Status Rings**
- **Blue ring** = Currently happening (patient in chair)
- **Green accent** = Already finished (today or past)
- **Red color** = Cancelled (ignore or reschedule)
- **No ring** = Scheduled/waiting

### 3. **Use Left Border as Quick Scan**
The thick colored bar on the left side allows you to scan the schedule vertically and spot patterns:
- **Lots of purple bars** = Many new patients (plan extra time)
- **Lots of emerald bars** = Treatment-heavy day (plan resources)
- **Lots of amber bars** = Follow-up day (quick appointments)

## Color Meanings & Psychology

### 🟣 Purple (First Visit)
- **Meaning**: New, Welcome, Important
- **Clinical Context**: First impressions matter, prepare intake forms
- **Time Expectation**: Usually longer appointments

### 🔵 Indigo (Consultation)
- **Meaning**: Assessment, Diagnosis, Professional
- **Clinical Context**: Diagnostic focus, X-rays, examination
- **Time Expectation**: Medium duration

### 🟠 Amber (Follow-up)
- **Meaning**: Attention, Check-in, Transition
- **Clinical Context**: Post-treatment monitoring
- **Time Expectation**: Usually shorter appointments

### 🟢 Emerald (Treatment)
- **Meaning**: Active Care, Healing, Growth
- **Clinical Context**: Procedures, active treatment
- **Time Expectation**: Variable by procedure

### ⚪ Slate (Other)
- **Meaning**: Neutral, General
- **Clinical Context**: Miscellaneous appointments
- **Time Expectation**: Check notes

## Accessibility Notes

### For Color-Blind Users
- ✅ Each type also shows **text label** (e.g., "Treatment", "Follow-up")
- ✅ **Left border thickness** provides shape differentiation
- ✅ **Position in schedule** helps identify appointments
- ✅ **Patient name** is always visible

### For Screen Readers
- ✅ Appointment type is included in accessible labels
- ✅ Status is announced separately from type
- ✅ Time, patient name, and details are properly structured

## Print Reference

When printed in grayscale:
- **Purple** → Dark gray
- **Indigo** → Medium-dark gray
- **Amber** → Medium gray
- **Emerald** → Medium-light gray
- **Slate** → Light gray

Border thickness remains visible for differentiation.

## Quick Tips

### 🎯 Planning Your Day
1. **Morning Scan**: Check for purple (first visits) to allocate extra time
2. **Resource Check**: Count emerald (treatments) for operatory planning
3. **Follow-up Batch**: Group amber (follow-ups) for efficiency
4. **Consultation Prep**: Ensure diagnostic tools ready for indigo appointments

### 📊 Weekly Patterns
- **Heavy purple week** = Many new patients (marketing working!)
- **Heavy emerald week** = Treatment-heavy (ensure supplies)
- **Heavy amber week** = Follow-up wave (post-treatment success)
- **Balanced colors** = Good patient mix

### 📅 Monthly Overview
In month view, look for:
- **Colorful days** = Busy, diverse appointment types
- **Single color clusters** = Batch appointment types
- **Red spots** = Cancellations to reschedule
- **Empty days** = Available capacity

## Customization (Future)

While colors are currently fixed, future versions may allow:
- Custom color schemes per clinic
- User-defined appointment categories
- Alternative color palettes for preferences
- Dark mode compatible colors
- High contrast mode

---

**Print This Page**: Keep handy for quick reference
**Share with Team**: Ensure all staff understand the color system
**Training Material**: Use for onboarding new team members

**Last Updated**: October 12, 2025
**Applies to**: Appointment Organizer V2
