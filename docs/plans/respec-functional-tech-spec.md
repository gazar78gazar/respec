# ReSpec Claude Code Implementation Guide - Master Document
## Complete System Blueprint & Implementation Instructions

**Purpose**: Guide Claude Code through implementation, detect/correct deviations, restore context after resets
**Version**: 4.0 - Sprint 3 Complete
**Current Status**: Sprint 3 Complete - Ready for Sprint 4 Planning
**Overall Progress**: 75% Complete (Sprint 1 ✅, Sprint 2 ✅, Sprint 3 ✅, Sprint 4 Pending)

---

## 🚨 IMMEDIATE CONTEXT CHECK FOR CLAUDE CODE

### Where Are You Now?
```
Current Date: October 3, 2025
Current Sprint: 3 COMPLETE
Status: Ready for manual testing and Sprint 4 planning
Last Completed: Sprint 3 Week 2 - Agent-Driven Resolution Flow
```

### What Has Been Completed?
```typescript
// SPRINT 3 WEEK 1 ✅ (Enhanced Conflict Detection)
// - Multi-type conflict detection (mutex, dependency, constraint, logical, cross-artifact)
// - Surgical resolution engine with rollback
// - User-selection preservation
// - 24/25 tests passing (96%)

// SPRINT 3 WEEK 2 ✅ (Agent-Driven Resolution Flow)
// - Semantic A/B response parsing
// - Resolution orchestration with cycle management
// - Auto-escalation after 3 failed attempts
// - Priority queue (one conflict at a time)
// - 25/25 tests passing (100%)
```

### Quick Validation - System Health Check
Run these commands to verify current state:
```bash
# Check TypeScript errors (269 errors - 51 above baseline, mostly type definitions)
npx tsc --noEmit | grep "Found"

# Run Sprint 3 test suites
node test-sprint3-week1-conflict-detection.cjs
node test-sprint3-week2-resolution-flow.cjs

# Test existing functionality (MANUAL)
npm run dev
# Test Scenarios:
# 1. "I need 500GB storage" → Should update form
# 2. Create mutex conflict → Should present binary question
# 3. Answer with "A" → Should resolve conflict and confirm
```

---

## 🎯 SYSTEM PURPOSE & ARCHITECTURE

### What ReSpec Does
ReSpec transforms natural language requirements into validated, conflict-free technical specifications for industrial systems. It uses LLM intelligence (40%) for understanding and matching, with deterministic code (60%) for validation and state management.

### Core Value Delivery
1. **Extracts** specifications from chat ("I need redundant power" → power_redundant: true)
2. **Matches** to UC1 schema using semantic similarity
3. **Detects** conflicts (high performance + low power = conflict)
4. **Resolves** via binary questions in chat
5. **Updates** form fields immediately upon validation

### The Three-Layer Architecture

```
┌────────────────────────────────────────────┐
│           ORCHESTRATION LAYER              │
│         SimplifiedRespecService            │
│   (Session context, conversation history)  │
└────────────────┬───────────────────────────┘
                 ↓
┌────────────────────────────────────────────┐
│           PROCESSING LAYER                 │
├────────────────┬───────────────────────────┤
│  Extraction    │    Matching & Routing     │
│ AnthropicService│ SemanticMatchingService  │
│ (Stateful LLM) │ (Stateless LLM) +        │
│                │ SemanticIntegrationService│
└────────────────┴───────────────────────────┘
                 ↓
┌────────────────────────────────────────────┐
│           STATE MANAGEMENT LAYER           │
├──────────┬─────────┬──────────┬────────────┤
│Artifacts │Conflicts│   UC1    │   Form     │
│Manager   │Detection│Validation│  Updates   │
└──────────┴─────────┴──────────┴────────────┘
```

---

## 🔄 THE COMPLETE PROCESSING FLOW

### How User Input Becomes Form Data

