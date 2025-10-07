# Sprint 3 Week 1 - Code Analysis & Findings
**Date**: October 3, 2025
**Purpose**: Deep dive into existing conflict detection implementation to plan Sprint 3 Week 1

---

## 🔍 **Question 1: Does UC1ValidationEngine.detectConflicts() have full conflict logic?**

### **Answer: PARTIAL - Only 1 conflict type implemented**

**File**: `src/services/respec/UC1ValidationEngine.ts` (lines 346-387)

**Current Implementation**:
```typescript
detectConflicts(specifications: Array<{id: string, value: any}>): ConflictResult {
  // PRIMARY CONFLICT: High Performance vs Low Power Consumption
  const processor = specMap.get('processor_type');
  const powerConsumption = specMap.get('max_power_consumption');

  if (processor && powerConsumption) {
    const highPerformance = this.isHighPerformanceProcessor(processor.value);
    const lowPower = this.isLowPowerConsumption(powerConsumption.value);

    if (highPerformance && lowPower) {
      result.hasConflict = true;
      result.conflicts.push({
        type: 'logical',
        nodes: [processor.spec.id, powerConsumption.spec.id],
        description: 'High-performance processor incompatible with low power consumption',
        resolution: 'Choose either: (A) High performance with grid power (35-65W), or (B) Lower performance optimized for battery operation (10-20W)'
      });
    }
  }

  return result;
}
```

### **What's Implemented** ✅:
- **Logical Conflict**: High performance processor vs low power consumption
- Returns binary resolution text (A vs B)
- Hardcoded for MVP conflict only

### **What's MISSING** ❌:
1. **Mutex Conflicts**: UC1.json doesn't have mutex fields, but other datasets do - need to implement mutex detection
2. **Dependency Conflicts**: checkDependencies() method exists (line 416) but NOT integrated into detectConflicts()
3. **Constraint Conflicts**: validateSpecification() exists (line 217) but NOT integrated into detectConflicts()
4. **Cross-Artifact Conflicts**: Only checks mapped artifact, doesn't compare against respec artifact

### **What EXISTS but Incomplete** ⚠️:
- **ArtifactManager.resolveConflict()** (lines 266-308): Exists with full unblocking logic
- **applyConflictResolution()** (line 310): Stub only - needs implementation to actually remove/keep specs

### **Comment in Code** (line 383-384):
```typescript
// Additional UC1-based conflicts can be added here as discovered
// For MVP, focusing only on the primary conflict as specified
```

---

## 🔍 **Question 2: Two Conflict Services - Which to Use?**

### **Answer: USE ArtifactManager.detectConflicts() - Remove ConflictDetectionService.ts**

### **Analysis**:

#### **ConflictDetectionService.ts** (510 lines):
- **Purpose**: Field-level conflict detection for form updates
- **Scope**: Detects value changes, confidence warnings, compatibility issues
- **Integration**: NOT integrated with artifact system
- **Focus**: Single field updates (field-by-field)
- **Example Conflicts**:
  - "Field will be changed from X to Y"
  - "Low confidence extraction (60%)"
  - "Intel consumer processors may not support ECC memory"

#### **ArtifactManager.detectConflicts()** (lines 185-229):
- **Purpose**: UC1-based conflict detection for artifact specifications
- **Scope**: Detects UC1 schema violations across all mapped specs
- **Integration**: ✅ **Fully integrated** with Sprint 2 Week 2 flow
- **Focus**: Multi-spec analysis (holistic validation)
- **Example Conflicts**:
  - "High-performance processor incompatible with low power consumption"
  - UC1 constraint violations
  - Cross-artifact conflicts

### **Recommendation**:
1. ✅ **KEEP**: ArtifactManager.detectConflicts() - This is the Sprint 2 Week 2 implementation
2. ❌ **DEPRECATE**: ConflictDetectionService.ts - Legacy field-level service, not artifact-aware
3. 📝 **ACTION**: Move ConflictDetectionService.ts to `src/legacy_isolated/` folder

### **Evidence**:
- SPRINT2_WEEK2_PLAN.md line 472: "❌ Conflict resolution UI/flow" - NOT implemented in Week 2
- SemanticIntegrationService_NEW.ts lines 307, 355, 400: Uses `artifactManager.detectConflicts()`
- ConflictDetectionService is NEVER imported or used in any Sprint 2 Week 2 code

---

## 🔍 **Question 3: Should Sprint 3 Week 1 add cross-artifact conflict checking?**

### **Answer: YES - Explicitly Required**

### **Evidence from Plans**:

