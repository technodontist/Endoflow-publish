# 📋 Enhanced Consultation Version Control

## 🎯 Current Structure (Updated Oct 7, 2025)

### ✅ **PRODUCTION VERSION (Stable)**
**File**: `components/dentist/enhanced-new-consultation.tsx`
**Status**: 🔒 **DO NOT MODIFY** - Production stable version
**Export**: `EnhancedNewConsultation`

**Features**:
- 12-tab comprehensive consultation system
- Voice AI integration with Gemini
- FDI dental chart with real-time updates
- Auto-save functionality
- Cross-dashboard synchronization

**History**: Renamed from `enhanced-new-consultation-v2.tsx` (Oct 7, 2025)
**Known Issues**: None (stable)

---

### 🚀 **DEVELOPMENT VERSION (Active Work)**
**File**: `components/dentist/enhanced-new-consultation-v3.tsx`
**Status**: ✏️ **ACTIVE DEVELOPMENT** - Safe to modify
**Export**: `EnhancedNewConsultationV3`

**Purpose**: Working copy for implementing new features and updates
**Base**: Duplicate of production version (Oct 7, 2025)

**Planned Updates**:
- [ ] UI/UX enhancements
- [ ] Additional features
- [ ] Performance optimizations
- [ ] Bug fixes

---

## Usage Guide

### For Production (Current Live System)
```typescript
import { EnhancedNewConsultation } from '@/components/dentist/enhanced-new-consultation'

export default function ConsultationPage() {
  return <EnhancedNewConsultation selectedPatientId={patientId} />
}
```

### For Testing New Features (Development)
```typescript
import { EnhancedNewConsultationV3 } from '@/components/dentist/enhanced-new-consultation-v3'

export default function ConsultationTestPage() {
  return <EnhancedNewConsultationV3 selectedPatientId={patientId} />
}
```

---

## Development Workflow

### Step 1: Make Changes to V3
All experimental changes should be made to `enhanced-new-consultation-v3.tsx`

### Step 2: Test Thoroughly
Test V3 in isolation before promoting to production

### Step 3: Promote to Production
Once V3 is stable and tested:
1. Backup V2: `cp enhanced-new-consultation-v2.tsx enhanced-new-consultation-v2-backup-[date].tsx`
2. Replace V2 with V3: `cp enhanced-new-consultation-v3.tsx enhanced-new-consultation-v2.tsx`
3. Update V2 export name if needed
4. Create new V3 for next iteration: `cp enhanced-new-consultation-v2.tsx enhanced-new-consultation-v3.tsx`

---

## File Locations

```
components/dentist/
├── enhanced-new-consultation-v2.tsx     # ⚠️ STABLE - DO NOT MODIFY
├── enhanced-new-consultation-v3.tsx     # ✏️ DEVELOPMENT - SAFE TO MODIFY
└── (backups)/
    ├── enhanced-new-consultation-v2-backup-2025-01-07.tsx
    └── ... (historical backups)
```

---

## Change Log

### V3 (Current Development)
- **Created**: January 2025
- **Base**: V2 (exact duplicate)
- **Status**: Ready for modifications
- **Changes**: None yet (identical to V2)

### V2 (Production)
- **Created**: December 2024
- **Status**: Stable production version
- **Features**: Complete 12-tab system with Voice AI
- **Issues**: None

---

## Notes for Developers

⚠️ **IMPORTANT RULES**:
1. **NEVER** modify `enhanced-new-consultation-v2.tsx` directly
2. **ALWAYS** work on `enhanced-new-consultation-v3.tsx`
3. Test V3 thoroughly before promoting to V2
4. Keep V2 as stable fallback in case V3 breaks
5. Document all changes in this file

✅ **Safe Operations**:
- Modify V3 freely
- Test V3 in development environment
- Create feature branches for V3

❌ **Unsafe Operations**:
- Directly editing V2
- Deploying untested V3 to production
- Deleting V2 without backup

---

## Quick Reference

| Version | File | Status | Modify? | Deploy? |
|---------|------|--------|---------|---------|
| V2 | `enhanced-new-consultation-v2.tsx` | Stable | ❌ NO | ✅ YES |
| V3 | `enhanced-new-consultation-v3.tsx` | Development | ✅ YES | ❌ NO (until tested) |

---

**Last Updated**: January 2025
**Maintained By**: Development Team