```typescript
// 1. USER INPUT ENTRY
User types: "I need a ruggedized system with AI"
            ↓
// 2. ORCHESTRATION (SimplifiedRespecService)
communicateWithMAS() → SimplifiedRespecService.processChatMessage()
- Adds to conversationHistory[]
- Provides session context
            ↓
// 3. EXTRACTION (AnthropicService)
AnthropicService.analyzeRequirements(message, conversationHistory)
- Extracts: ["ruggedized", "AI capabilities"]
- Returns: { extractedRequirements[], conversationalResponse }
            ↓
// 4. INTEGRATION (SemanticIntegrationService_NEW)
SemanticIntegrationService.processMessage(extractedRequirements)
- Logs: "[Integration] Received extractions: ruggedized, AI"
            ↓
// 5. MATCHING (SemanticMatchingService)
SemanticMatchingService.matchToUC1(extractedNodes, uc1Schema)
- Matches: "ruggedized" → spc_ingress_protection (0.92 confidence)
- Matches: "AI" → spc_ai_acceleration (0.95 confidence)
            ↓
// 6. ROUTING (SemanticIntegrationService_NEW)
For each match:
  if (type === 'specification' && confidence >= 0.9):
    → addSpecificationToMapped(specId, value)
    → detectConflicts() // IMMEDIATE
    → if NO conflicts: moveToRespec() + updateForm()
    → if CONFLICT: isolateConflict() + generateQuestion()
            ↓
// 7. FORM UPDATE (app.tsx)
updateField(fieldId, value) → setState → UI renders
```

### Critical Rules That MUST Be Followed

1. **LLM Roles Are Separated**:
   - AnthropicService: ONLY extraction, questions, conversation
   - SemanticMatchingService: ONLY UC1 matching (stateless)
   - NEVER mix these responsibilities

2. **Conflict Detection Is Immediate**:
   - Run after EVERY artifact update
   - Block new processing when conflicts exist
   - No exceptions to this rule

3. **Form Updates Are Immediate**:
   - Specifications update form instantly
   - Requirements/domains do NOT update form
   - Updates happen even during partial branch movement

4. **Branch Splitting Is Allowed**:
   - Conflicts isolate individual nodes
   - Clean siblings move to respec immediately
   - Branch integrity is secondary to coherence

---

## 📦 STATE MANAGEMENT STRUCTURE

### The Four Artifacts (NEVER MERGE THESE)

```typescript
interface AppState {
  // 1. RESPEC ARTIFACT - The source of truth
  artifacts.respec: {
    nodes: Map<string, ValidatedNode>,  // Only conflict-free nodes
    metadata: {
      conflictsAllowed: false,          // NEVER true
      completeness: number,              // 0-100%
      validationStatus: 'valid'         // Always valid or empty
    }
  },

  // 2. MAPPED ARTIFACT - Temporary staging
  artifacts.mapped: {
    nodes: MatchedNode[],                // Can have conflicts
    metadata: {
      conflictsAllowed: true,            // Can contain conflicts
      pendingValidation: string[]        // Nodes awaiting validation
    }
  },

  // 3. UNMAPPED LIST - Unrecognized items
  artifacts.unmapped: {
    items: Array<{
      text: string,                      // Original user text
      reason: 'low_confidence' | 'no_match' | 'user_custom',
      attempts: number                   // Resolution attempts
    }>
  },

  // 4. CONFLICT LIST - Isolated conflicts
  artifacts.conflicts: {
    active: Array<{
      id: string,
      conflictingNodes: string[],        // Individual nodes, NOT branches
      type: 'constraint' | 'dependency' | 'cross-artifact',
      cycleCount: number                 // Resolution attempts
    }>,
    resolved: Conflict[],
    escalated: Conflict[]                // After 3 cycles
  }
}
```

### State Transition Rules

```typescript
// VALID TRANSITIONS
mapped → respec (if no conflicts)
mapped → conflicts (if conflicts detected)
conflicts → respec (when resolved)
conflicts → unmapped (after 3 cycles)
unmapped → mapped (if user clarifies)

// INVALID TRANSITIONS (NEVER DO THESE)
respec → conflicts (respec is always clean)
conflicts → mapped (must resolve first)
respec → unmapped (validated data doesn't become unmapped)
```

---

## 🏗️ COMPONENT IMPLEMENTATION DETAILS

### 1. SimplifiedRespecService (Orchestrator)
**File**: `src/services/respec/SimplifiedRespecService.ts`
**Purpose**: Maintain session context, route messages
**Key Methods**:
```typescript
async processChatMessage(message: string): Promise<ProcessedResponse> {
  // 1. Add to conversation history
  this.conversationHistory.push({ role: 'user', content: message });
  
  // 2. Check if conflicts exist (BLOCKING CHECK)
  if (await this.conflictService.hasActiveConflicts()) {
    return this.conflictService.processResolution(message);
  }
  
  // 3. Normal processing flow
  const extracted = await this.anthropicService.analyzeRequirements(
    message, 
    this.conversationHistory
  );
  
  // 4. Route to integration
  return this.integrationService.processMessage(extracted);
}
```