**IMPLEMENTATION_PLAN.md** (line 682):
```
4. **Cross-Artifact Conflicts**: New vs existing respec conflicts
```

**API_CONTRACTS.md** (line 48):
```typescript
interface Conflict {
  type: 'logical' | 'constraint' | 'dependency' | 'cross-artifact';
  nodes: string[];
  description: string;
}
```

**SPRINT2_WEEK2_PLAN.md** (lines 294-296):
```typescript
// 3. Check cross-artifact conflicts (mapped vs respec)
const crossConflicts = await this.checkCrossArtifactConflicts();
conflicts.push(...crossConflicts);
```

### **Current Status**:
- ❌ **NOT IMPLEMENTED** in Sprint 2 Week 2
- ArtifactManager.detectConflicts() only checks mapped artifact
- Does NOT compare mapped specs against respec specs

### **What Cross-Artifact Conflicts Mean**:
User specifies `spc001 = "Intel Core i9"` (new in mapped)
System already has `spc001 = "Intel Core i5"` (existing in respec)
→ **CONFLICT**: User trying to override existing respec specification

### **Sprint 3 Week 1 Scope**:
✅ Add `checkCrossArtifactConflicts()` method to ArtifactManager
✅ Compare mapped specs against respec specs
✅ Detect override attempts
✅ Return conflicts for binary question generation

---

## 🔍 **Question 4: How should conflicts be returned to AnthropicService?**

### **Answer: Via SimplifiedRespecService → AnthropicService prompt**

### **Evidence from Plans**:

**IMPLEMENTATION_PLAN.md** (lines 322-327):
```typescript
// Resolution flow using EXISTING chat infrastructure:
// 1. Detection → Agent formulates binary question
// 2. Question sent via setChatMessages (existing mechanism)
// 3. User response via ChatWindow.onSendMessage (existing)
// 4. Response processed by SimplifiedRespecService (existing)
// 5. Conflict resolved and artifacts updated
```

**SPRINT2_REVISED_PLAN.md** (lines 57-59):
```
│   └─ if CONFLICTS:
│       ├─ addToConflictList(spc001)
│       └─ agentGeneratesBinaryQuestion() // Returns to user
```

**respec-tech-spec-v101.md** (lines 311-316):
```typescript
this.state.priorityQueue.blocked = true;
this.state.priorityQueue.blockReason = 'Conflicts must be resolved first';

// Agent says: "Hold on, let's first resolve conflicting requirements:"
await this.presentConflictQuestion();
continue; // Loop back, don't process new input
```

### **Current Flow** (Sprint 2 Week 2):
```
User Input
  ↓
SimplifiedRespecService.processChatMessage()
  ↓
AnthropicService.analyzeRequirements() ← Extracts requirements
  ↓
SemanticIntegrationService_NEW.processExtractedNodes()
  ↓
ArtifactManager.addSpecificationToMapped()
  ↓
ArtifactManager.detectConflicts() ← Detects conflicts
  ↓
[STOPS HERE - conflicts logged but not returned]
```

### **Target Flow** (Sprint 3 Week 1):
```
User Input
  ↓
SimplifiedRespecService.processChatMessage()
  ├─ Check if system blocked by conflicts
  │  └─ If YES: Return conflict resolution prompt to agent
  ↓
AnthropicService.analyzeRequirements()
  ├─ Check if conflicts exist in context
  │  └─ If YES: Generate binary question from conflict data
  │  └─ Return binary question to user
  ↓
[User responds with A or B]
  ↓
SimplifiedRespecService detects resolution response
  ↓
ArtifactManager.resolveConflict(conflictId, choice)
  ↓
Remove losing spec, keep winning spec
  ↓
Unblock system, continue processing
```

### **Sprint 3 Week 1 Implementation**:

**Option 1: System Prompt Injection** (Recommended by user):
- SimplifiedRespecService checks for active conflicts
- If conflicts exist, inject conflict data into AnthropicService system prompt
- Agent uses conflict data to generate binary question
- Agent returns question via chat

**Option 2: Direct Question Generation**:
- ArtifactManager generates binary question text
- SimplifiedRespecService returns question directly to chat
- No agent involvement

**User's Stated Preference**:
> "let me worry about the prompt change required to enable the stateful agent process the conflicting datanodes into a binary question and sending it to the user via communicateWithMas. you handle the identification and return of conflicted data to the stateful agent."

### **Sprint 3 Week 1 Scope**:
✅ Identify conflicts (already done)
✅ Structure conflict data for agent consumption
✅ Return conflict data to SimplifiedRespecService
✅ SimplifiedRespecService passes conflicts to AnthropicService
❌ Agent prompt changes (user will handle)

