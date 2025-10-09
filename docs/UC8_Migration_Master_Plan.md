# UC8 Dataset Migration - Master Implementation Plan

**Document Version:** 1.0 (Consolidated)
**Date:** 2025-10-09
**Status:** Sprint 2 Complete ✅ | Sprint 3 Ready
**Purpose:** Single source of truth for UC1→UC8 migration

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Architecture](#architecture)
3. [Sprint Status](#sprint-status)
4. [Sprint Details](#sprint-details)
5. [Testing](#testing)
6. [Next Steps](#next-steps)

---

## Executive Summary

### Migration Goal

Migrate from UC1 dataset (1 hardcoded conflict) to UC8 dataset (107 explicit pair-wise exclusions with 4 conflict types).

### Key Achievements

- ✅ **Sprint 0 Complete:** UC8 Data Layer foundation (UCDataLayer, ConflictResolver, DependencyResolver)
- ✅ **Sprint 1 Complete:** Services integration (SimplifiedRespecService, ArtifactManager, app.tsx initialization)
- ✅ **Sprint 2 Complete:** Full UC8 conflict detection with agent integration
- 📊 **Metrics:** 87 field mappings (vs 64 from UC1 = +35%), 107 exclusions detected, 4 conflict types supported

### Architecture Principle

**RESPEC artifact is the single source of truth** - Form can temporarily have conflicts, but RESPEC must always be conflict-free. Form heals from RESPEC after conflict resolution.

---

## Architecture

### Data Flow

```
User Input (Chat or Form)
    ↓
SimplifiedRespecService.processChatMessage()
    ↓
Extract specifications from user input
    ↓
Add specifications to MAPPED artifact (staging area)
    ↓
ArtifactManager.detectConflicts() ← UC8 ConflictResolver
    ↓
IF conflicts found:
    ↓
    Store in ArtifactManager.state.conflicts.active
    ↓
    SimplifiedRespecService.getActiveConflictsForAgent() ← Format data
    ↓
    Return conflict data to app.tsx
    ↓
    app.tsx sends to chat (agent receives via system message)
    ↓
    Agent generates binary question (via AnthropicService.handleConflictResolution)
    ↓
    User answers A or B
    ↓
    Agent calls ArtifactManager.resolveConflict()
    ↓
    Move resolved specs from MAPPED → RESPEC
    ↓
    Update form fields from RESPEC
    ↓
ELSE (no conflicts):
    ↓
    Move specs directly from MAPPED → RESPEC
    ↓
    Update form fields from RESPEC
```

### Four-Artifact System

1. **Requirements State** (form-driven) - Temporary, can have conflicts
2. **MAPPED Artifact** (staging) - Conflict detection gate
3. **RESPEC Artifact** (source of truth) - Must be conflict-free
4. **Form State** (UI) - Heals from RESPEC after resolution

### Key Components

| Component | Purpose | Location |
|-----------|---------|----------|
| **UCDataLayer** | Single data access layer for UC8 dataset | `src/services/data/UCDataLayer.ts` |
| **ConflictResolver** | Unified conflict detection & resolution | `src/services/data/ConflictResolver.ts` |
| **DependencyResolver** | Spec-level dependency management (OR/AND logic) | `src/services/data/DependencyResolver.ts` |
| **ArtifactManager** | Manages 4-artifact system, runs conflict detection | `src/services/respec/artifacts/ArtifactManager.ts` |
| **SimplifiedRespecService** | Orchestrates chat processing, formats conflict data | `src/services/respec/SimplifiedRespecService.ts` |
| **AnthropicService** | Handles agent conflict resolution logic | `src/services/respec/AnthropicService.ts` |
| **app.tsx** | UI layer, sends conflict data to agent | `src/app.tsx` |

---

## Sprint Status

### Sprint 0: UC8 Data Layer Foundation ✅

**Duration:** 2 days
**Status:** Complete

**Delivered:**
- Created UCDataLayer.ts (17KB) - 16 methods for all UC8 access patterns
- Created UCDataTypes.ts (3.7KB) - TypeScript interfaces
- Created ConflictResolver.ts (8.5KB) - 4 conflict types support
- Created DependencyResolver.ts (4.9KB) - OR/AND dependency logic
- Dataset: `public/uc_8.0_2.1.json` (60 specs, 107 exclusions, 32 requirements, 13 scenarios)

**Key Metrics:**
- 60 specifications loaded
- 107 pair-wise exclusions
- 4 conflict types (field_overwrite, exclusion, cascade, field_constraint)
- Zero compilation errors
- Zero runtime errors

---

### Sprint 1: Services Integration ✅

**Duration:** 2 days
**Status:** Complete

**Delivered:**
- **SimplifiedRespecService:** UC8 field mappings extraction (87 mappings vs 64 from UC1)
- **ArtifactManager:** UC8 imports added (preparation for Sprint 2)
- **app.tsx:** Initialization order fixed (UC8 loads BEFORE SimplifiedRespecService)
- **ConflictDetectionService:** Marked as deprecated

**Critical Fix:**
```typescript
// BEFORE (WRONG): SimplifiedRespec initialized first
await simplifiedRespecService.initialize(formFieldsData.field_definitions);
await ucDataLayer.load(); // Too late!

// AFTER (CORRECT): UC8 loads first
await ucDataLayer.load();
await simplifiedRespecService.initialize(formFieldsData.field_definitions);
```

**Result:** 87 field mappings from UC8 (35% improvement over UC1)

---

### Sprint 2: Full UC8 Conflict Detection ✅

**Duration:** 3 days
**Status:** Complete

**Delivered:**

#### 1. ArtifactManager Integration (src/services/respec/artifacts/ArtifactManager.ts)

**Lines 41-42:** Added UC8 conflict data storage
```typescript
private uc8ConflictData: Map<string, any> = new Map();
```

**Lines 317-375:** Replaced UC1 with UC8 conflict detection
```typescript
let result: ConflictResult;

if (ucDataLayer.isLoaded()) {
  console.log('[ArtifactManager] Using UC8 conflict detection with 107 exclusions');

  const specIds = specifications.map(s => s.id);
  const allConflicts = new Map<string, any>();

  // Check each spec against all others
  for (let i = 0; i < specIds.length; i++) {
    const checkSpec = specIds[i];
    const otherSpecs = specIds.filter((_, idx) => idx !== i);

    const uc8Conflicts = conflictResolver.detectConflicts(checkSpec, otherSpecs);

    uc8Conflicts.forEach(uc8Conflict => {
      const conflictKey = uc8Conflict.conflictingNodes.sort().join('|');
      if (!allConflicts.has(conflictKey)) {
        allConflicts.set(conflictKey, uc8Conflict);
      }
    });
  }

  // Store UC8 conflict data for resolution options
  this.uc8ConflictData.clear();
  Array.from(allConflicts.values()).forEach(uc8Conflict => {
    const conflictKey = uc8Conflict.conflictingNodes.sort().join('|');
    this.uc8ConflictData.set(conflictKey, uc8Conflict);
  });

  result = {
    hasConflict: allConflicts.size > 0,
    conflicts: Array.from(allConflicts.values()).map(uc8Conflict => ({
      type: uc8Conflict.type,
      nodes: uc8Conflict.conflictingNodes,
      description: uc8Conflict.description,
      resolution: uc8Conflict.resolution
    }))
  };

  console.log(`[ArtifactManager] UC8 detected ${result.conflicts.length} conflicts`);
} else {
  // Fallback to UC1
  result = this.uc1Engine.detectConflicts(specifications, activeRequirements, activeDomains);
}
```

**Lines 574-605:** Updated resolution options generation
```typescript
private generateResolutionOptions(conflict: any): any[] {
  const conflictKey = conflict.nodes.sort().join('|');
  const uc8Conflict = this.uc8ConflictData.get(conflictKey);

  if (uc8Conflict && uc8Conflict.resolutionOptions) {
    console.log(`[ArtifactManager] Using UC8 resolution options`);
    return uc8Conflict.resolutionOptions;
  }

  // Fallback to UC1-style options
  return [
    {
      id: 'option-a',
      description: 'Keep existing value',
      action: 'keep_existing',
      targetNodes: [conflict.nodes[0]],
      expectedOutcome: 'Current value preserved'
    },
    {
      id: 'option-b',
      description: 'Apply new value',
      action: 'apply_new',
      targetNodes: [conflict.nodes[1]],
      expectedOutcome: 'New value applied'
    }
  ];
}
```

#### 2. SimplifiedRespecService - getActiveConflictsForAgent() (Already Exists!)

**Lines 653-732** (SimplifiedRespecService.ts)

This method already existed and correctly formats conflict data for the agent:

```typescript
getActiveConflictsForAgent(): any {
  if (!this.artifactManager) {
    return { hasConflicts: false, conflicts: [] };
  }

  const state = this.artifactManager.getState();
  let activeConflicts = state.conflicts.active;

  if (activeConflicts.length === 0) {
    return { hasConflicts: false, conflicts: [] };
  }

  // Get first conflict (one at a time)
  const topConflict = activeConflicts[0];

  const structuredConflict = {
    id: topConflict.id,
    type: topConflict.type,
    description: topConflict.description,
    resolutionOptions: topConflict.resolutionOptions.map(option => ({
      id: option.id,
      label: option.description,     // ← Maps to "label" for agent
      outcome: option.expectedOutcome
    }))
  };

  return {
    hasConflicts: true,
    count: activeConflicts.length,
    totalConflicts: activeConflicts.length,
    conflicts: [structuredConflict]  // ← "conflicts" array for agent
  };
}
```

#### 3. app.tsx - Wire to Agent (src/app.tsx)

**Lines 1123-1148:** Added conflict detection after chat processing

```typescript
// Sprint 2: Check for active conflicts after processing chat
const conflictStatus = simplifiedRespecService.getActiveConflictsForAgent();

if (conflictStatus.hasConflicts) {
  console.log(`[APP] 🚨 Active conflicts detected, sending conflict data to agent`);
  console.log(`[APP] Conflict count: ${conflictStatus.count}`);
  console.log(`[APP] Conflict data:`, conflictStatus.conflicts[0]);

  // Add conflict message to chat for agent to process
  const conflictMessage: ChatMessage = {
    id: `conflict-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    role: 'system',
    content: JSON.stringify({
      type: 'conflict_detected',
      ...conflictStatus
    }),
    timestamp: new Date(),
    metadata: {
      ...conflictStatus,
      isConflict: true
    }
  };
  setChatMessages(prev => [...prev, conflictMessage]);

  // Return immediately - wait for user to resolve conflict before continuing
  return { success: true, hasConflict: true, conflictData: conflictStatus };
}
```

**Acceptance Criteria:**
- [✅] UC8 conflict detection in ArtifactManager
- [✅] All 107 exclusions detected
- [✅] 4 conflict types supported
- [✅] Resolution options from UC8 data
- [✅] Structured conflict data returned to agent
- [✅] Backward compatible with UC1 (falls back if UC8 not loaded)

---

## Sprint Details

### Conflict Data Format

**Agent Expects** (verified in AnthropicService.ts:462-564):

```typescript
{
  hasConflicts: boolean,
  count: number,
  totalConflicts: number,
  conflicts: [
    {
      id: string,
      type: string,
      description: string,
      resolutionOptions: [
        {
          id: string,
          label: string,         // ← "label" NOT "description"
          outcome: string
        }
      ]
    }
  ]
}
```

**Agent Processing Flow:**

1. Agent receives conflict data in system message
2. `AnthropicService.handleConflictResolution()` is called
3. Agent reads `conflicts[0]` (first conflict)
4. Agent reads `resolutionOptions` with `label` field
5. Agent generates binary question (A/B choice)
6. User answers "A" or "B"
7. Agent maps choice → `option-a` or `option-b`
8. Agent calls `artifactManager.resolveConflict(conflictId, selectedOption)`
9. Conflict resolved, specs moved to RESPEC, form updated

### Four Conflict Types

1. **field_overwrite** - Same field, different values (e.g., i7 → i5)
2. **exclusion** - Incompatible specs (e.g., high-performance ↔ low-power)
3. **cascade** - Dependency chain violation
4. **field_constraint** - Schema/validation violation

### Dependency Logic (OR/AND)

- **OR within category:** Any option from category satisfies requirement
- **AND across categories:** All categories must be satisfied
- **Auto-add strategy:** Tries each option until finding one without conflicts

**Example:**
```typescript
// Spec P22 requires: { "processor": ["P01", "P02"], "memory": ["P10", "P11"] }
// Must satisfy BOTH categories (AND)
// Can choose P01 OR P02 for processor (OR)
// Can choose P10 OR P11 for memory (OR)
```

---

## Testing

### Browser Testing Guide

**Prerequisites:**
- Dev server running: `npm run dev` (default port 3002)
- Browser with console open (F12)

**Test 1: Basic Exclusion Conflict**
```
1. User: "I need an Intel Core i9 processor"
2. Wait for response
3. User: "I also need low power consumption under 10W"
4. Expected Console Output:
   [ArtifactManager] UC8 detected 1 conflicts
   [APP] 🚨 Active conflicts detected
   [APP] Conflict count: 1
5. Expected Agent Behavior:
   "I found a conflict: You specified a high-performance Intel Core i9 processor,
   but also requested low power consumption (< 10W). These are incompatible.

   Which would you prefer?
   A) Keep Intel Core i9 (high performance, power increased)
   B) Change to Intel Atom (low power maintained, performance reduced)

   Please choose A or B."
6. User: "B"
7. Expected: Conflict resolved, form updates to low-power processor
```

**Test 2: Field Overwrite**
```
1. User: "Intel Core i7"
2. User: "Actually, Intel Core i5"
3. Expected: field_overwrite conflict detected
4. Agent asks: "Would you like to change from i7 to i5?"
5. User: "Yes"
6. Expected: Field updated to i5
```

**Test 3: No Conflicts**
```
1. User: "Intel Core i7"
2. Expected: No conflict, field updates normally
3. Console: [ArtifactManager] No conflicts detected
4. Form: Shows Intel Core i7
```

**Test 4: Resolution Flow**
```
1. Trigger conflict (Test 1)
2. User answers: "B"
3. Verify:
   - Console: Conflict resolved
   - Console: Specs moved to RESPEC
   - Form: Updated to reflect resolution
   - RESPEC artifact: Conflict-free
```

### Console Logging

**Expected Console Output (Successful Conflict Detection):**
```
[UCDataLayer] 📂 Loading dataset version: UC8
[UCDataLayer] ✅ Loaded UC8: {scenarios: 13, requirements: 32, specifications: 60, exclusions: 107}
[SimplifiedRespec] Using UC8 Data Layer for field mappings
[SimplifiedRespec] Extracted 87 field mappings from UC8
[ArtifactManager] Using UC8 conflict detection with 107 exclusions
[ConflictResolver] 🔍 detectConflicts(P15, [P01, P30, P40])
[UCDataLayer] 🔍 detectOverwriteConflicts(P15, [P01, P30, P40])
[UCDataLayer]   🚫 Exclusion conflict: E_PP_015
[ConflictResolver]   → Found 1 conflicts
[ArtifactManager] UC8 detected 1 conflicts (types: exclusion)
[ArtifactManager] Using UC8 resolution options for conflict: P01|P15
[APP] 🚨 Active conflicts detected, sending conflict data to agent
[APP] Conflict count: 1
```

### Automated Tests

**Test Script:**
```typescript
describe('Sprint 2 - UC8 Conflict Detection', () => {
  test('Detects exclusion conflicts', async () => {
    // Add conflicting specs
    await artifactManager.addSpecificationToMapped(spec1, 'Intel Core i9');
    await artifactManager.addSpecificationToMapped(spec2, '< 10W');

    // Detect conflicts
    const result = await artifactManager.detectConflicts();

    expect(result.hasConflict).toBe(true);
    expect(result.conflicts.length).toBeGreaterThan(0);
    expect(result.conflicts[0].type).toBe('exclusion');
  });

  test('Formats conflict data for agent correctly', () => {
    const conflictData = simplifiedRespecService.getActiveConflictsForAgent();

    expect(conflictData).toHaveProperty('hasConflicts', true);
    expect(conflictData).toHaveProperty('conflicts');
    expect(conflictData.conflicts).toHaveLength(1);

    const conflict = conflictData.conflicts[0];
    expect(conflict).toHaveProperty('resolutionOptions');
    expect(conflict.resolutionOptions[0]).toHaveProperty('label');
    expect(conflict.resolutionOptions[0]).toHaveProperty('outcome');
  });

  test('Returns null when no conflicts', () => {
    const conflictData = simplifiedRespecService.getActiveConflictsForAgent();
    expect(conflictData.hasConflicts).toBe(false);
  });
});
```

---

## Next Steps

### Sprint 3: Resolution & Reversibility (3-4 days)

**Goals:**
1. Implement full conflict resolution workflow
2. Add dependency validation during auto-add
3. Implement conflict reversibility (undo capability)
4. Add conflict history tracking

**Tasks:**
1. **Dependency Validation:**
   ```typescript
   async autoFulfillDependencies(reqId: string): Promise<void> {
     const dependencies = getDependencies(reqId);

     for (const dep of dependencies) {
       const conflicts = conflictResolver.detectConflicts(dep, currentSelections);

       if (conflicts.length === 0) {
         await addDependency(dep);
         break;
       }
     }

     if (!anyAdded) {
       return {
         type: 'dependency_validation_failed',
         reason: 'all_options_conflict',
         conflicts: allConflictData
       };
     }
   }
   ```

2. **Resolution History:**
   - Track all conflict resolutions
   - Allow undo of last N resolutions
   - Display resolution history in UI

3. **Edge Cases:**
   - Multiple simultaneous conflicts (queue management)
   - Circular dependencies
   - Conflict resolution causing new conflicts

4. **Performance Optimization:**
   - Cache conflict detection results
   - Optimize pair-wise checking for large spec sets
   - Add conflict detection benchmarking

### Sprint 4: UI Enhancements (2-3 days)

**Goals:**
1. Visual conflict indicators in form
2. Conflict resolution panel
3. Resolution history timeline
4. Dependency visualization

---

## Architecture Decisions Record

### 1. Single Data Layer Pattern
**Decision:** All UC dataset access through `ucDataLayer` singleton
**Rationale:** Replaces 7 scattered UC1 access points with single source of truth
**Impact:** Simplified maintenance, consistent API

### 2. Fail-Fast Philosophy
**Decision:** Extensive console logging, immediate error throwing
**Rationale:** MVP approach - detect issues early, optimize later
**Impact:** Easier debugging, clear failure points

### 3. Backward Compatibility
**Decision:** UC8 runs in parallel, services fall back to UC1 if UC8 not loaded
**Rationale:** Can't break existing functionality during migration
**Impact:** Safe migration path, gradual rollout possible

### 4. Four-Artifact System
**Decision:** Separate MAPPED (staging) and RESPEC (source of truth) artifacts
**Rationale:** Allows conflict detection before committing to source of truth
**Impact:** Form can temporarily have conflicts, RESPEC always conflict-free

### 5. Agent Integration via Existing Methods
**Decision:** Use existing `getActiveConflictsForAgent()` instead of creating new method
**Rationale:** Method already exists with correct format, reduces code changes
**Impact:** Minimal implementation, faster delivery

---

## File Reference

### Core Files

| File | Size | Purpose | Sprint |
|------|------|---------|---------|
| `src/services/data/UCDataLayer.ts` | 17KB | UC8 data access layer | 0 |
| `src/services/data/UCDataTypes.ts` | 3.7KB | TypeScript interfaces | 0 |
| `src/services/data/ConflictResolver.ts` | 8.5KB | Conflict detection | 0 |
| `src/services/data/DependencyResolver.ts` | 4.9KB | Dependency management | 0 |
| `src/services/respec/artifacts/ArtifactManager.ts` | Modified | 4-artifact system, UC8 integration | 2 |
| `src/services/respec/SimplifiedRespecService.ts` | Modified | UC8 field mappings, conflict formatting | 1, 2 |
| `src/services/respec/AnthropicService.ts` | Existing | Agent conflict resolution logic | - |
| `src/app.tsx` | Modified | UC8 initialization, conflict wiring | 1, 2 |
| `public/uc_8.0_2.1.json` | 45KB | UC8 dataset | 0 |

### Documentation Files (REPLACED BY THIS DOCUMENT)

- ~~UC_Dataset_Migration_spec_v3.md~~
- ~~UC_Dataset_Migration_spec_v3.1.md~~
- ~~UC8_Migration_Progress.md~~
- ~~Sprint2_Bridge_Gap_Fix.md~~

**Use this document only from now on.**

---

## Key Metrics

| Metric | UC1 (Before) | UC8 (After) | Improvement |
|--------|--------------|-------------|-------------|
| Field Mappings | 64 | 87 | +35% |
| Explicit Conflicts | 1 (hardcoded) | 107 (dataset) | +10,600% |
| Conflict Types | 1 | 4 | +300% |
| Data Access Points | 7 (scattered) | 1 (ucDataLayer) | -85% |
| Specifications | ~50 (implicit) | 60 (explicit) | +20% |

---

## Quick Reference

### Start Dev Server
```bash
npm run dev
```

### Run TypeScript Check
```bash
npx tsc --noEmit
```

### Run Tests
```bash
npm test
```

### Check UC8 Loading
Open browser console and look for:
```
[UCDataLayer] ✅ Loaded UC8: {scenarios: 13, requirements: 32, specifications: 60, exclusions: 107}
```

### Trigger Test Conflict
1. Open app in browser
2. Chat: "Intel Core i9 processor"
3. Chat: "Low power consumption under 10W"
4. Check console for conflict detection
5. Agent should ask binary question

---

**END OF MASTER PLAN**

**Last Updated:** 2025-10-09
**Next Sprint:** Sprint 3 (Resolution & Reversibility)
**Contact:** See project repository for issues/PRs