### 2. AnthropicService (Extraction Agent)
**File**: `src/services/respec/AnthropicService.ts`
**Purpose**: Extract requirements, manage conversation
**System Prompt Excerpt**:
```typescript
const SYSTEM_PROMPT = `
You extract technical requirements from user input.
You do NOT match to UC1 - another service handles that.
You maintain conversation context and ask clarifying questions.

For each extraction, identify:
- The technical requirement or specification
- Whether it's clearly stated or assumed
- Confidence level of the extraction

Ask up to 2 questions per response when information is missing.
`;
```

### 3. SemanticMatchingService (UC1 Matcher)
**File**: `src/services/respec/semantic/SemanticMatchingService.ts`
**Purpose**: Match extracted nodes to UC1 schema
**Implementation**:
```typescript
async matchToUC1(
  extractedNodes: ExtractedNode[], 
  uc1Schema: UC1Schema
): Promise<MatchResult[]> {
  // STATELESS - receives full UC1 every time
  const prompt = `
    Match these extracted nodes to the UC1 schema.
    Use semantic similarity, not exact string matching.
    
    Extracted nodes: ${JSON.stringify(extractedNodes)}
    UC1 Schema: ${JSON.stringify(uc1Schema)}
    
    Return confidence scores 0.0-1.0 for each match.
    Identify if each match is a domain, requirement, or specification.
  `;
  
  const response = await this.llm.complete(prompt);
  return this.parseMatches(response);
}
```

### 4. ConflictDetectionService vs ArtifactManager (IMPORTANT)
**Status**: Two services exist, only one is active
- **ConflictDetectionService.ts**: Legacy field-level service (NOT integrated) - TO BE DEPRECATED
- **ArtifactManager.detectConflicts()**: Active artifact-level service (Sprint 2 Week 2) ✅ USE THIS

**File**: `src/services/respec/artifacts/ArtifactManager.ts`
**Current Implementation**:
```typescript
// ArtifactManager.detectConflicts() - lines 185-229
async detectConflicts(): Promise<ConflictResult> {
  // Delegates to UC1ValidationEngine
  const conflicts = await this.uc1Engine.detectConflicts(specifications);
  
  // Currently only detects 1 conflict type:
  // - Performance vs Power (hardcoded in UC1ValidationEngine)
  
  // MISSING:
  // - Dependency conflicts
  // - Constraint conflicts  
  // - Cross-artifact conflicts (mapped vs respec)
  // - Mutex conflicts (for datasets beyond UC1)
  
  return { hasConflict, conflicts };
}

// resolveConflict() exists (lines 266-308) but 
// applyConflictResolution() is a stub (line 313)
```

**Sprint 3 Week 1 Must Add**:
1. Complete conflict types in UC1ValidationEngine
2. Add cross-artifact checking
3. Implement applyConflictResolution() with safety policies
4. Deprecate legacy ConflictDetectionService

---

## 📋 SPRINT IMPLEMENTATION SCHEDULE

### Sprint 1: Foundation (COMPLETE ✅)
**What Was Built**:
- Multi-artifact state structure
- UC1ValidationEngine for schema handling
- Basic ArtifactManager structure
- ConflictDetectionService skeleton
- Compatibility layer for existing code

**Validation**: Run `ls src/services/respec/artifacts/` - should see 4 artifact files

### Sprint 2: LLM Semantic Matching (COMPLETE ✅)

#### Week 1 (COMPLETE ✅)
**What Was Built**:
- SemanticMatchingService - stateless UC1 matcher
- SemanticIntegrationService_NEW - routing layer
- Enhanced AnthropicService prompts
- Form update preservation

**Validation**: Test "I need 500GB storage" in chat - should update form

#### Week 2 (COMPLETE ✅)
**What Was Built**:
- Artifact population methods (addSpecificationToMapped, addRequirementToMapped, addDomainToMapped)
- Conflict detection wiring in SemanticIntegrationService
- Movement to respec (moveToRespecArtifact)
- Partial branch handling
- Integration testing complete

**Completion Report**: See `docs/sprints+fixes/SPRINT2_WEEK2_COMPLETION.md`

### Sprint 3: Enhanced Conflict System (COMPLETE ✅)