---

## 📊 **Sprint 3 Week 1 Implementation Summary**

### **What Needs to be Built**:

1. **Enhance UC1ValidationEngine.detectConflicts()**:
   - ✅ Keep existing logical conflict (performance vs power)
   - ➕ Add dependency conflict detection (integrate checkDependencies())
   - ➕ Add constraint conflict detection (integrate validateSpecification())
   - ➕ Add cross-artifact conflict detection (compare mapped vs respec)

2. **Add ArtifactManager.checkCrossArtifactConflicts()**:
   - Compare each mapped spec against respec artifact
   - Detect override attempts
   - Return conflicts with clear descriptions

3. **Structure Conflict Data for Agent**:
   - Format conflicts for agent consumption
   - Include: conflict type, nodes, description, resolution options
   - Package as structured data (not just text)

4. **Return Path to Agent**:
   - SimplifiedRespecService checks `artifactManager.isSystemBlocked()`
   - If blocked, get conflicts: `artifactManager.getState().conflicts.active`
   - Pass conflicts to AnthropicService via context/prompt
   - Agent generates binary question (user handles prompt)

5. **Clean Up Legacy Code**:
   - Move `ConflictDetectionService.ts` to `src/legacy_isolated/`
   - Update imports if any (none found in Sprint 2 code)
   - Document deprecation reason

---

## 🎯 **Sprint 3 Week 1 Goals (Refined)**

### **Week 1: Conflict Detection Enhancement**

**Tasks**:
1. ✅ **Enhance UC1ValidationEngine** - Add dependency + constraint + cross-artifact checks
2. ✅ **Add Cross-Artifact Method** - Compare mapped vs respec
3. ✅ **Structure Conflict Data** - Format for agent consumption
4. ✅ **Return Path** - Pass conflicts to SimplifiedRespecService → AnthropicService
5. ✅ **Complete applyConflictResolution()** - Implement actual spec removal/retention logic with safety policies (see below)
6. ✅ **Deprecate Legacy** - Move ConflictDetectionService to legacy folder

### **Task 5: applyConflictResolution() Safety Policy**

**Critical Requirement**: This method manipulates central artifact state. Must have safeguards against data corruption.

**Safety Policies**:

1. **Pre-Validation**:
   - ✅ Verify conflict exists in `state.conflicts.active` before any modification
   - ✅ Verify resolution option exists in `conflict.resolutionOptions`
   - ✅ Verify all affected node IDs exist in mapped artifact
   - ❌ NEVER modify if validation fails - throw error instead

2. **Atomic Operations** (WITH CRITICAL CAVEAT):
   - ✅ Operations within a single conflict resolution must be atomic (all succeed or all fail)
   - ✅ If removing spec fails, do NOT proceed to move conflicting node
   - ✅ Use try-catch with full rollback capability
   - ⚠️ **ATOMIC DOES NOT MEAN "ALL OR NOTHING" FOR ENTIRE MAPPED ARTIFACT**
   - ⚠️ **CRITICAL ISSUE IDENTIFIED**:
     * Atomic should ONLY apply to the nodes in THIS conflict
     * If mapped artifact has non-conflicting specs (compatible, user-selected), they MUST remain untouched
     * Resolution of one conflict CANNOT override/remove unrelated specifications
     * Example: User selected spc010, spc011 (non-conflicting). Resolving conflict between spc001 vs spc005 must NOT touch spc010, spc011
   - ✅ **Policy**: Resolution ONLY removes losing specs from the conflict being resolved
   - ✅ **Policy**: All other specs in mapped artifact remain unchanged
   - ❌ **NEVER** implement "clear mapped artifact and re-add" pattern - this would destroy user selections

3. **Scope Restriction**:
   - ✅ ONLY modify nodes being resolved in THIS resolution iteration
   - ✅ NEVER remove nodes not part of the current conflict being resolved
   - ✅ If multiple conflicts exist, only resolve the one specified by conflictId
   - ✅ NEVER modify respec artifact during resolution (only mapped artifact)
   - ✅ Verify node is in mapped artifact before attempting removal
   - ⚠️ **CRITICAL**: A single resolution may NOT resolve all conflicts - only one conflict at a time

4. **Audit Trail**:
   - ✅ Log every removal: `[ArtifactManager] Removing spec ${specId} due to conflict resolution ${resolutionId}`
   - ✅ Log winning spec: `[ArtifactManager] Keeping spec ${specId} as resolution choice`
   - ✅ Store resolution in history: `state.conflicts.resolved[]`