#### Week 1: Multi-Type Conflict Detection (COMPLETE ✅)
**What Was Built**:
- UC1ValidationEngine enhanced with 5 conflict types:
  - Mutex conflicts (mutually exclusive options)
  - Dependency conflicts (missing required specs)
  - Constraint conflicts (incompatible combinations)
  - Logical conflicts (UC1 rule violations)
  - Cross-artifact conflicts (mapped vs respec mismatches)
- Surgical resolution engine with rollback (`applyConflictResolution()`)
- User-selection preservation in SemanticIntegrationService_NEW
- Helper methods: `findSpecificationInArtifact()`, `findSpecificationInMapped()`, `removeSpecificationFromMapped()`, `restoreSpecificationToMapped()`
- Legacy cleanup: Moved `ConflictDetectionService` to `legacy_isolated/`

**Test Results**: 24/25 tests passing (96%)
**Completion Report**: See `docs/sprints+fixes/SPRINT3_WEEK1_COMPLETION.md`
**Test File**: `test-sprint3-week1-conflict-detection.cjs`

#### Week 2: Agent-Driven Resolution Flow (COMPLETE ✅)
**What Was Built**:
- `parseConflictResponse()` in AnthropicService - semantic A/B choice extraction
- `generateClarification()` - handle user questions during resolution
- `handleConflictResolution()` - complete orchestration lifecycle
- `incrementConflictCycle()` and `escalateConflict()` in ArtifactManager
- Priority queue in `getActiveConflictsForAgent()` (one conflict at a time)
- Progress indicators and confirmation messages
- Cycle management: auto-escalation after 3 failed attempts
- Error handling with try-catch and rollback

**Test Results**: 25/25 tests passing (100%)
**Completion Report**: See `docs/sprints+fixes/SPRINT3_WEEK2_COMPLETION.md`
**Test File**: `test-sprint3-week2-resolution-flow.cjs`

**Sprint 3 Total Impact**:
- ~740 lines of production code
- 50 automated tests (48/50 passing, 96% overall)
- 8 files modified
- 5 documentation files created

### Sprint 4: Integration & Polish (FINAL WEEK)
- End-to-end testing
- Autofill enhancement
- Export functionality
- Performance validation

---

## 🧪 TESTING & VALIDATION

### Daily Validation Checklist

```bash
# 1. TypeScript baseline check (MUST be ~218)
npx tsc --noEmit | grep "Found"

# 2. Core functionality test
npm run dev
# Test: "I need 512GB storage" → form updates
# Test: "High performance" → adds to form
# Test: Chat history maintained

# 3. Artifact state check (browser console)
console.log(window.appState.artifacts)
# Should see: respec, mapped, unmapped, conflicts

# 4. Sprint-specific tests
# Sprint 2 Week 2: Check conflict detection
# Type: "High performance with minimal power"
# Expected: Conflict detected, question generated
```

### How to Detect Deviations

**Red Flags - You're Off Track If**:
1. TypeScript errors increase above 218
2. Form doesn't update when specs are extracted
3. Chat messages don't appear
4. Console shows no artifact state
5. Conflict detection doesn't trigger
6. You're modifying files not in today's task list

**Recovery Steps**:
1. Stop immediately
2. Run validation checklist above
3. Check current sprint/week/day
4. Review today's implementation task
5. Restore from last known good state
6. Resume with correct task

---

## 🚫 CRITICAL RULES - NEVER VIOLATE

### Architecture Rules
1. **NEVER merge the four artifacts** - they serve different purposes
2. **NEVER let respec contain conflicts** - it's the clean source of truth
3. **NEVER skip conflict detection** - run after every artifact update
4. **NEVER mix LLM responsibilities** - extraction vs matching are separate

### Implementation Rules
1. **NEVER fix unrelated TypeScript errors** - maintain 218 baseline
2. **NEVER add UI debug overlays** - console only
3. **NEVER break existing functionality** - test continuously
4. **NEVER skip validation** - run checks after each change

### Process Rules
1. **NEVER code without knowing current sprint/week/day**
2. **NEVER implement future sprint features** - stay on schedule
3. **NEVER merge Week 2 features before Week 1 complete**
4. **NEVER assume - validate current state first**

---

## 🔍 DEBUGGING & TROUBLESHOOTING

### Common Issues & Solutions

**Issue**: Form not updating after extraction
```typescript
// Check: Is the field mapping correct?
console.log(this.fieldMappings.get('storage_capacity'))
// Should show: { formField: 'storage_capacity', ... }

// Check: Is confidence >= 0.9?
console.log(matchResult.confidence)
// Must be >= 0.9 for immediate update

// Check: Is it a specification (not requirement)?
console.log(matchResult.type)
// Must be 'specification' for form update
```