5. **Resolution Options Contract**:
   - Resolution options generated by `generateResolutionOptions()` (line 231) must specify:
     - `targetNodes`: Array of node IDs affected
     - `action`: 'select_option_a' or 'select_option_b'
     - `expectedOutcome`: Human-readable description
   - `applyConflictResolution()` ONLY acts on nodes in `resolution.targetNodes[]`

6. **Verification After Modification**:
   - ✅ After removal, verify node no longer exists in mapped artifact
   - ✅ Verify winning node still exists in mapped artifact
   - ✅ Verify mapped artifact hierarchy still valid (no orphaned nodes)
   - ❌ If verification fails, log critical error and set system to error state

**Implementation Pattern**:
```typescript
private async applyConflictResolution(conflict: ActiveConflict, resolution: any): Promise<void> {
  // 1. PRE-VALIDATION
  if (!resolution.targetNodes || resolution.targetNodes.length === 0) {
    throw new Error('Resolution must specify targetNodes');
  }

  // 2. VERIFY ALL NODES EXIST IN MAPPED
  for (const nodeId of resolution.targetNodes) {
    const spec = this.findSpecificationInArtifact('mapped', nodeId);
    if (!spec) {
      throw new Error(`Node ${nodeId} not found in mapped artifact - cannot resolve`);
    }
  }

  // 3. DETERMINE WINNING/LOSING SPECS BASED ON USER CHOICE
  // Example: If option-a chosen (high performance), remove spc005 (low power), keep spc001
  let losingSpecs: string[] = [];
  let winningSpecs: string[] = [];

  if (resolution.id === 'option-a') {
    // High performance chosen - remove low power spec
    losingSpecs = conflict.conflictingNodes.filter(n => n.includes('power'));
    winningSpecs = conflict.conflictingNodes.filter(n => n.includes('processor'));
  } else if (resolution.id === 'option-b') {
    // Low power chosen - remove high performance spec
    losingSpecs = conflict.conflictingNodes.filter(n => n.includes('processor'));
    winningSpecs = conflict.conflictingNodes.filter(n => n.includes('power'));
  }

  // 4. ATOMIC REMOVAL (all or nothing)
  try {
    for (const specId of losingSpecs) {
      console.log(`[ArtifactManager] Removing spec ${specId} due to conflict resolution ${resolution.id}`);
      this.removeSpecificationFromMapped(specId);
    }

    for (const specId of winningSpecs) {
      console.log(`[ArtifactManager] Keeping spec ${specId} as resolution choice`);
    }

    // 5. VERIFICATION
    for (const specId of losingSpecs) {
      const stillExists = this.findSpecificationInArtifact('mapped', specId);
      if (stillExists) {
        throw new Error(`CRITICAL: Failed to remove ${specId} - data integrity compromised`);
      }
    }

    for (const specId of winningSpecs) {
      const exists = this.findSpecificationInArtifact('mapped', specId);
      if (!exists) {
        throw new Error(`CRITICAL: Winning spec ${specId} disappeared - data integrity compromised`);
      }
    }

  } catch (error) {
    console.error(`[ArtifactManager] ❌ CRITICAL: Resolution failed, system may be in inconsistent state`, error);
    throw error;
  }
}
```

**Open Question for Implementation**:
How to generically determine winning vs losing specs without hardcoding? Current code at line 233-249 generates options like:
- `option-a`: "High performance with grid power"
- `option-b`: "Lower performance for battery operation"

But the resolution object doesn't explicitly say "if option-a, remove node X and keep node Y". Should we:

**Option 1**: Add explicit node mapping to resolution options:
```typescript
{
  id: 'option-a',
  description: '...',
  removeNodes: ['spc005'],  // ← Explicit
  keepNodes: ['spc001']
}
```

**Option 2**: Use conflict type + resolution ID to determine action:
```typescript
// Based on conflict type 'logical' and nodes involved
if (conflict.type === 'logical' && resolution.id === 'option-a') {
  // Apply high-performance resolution
}
```

**Recommendation**: Option 1 (explicit node mapping) is safer and more maintainable.

---

### **Additional Critical Clarification: Descendant Specification Handling**

**Question Raised**: "Is the selection of descendant specifications implemented?"

**Context**: When a requirement or domain is matched:
- Requirement match → should add all child specifications
- Domain match → should add all child specifications from all requirements

**Current Implementation Status** (from Sprint 2 Week 2):

**File**: `SemanticIntegrationService_NEW.ts` lines 334-351 (Requirement Handling):
```typescript
// Get all child specifications for this requirement
const childSpecs = this.uc1Engine.getSpecificationsByRequirement(reqId);

// Add all child specifications to mapped artifact
for (const spec of childSpecs) {
  await this.artifactManager.addSpecificationToMapped(
    spec,
    spec.default_value || null,  // ← Uses default value
    `From requirement ${reqId}`,
    `Auto-added as part of requirement ${reqId}`
  );
}
```

**✅ YES - Descendant selection IS implemented**

**HOWEVER - Critical Safety Issue**:
- When adding child specs, they use `spec.default_value`
- These are added to mapped artifact
- If mapped artifact ALREADY has user-selected values for these specs, what happens?

**Scenario**:
1. User says "I need Intel Core i7" → spc001 added to mapped with value "Intel Core i7"
2. User says "I need thermal monitoring" → req001 matched → adds ALL child specs including spc001
3. **CONFLICT**: spc001 already exists in mapped with user value, now being added again with default value

**Required Policy**:
- ✅ **Check if spec already exists in mapped artifact before adding**
- ✅ **If exists with user-selected value → SKIP adding (preserve user selection)**
- ✅ **If exists with default value → OK to override with new default**
- ✅ **If exists in RESPEC artifact → This is cross-artifact conflict (detected separately)**
- ❌ **NEVER override user-selected values with defaults**

**Implementation Required**:
Add check to `addSpecificationToMapped()` or in the routing handlers:

```typescript
// BEFORE adding child spec
for (const spec of childSpecs) {
  // Check if spec already exists in mapped
  const existing = this.artifactManager.findSpecificationInArtifact('mapped', spec.id);

  if (existing) {
    // Check attribution - if user-selected, skip
    if (existing.attribution === 'requirement' && existing.source !== 'default') {
      console.log(`[Route] ⚠️  Skipping ${spec.id} - user value already exists in mapped`);
      continue; // Don't add, preserve user selection
    }
  }

  // Safe to add
  await this.artifactManager.addSpecificationToMapped(...);
}
```

**This policy ensures**:
- User-selected specs are never overridden by requirement/domain defaults
- Compatible, non-conflicting user selections remain intact
- Atomic resolution only affects conflicting nodes, not all nodes

**NOT in Week 1** (Week 2 or user handles):
- ❌ Binary question generation in agent (user handles prompt)
- ❌ Agent prompt modifications (user handles)
- ❌ User response parsing (A/B detection) - Week 2 scope
- ❌ SimplifiedRespecService resolution flow - Week 2 scope

### **Week 2: Conflict Resolution Flow**

**Tasks** (Future):
1. **Agent detects user resolution response** (A or B) - Semantic parsing by stateful agent
2. **Agent calls** `artifactManager.resolveConflict(conflictId, choice)` - Agent orchestrates resolution
3. Cycle management (3 attempts max)
4. Auto-resolution after 3 cycles

**Clarification**: SimplifiedRespecService does NOT parse A/B responses. The stateful agent (AnthropicService) interprets user intent and calls the resolution method.

---

## 📝 **Recommended Test Script**

To verify which conflict service is in use:

```javascript
// test-conflict-service-usage.cjs
const fs = require('fs');
const path = require('path');

// Check all .ts files for ConflictDetectionService imports
const srcDir = path.join(__dirname, 'src');

function searchImports(dir) {
  const files = fs.readdirSync(dir, { withFileTypes: true });

  files.forEach(file => {
    if (file.isDirectory()) {
      searchImports(path.join(dir, file.name));
    } else if (file.name.endsWith('.ts')) {
      const content = fs.readFileSync(path.join(dir, file.name), 'utf-8');
      if (content.includes('ConflictDetectionService')) {
        console.log(`Found in: ${path.join(dir, file.name)}`);
      }
    }
  });
}

searchImports(srcDir);
console.log('Search complete');
```

---

## ✅ **Recommendations**

### **Immediate Actions**:

1. **Confirm Approach**:
   - User confirms: Enhance ArtifactManager.detectConflicts()
   - User confirms: Deprecate ConflictDetectionService.ts
   - User confirms: Cross-artifact checking in Week 1

2. **Create Sprint 3 Week 1 Plan**:
   - List all tasks clearly
   - Define success criteria
   - Specify return path to agent

3. **Begin Implementation**:
   - Start with cross-artifact conflict detection
   - Then enhance UC1ValidationEngine
   - Then structure data for agent return

---

**Analysis Complete**: October 3, 2025
**Next Step**: User approval of findings + Sprint 3 Week 1 plan creation