**Issue**: Conflicts not detecting
```typescript
// Check: Is detectConflicts() being called?
// Add log in SemanticIntegrationService_NEW:
console.log('[Integration] Calling conflict detection...');

// Check: Are nodes in mapped artifact?
console.log(this.artifactManager.getMappedNodes());

// Check: Is conflict logic correct?
// Add logs in detectConflicts() method
```

**Issue**: Chat not responding
```typescript
// Check: Is SimplifiedRespecService initialized?
console.log(this.respecService);

// Check: Are conflicts blocking?
console.log(await this.conflictService.hasActiveConflicts());

// Check: Is conversation history maintained?
console.log(this.conversationHistory);
```

---

## 📊 IMPLEMENTATION METRICS

### Current Progress Indicators
- Overall: 35% complete (14/40 days)
- Sprint 1: 100% ✅
- Sprint 2 Week 1: 100% ✅
- Sprint 2 Week 2: 40% (Day 3/7)
- Conflicts Detected: 0 (implementation today)
- Form Fields Auto-filled: 12/37

### Success Criteria Tracking
| Criterion | Target | Current | Status |
|-----------|--------|---------|--------|
| Form Completion | 70% | 32% | 🔄 |
| Response Time | <2s | 1.2s | ✅ |
| Extraction Accuracy | 90% | 85% | 🔄 |
| Conflict Detection | 100% | 0% | 🚀 |
| TypeScript Baseline | 218 | 218 | ✅ |

---

## 🎯 WHAT TO DO RIGHT NOW

### If Starting Fresh (Context Reset)
1. Read "IMMEDIATE CONTEXT CHECK" section at top
2. Verify current sprint/week/day
3. Run validation checklist
4. Continue with today's task

### Critical Safety Policy for Conflict Resolution

**CRITICAL**: Conflict resolution must protect user-selected specifications:

1. **Scope Protection**:
   - ONLY modify nodes involved in the specific conflict being resolved
   - NEVER touch non-conflicting specifications (they may be user-selected)
   - Each resolution handles ONE conflict at a time (others remain active)

2. **User Selection Preservation**:
   - Non-conflicting specs already in mapped/respec are protected
   - User overrides have highest priority
   - System NEVER removes specs unless they're part of active conflict

3. **Atomic Operation Clarification**:
   - "Atomic" means the resolution operation completes fully or rolls back
   - Does NOT mean resolving all conflicts at once
   - Does NOT mean overriding user selections

4. **Resolution Contract**:
```typescript
interface ResolutionPolicy {
  conflictId: string;           // Specific conflict being resolved
  affectedNodes: string[];      // ONLY these nodes can be modified
  protectedNodes: string[];     // User-selected, non-conflicting nodes
  action: 'remove' | 'keep';    // Action for each affected node
}
```

---

## 📝 APPENDIX: Quick Reference

### File Locations
```
src/
├── app.tsx (main app, form state)
├── services/respec/
│   ├── SimplifiedRespecService.ts (orchestrator)
│   ├── AnthropicService.ts (extraction)
│   ├── semantic/
│   │   └── SemanticMatchingService.ts (UC1 matching)
│   ├── integration/
│   │   └── SemanticIntegrationService_NEW.ts (routing)
│   ├── artifacts/
│   │   ├── ArtifactManager.ts
│   │   └── [4 artifact files]
│   ├── conflicts/
│   │   └── ConflictDetectionService.ts
│   └── validation/
│       └── UC1ValidationEngine.ts
```

### Key Methods Chain
```
communicateWithMAS()
  → SimplifiedRespecService.processChatMessage()
    → AnthropicService.analyzeRequirements()
    → SemanticIntegrationService.processMessage()
      → SemanticMatchingService.matchToUC1()
      → ArtifactManager.addToMapped()
      → ConflictDetectionService.detectConflicts()
      → ArtifactManager.moveToRespec()
      → FormManager.updateField()
```

### Validation Commands
```bash
npx tsc --noEmit                    # TypeScript check
npm run dev                          # Start dev server
npm test                            # Run test suite
git status                          # Check modifications
git diff HEAD~1                     # See recent changes
```

---

**END OF MASTER DOCUMENT**
**Use this as your single source of truth**
**If confused, return to IMMEDIATE CONTEXT CHECK section**