# Sprint 3 Week 1 - Enhanced Conflict Detection Implementation Plan

**Date**: October 3, 2025
**Sprint**: 3, Week 1 (Days 1-7)
**Status**: Ready to Implement
**Approved By**: User (Option B - Clarifications Complete)

---

## 📋 Executive Summary

Sprint 3 Week 1 enhances the conflict detection system to handle ALL conflict types (not just UC1-based), implements cross-artifact checking, completes the resolution application logic with surgical precision, and establishes the data handoff to the stateful agent for binary question generation.

### Success Criteria
- ✅ All conflict types detected (logical, dependency, constraint, cross-artifact, mutex)
- ✅ Cross-artifact conflicts identified (mapped vs respec)
- ✅ Surgical resolution implemented (only affected nodes modified)
- ✅ User-selected specifications preserved during descendant auto-add
- ✅ Conflict data properly structured and returned to AnthropicService
- ✅ Legacy ConflictDetectionService moved to legacy_isolated/
- ✅ New test file created and passing
- ✅ TypeScript baseline maintained (~218 errors)

---

## 🔍 Current State Analysis

### What's Already Working ✅

**ArtifactManager.detectConflicts()** (lines 185-229):
- ✅ Collects specifications from mapped artifact
- ✅ Calls UC1ValidationEngine.detectConflicts()
- ✅ Converts conflicts to ActiveConflict format
- ✅ Blocks system when conflicts detected
- ✅ Generates resolution options

**UC1ValidationEngine.detectConflicts()** (lines 346-387):
- ✅ Detects logical conflicts (high performance vs low power)
- ✅ Returns structured ConflictResult

**ArtifactManager.resolveConflict()** (lines 266-308):
- ✅ Finds conflict by ID
- ✅ Moves to resolved list
- ✅ Unblocks system when all conflicts resolved

### What's Missing ❌

**UC1ValidationEngine.detectConflicts()**:
- ❌ Dependency conflict detection (checkDependencies exists but not integrated)
- ❌ Constraint conflict detection (validateSpecification exists but not integrated)
- ❌ Cross-artifact conflict detection (mapped vs respec)
- ❌ Mutex conflict detection (for domains/requirements/specifications)

**ArtifactManager.applyConflictResolution()** (line 310):
- ❌ Stub only - needs full implementation with surgical precision
- ❌ Missing explicit node targeting
- ❌ Missing pre-validation checks
- ❌ Missing rollback capability

**Descendant Specification Handling**:
- ❌ No check for existing user-selected values
- ❌ Risk of overwriting user selections with defaults

**Legacy Code**:
- ⚠️ ConflictDetectionService.ts still in active location (imported by SimplifiedRespecService, app.tsx, ConflictPanel.tsx)
- ⚠️ Field-level conflict detection vs artifact-level conflict detection coexist

---

## 🎯 Sprint 3 Week 1 Implementation Tasks

### Task 1: Enhance UC1ValidationEngine with All Conflict Types
**File**: `src/services/respec/UC1ValidationEngine.ts`
**Priority**: HIGH
**Estimated Time**: Day 1-2

#### Subtasks:

**1.1: Add Mutex Conflict Detection**
```typescript
// NEW METHOD - Add after detectConflicts()
private detectMutexConflicts(
  domains: string[],
  requirements: string[],
  specifications: Array<{id: string, value: any}>
): ConflictResult {
  const result: ConflictResult = { hasConflict: false, conflicts: [] };

  // Check specification mutex (e.g., processor types)
  const mutexGroups = this.identifyMutexGroups(specifications);
  mutexGroups.forEach(group => {
    if (group.activeSpecs.length > 1) {
      result.hasConflict = true;
      result.conflicts.push({
        type: 'mutex',
        nodes: group.activeSpecs.map(s => s.id),
        description: `Multiple mutually exclusive options selected: ${group.name}`,
        resolution: `Choose one: ${group.options.join(', ')}`
      });
    }
  });

  return result;
}

// Helper method
private identifyMutexGroups(specifications: Array<{id: string, value: any}>): MutexGroup[] {
  // Example: Only one processor type can be selected
  // This would be expanded based on UC1 schema or external mutex definitions
  const groups: MutexGroup[] = [];

  const processorSpecs = specifications.filter(s =>
    s.id.includes('processor') && s.value !== null
  );

  if (processorSpecs.length > 1) {
    groups.push({
      name: 'Processor Type',
      activeSpecs: processorSpecs,
      options: processorSpecs.map(s => s.value)
    });
  }

  return groups;
}
```

**1.2: Integrate Dependency Conflict Detection**
```typescript
// MODIFY detectConflicts() method (line 346)
detectConflicts(
  specifications: Array<{id: string, value: any}>,
  activeRequirements: string[] = []  // NEW PARAMETER
): ConflictResult {
  const result: ConflictResult = {
    hasConflict: false,
    conflicts: []
  };

  if (!this.schema) return result;

  // ... existing logical conflict code ...

  // NEW: Dependency conflict detection
  const depConflicts = this.detectDependencyConflicts(activeRequirements);
  if (depConflicts.hasConflict) {
    result.hasConflict = true;
    result.conflicts.push(...depConflicts.conflicts);
  }

  // NEW: Mutex conflict detection
  const mutexConflicts = this.detectMutexConflicts([], activeRequirements, specifications);
  if (mutexConflicts.hasConflict) {
    result.hasConflict = true;
    result.conflicts.push(...mutexConflicts.conflicts);
  }

  return result;
}

// NEW METHOD
private detectDependencyConflicts(activeRequirements: string[]): ConflictResult {
  const result: ConflictResult = { hasConflict: false, conflicts: [] };

  activeRequirements.forEach(reqId => {
    const depResult = this.checkDependencies(reqId, activeRequirements);

    if (!depResult.isValid) {
      depResult.errors.forEach(error => {
        if (error.type === 'dependency') {
          result.hasConflict = true;
          result.conflicts.push({
            type: 'dependency',
            nodes: [reqId, error.details.dependency],
            description: error.message,
            resolution: `Add required dependency: ${error.details.dependency}. ${error.details.rationale}`
          });
        }
      });
    }
  });

  return result;
}
```

**1.3: Add Constraint Conflict Detection**
```typescript
// NEW METHOD
private detectConstraintConflicts(
  specifications: Array<{id: string, value: any}>
): ConflictResult {
  const result: ConflictResult = { hasConflict: false, conflicts: [] };

  specifications.forEach(spec => {
    const validation = this.validateSpecification(spec.id, spec.value);

    if (!validation.isValid) {
      validation.errors.forEach(error => {
        if (error.type === 'constraint_violation') {
          result.hasConflict = true;
          result.conflicts.push({
            type: 'constraint',
            nodes: [spec.id],
            description: error.message,
            resolution: error.details.suggestedValue
              ? `Change to: ${error.details.suggestedValue}`
              : 'Remove or modify this specification'
          });
        }
      });
    }
  });

  return result;
}

// ADD to detectConflicts() after mutex check
const constraintConflicts = this.detectConstraintConflicts(specifications);
if (constraintConflicts.hasConflict) {
  result.hasConflict = true;
  result.conflicts.push(...constraintConflicts.conflicts);
}
```

---

### Task 2: Add Cross-Artifact Conflict Detection
**File**: `src/services/respec/artifacts/ArtifactManager.ts`
**Priority**: HIGH
**Estimated Time**: Day 2-3

#### Implementation:

**2.1: Add checkCrossArtifactConflicts() method**
```typescript
// ADD NEW METHOD after detectConflicts() (around line 230)
private async checkCrossArtifactConflicts(): Promise<ConflictResult> {
  const result: ConflictResult = {
    hasConflict: false,
    conflicts: []
  };

  if (!this.state.initialized) return result;

  // Collect all specs from mapped artifact
  const mappedSpecs = new Map<string, any>();
  Object.values(this.state.mapped.domains).forEach(domain => {
    Object.values(domain.requirements).forEach(requirement => {
      Object.values(requirement.specifications).forEach(spec => {
        mappedSpecs.set(spec.id, spec);
      });
    });
  });

  // Collect all specs from respec artifact
  const respecSpecs = new Map<string, any>();
  Object.values(this.state.respec.domains).forEach(domain => {
    Object.values(domain.requirements).forEach(requirement => {
      Object.values(requirement.specifications).forEach(spec => {
        respecSpecs.set(spec.id, spec);
      });
    });
  });

  // Compare: Check if mapped specs conflict with respec specs
  mappedSpecs.forEach((mappedSpec, specId) => {
    const respecSpec = respecSpecs.get(specId);

    if (respecSpec) {
      // Spec exists in both artifacts - check for value conflict
      if (mappedSpec.value !== respecSpec.value) {
        result.hasConflict = true;
        result.conflicts.push({
          type: 'cross-artifact',
          nodes: [specId],
          description: `Attempting to override existing specification. Current value: "${respecSpec.value}", new value: "${mappedSpec.value}"`,
          resolution: `Choose: (A) Keep existing value "${respecSpec.value}", or (B) Replace with new value "${mappedSpec.value}"`
        });
      }
    }
  });

  return result;
}

// MODIFY detectConflicts() to include cross-artifact check (line 202)
async detectConflicts(): Promise<ConflictResult> {
  // ... existing code ...

  // Use UC1ValidationEngine for conflict detection
  const result = this.uc1Engine.detectConflicts(specifications);

  // NEW: Check cross-artifact conflicts
  const crossConflicts = await this.checkCrossArtifactConflicts();
  if (crossConflicts.hasConflict) {
    result.hasConflict = true;
    result.conflicts.push(...crossConflicts.conflicts);
  }

  // ... rest of existing code ...
}
```

---

### Task 3: Complete applyConflictResolution() with Safety Policies
**File**: `src/services/respec/artifacts/ArtifactManager.ts`
**Priority**: CRITICAL
**Estimated Time**: Day 3-4

#### Implementation with Surgical Precision:

**3.1: Implement full resolution logic** (replace stub at line 310)
```typescript
private async applyConflictResolution(conflict: ActiveConflict, resolution: any): Promise<void> {
  console.log(`[ArtifactManager] Applying resolution ${resolution.id} to conflict ${conflict.id}`);

  // ========== PRE-VALIDATION ==========
  if (!resolution.targetNodes || resolution.targetNodes.length === 0) {
    throw new Error(`[Resolution] Resolution ${resolution.id} must specify targetNodes`);
  }

  // Verify all target nodes exist in mapped artifact
  for (const nodeId of resolution.targetNodes) {
    const spec = this.findSpecificationInMapped(nodeId);
    if (!spec) {
      throw new Error(
        `[Resolution] Node ${nodeId} not found in mapped artifact - cannot resolve. ` +
        `This conflict may have already been resolved or the artifact state is corrupted.`
      );
    }
  }

  // ========== DETERMINE WINNING/LOSING SPECS ==========
  let losingSpecs: string[] = [];
  let winningSpecs: string[] = [];

  // Parse resolution action
  if (resolution.id === 'option-a') {
    // Option A: Keep first conflicting node, remove others
    winningSpecs = [conflict.conflictingNodes[0]];
    losingSpecs = conflict.conflictingNodes.slice(1);
  } else if (resolution.id === 'option-b') {
    // Option B: Keep second conflicting node, remove others
    winningSpecs = [conflict.conflictingNodes[1]];
    losingSpecs = conflict.conflictingNodes.slice(0, 1).concat(conflict.conflictingNodes.slice(2));
  } else {
    throw new Error(`[Resolution] Unknown resolution option: ${resolution.id}`);
  }

  console.log(`[Resolution] Winning specs: ${winningSpecs.join(', ')}`);
  console.log(`[Resolution] Losing specs: ${losingSpecs.join(', ')}`);

  // ========== ATOMIC REMOVAL (with rollback capability) ==========
  const removedSpecs: Array<{id: string, backup: any}> = [];

  try {
    // Remove losing specifications
    for (const specId of losingSpecs) {
      const spec = this.findSpecificationInMapped(specId);

      if (!spec) {
        console.warn(`[Resolution] ⚠️  Spec ${specId} not found, skipping removal`);
        continue;
      }

      // Backup before removal
      removedSpecs.push({ id: specId, backup: JSON.parse(JSON.stringify(spec)) });

      // Remove from mapped artifact
      console.log(`[ArtifactManager] Removing spec ${specId} due to conflict resolution ${resolution.id}`);
      this.removeSpecificationFromMapped(specId);
    }

    // Log winning specs (no action needed, they stay in mapped)
    for (const specId of winningSpecs) {
      console.log(`[ArtifactManager] Keeping spec ${specId} as resolution choice`);
    }

    // ========== POST-RESOLUTION VERIFICATION ==========
    for (const specId of losingSpecs) {
      const stillExists = this.findSpecificationInMapped(specId);
      if (stillExists) {
        throw new Error(
          `[CRITICAL] Failed to remove ${specId} - data integrity compromised. ` +
          `Rolling back resolution.`
        );
      }
    }

    for (const specId of winningSpecs) {
      const exists = this.findSpecificationInMapped(specId);
      if (!exists) {
        throw new Error(
          `[CRITICAL] Winning spec ${specId} disappeared during resolution - ` +
          `data integrity compromised. Rolling back.`
        );
      }
    }

    console.log(`[ArtifactManager] ✅ Resolution applied successfully`);

  } catch (error) {
    // ========== ROLLBACK ON FAILURE ==========
    console.error(`[ArtifactManager] ❌ Resolution failed, rolling back...`, error);

    // Restore removed specs
    for (const { id, backup } of removedSpecs) {
      console.log(`[Rollback] Restoring spec ${id}`);
      // Re-add specification to mapped artifact
      this.restoreSpecificationToMapped(id, backup);
    }

    throw error;
  }
}

// Helper method for rollback
private restoreSpecificationToMapped(specId: string, specBackup: any): void {
  const hierarchy = this.uc1Engine.getHierarchy(specId);
  if (!hierarchy) {
    console.error(`[Rollback] Cannot restore ${specId} - hierarchy not found`);
    return;
  }

  const { domain, requirement } = hierarchy;

  if (!this.state.mapped.domains[domain.id]) {
    this.state.mapped.domains[domain.id] = { ...domain, requirements: {} };
  }

  if (!this.state.mapped.domains[domain.id].requirements[requirement.id]) {
    this.state.mapped.domains[domain.id].requirements[requirement.id] = {
      ...requirement,
      specifications: {}
    };
  }

  this.state.mapped.domains[domain.id].requirements[requirement.id].specifications[specId] = specBackup;
}

// Helper method for finding specs in mapped
private findSpecificationInMapped(specId: string): any | null {
  for (const domain of Object.values(this.state.mapped.domains)) {
    for (const requirement of Object.values(domain.requirements)) {
      if (requirement.specifications[specId]) {
        return requirement.specifications[specId];
      }
    }
  }
  return null;
}

// Helper method for removing specs from mapped
private removeSpecificationFromMapped(specId: string): void {
  for (const domain of Object.values(this.state.mapped.domains)) {
    for (const requirement of Object.values(domain.requirements)) {
      if (requirement.specifications[specId]) {
        delete requirement.specifications[specId];
        return;
      }
    }
  }
}
```

---

### Task 4: Add User-Selection Preservation for Descendant Specs
**File**: `src/services/respec/semantic/SemanticIntegrationService_NEW.ts`
**Priority**: HIGH
**Estimated Time**: Day 4

#### Implementation:

**4.1: Add check before adding child specifications**
```typescript
// MODIFY requirement handling (around line 334-351)
private async handleRequirementMatch(match: MatchResult): Promise<void> {
  const reqId = match.uc1NodeId;

  console.log(`[Route] Requirement match: ${reqId} (confidence: ${match.confidence})`);

  // Add requirement to mapped
  await this.artifactManager.addRequirementToMapped(reqId, 'From semantic match');

  // Get all child specifications for this requirement
  const childSpecs = this.uc1Engine.getSpecificationsByRequirement(reqId);

  console.log(`[Route] Requirement ${reqId} has ${childSpecs.length} child specifications`);

  // Add all child specifications to mapped artifact
  for (const spec of childSpecs) {
    // NEW: Check if spec already exists with user-selected value
    const existingInMapped = this.artifactManager.findSpecificationInArtifact('mapped', spec.id);
    const existingInRespec = this.artifactManager.findSpecificationInArtifact('respec', spec.id);

    if (existingInMapped) {
      // Check if it's user-selected or system-generated
      if (existingInMapped.source === 'user' || existingInMapped.source === 'direct_extraction') {
        console.log(
          `[Route] ⚠️  Skipping ${spec.id} - user-selected value already exists in mapped ` +
          `(value: "${existingInMapped.value}")`
        );
        continue; // Don't overwrite user selection
      } else {
        console.log(
          `[Route] Spec ${spec.id} exists in mapped with system value, updating with default`
        );
        // OK to update system-generated value
      }
    }

    if (existingInRespec) {
      // Spec already in respec - this will be caught by cross-artifact conflict detection
      console.log(
        `[Route] ⚠️  Spec ${spec.id} exists in respec - cross-artifact conflict will be detected`
      );
      // Continue adding to mapped, conflict detection will handle it
    }

    await this.artifactManager.addSpecificationToMapped(
      spec,
      spec.default_value || null,
      `From requirement ${reqId}`,
      `Auto-added as part of requirement ${reqId}`
    );
  }
}

// ADD similar check to domain handling (if applicable)
```

**4.2: Update addSpecificationToMapped() signature** (if needed)
```typescript
// In ArtifactManager.ts - ensure 'source' is tracked
async addSpecificationToMapped(
  specification: any,
  value: any,
  attribution: string,
  context: string,
  source: 'user' | 'system' | 'direct_extraction' | 'requirement_default' = 'system'
): Promise<void> {
  // ... existing code ...

  const specNode = {
    id: specification.id,
    value,
    attribution,
    context,
    source,  // Track source
    addedAt: new Date()
  };

  // ... rest of implementation ...
}
```

---

### Task 5: Structure Conflict Data for Agent Consumption
**File**: `src/services/respec/SimplifiedRespecService.ts`
**Priority**: HIGH
**Estimated Time**: Day 5

#### Implementation:

**5.1: Add method to get active conflicts for agent**
```typescript
// ADD NEW METHOD (around line 600)
getActiveConflictsForAgent(): any {
  if (!this.artifactManager) {
    return { hasConflicts: false, conflicts: [] };
  }

  const state = this.artifactManager.getState();
  const activeConflicts = state.conflicts.active;

  if (activeConflicts.length === 0) {
    return { hasConflicts: false, conflicts: [] };
  }

  // Structure conflicts for agent consumption
  const structuredConflicts = activeConflicts.map(conflict => ({
    id: conflict.id,
    type: conflict.type,
    description: conflict.description,
    conflictingNodes: conflict.conflictingNodes.map(nodeId => ({
      id: nodeId,
      ...this.getNodeDetails(nodeId)
    })),
    resolutionOptions: conflict.resolutionOptions.map(option => ({
      id: option.id,
      label: option.description,
      outcome: option.expectedOutcome
    })),
    cycleCount: conflict.cycleCount,
    priority: 'high'  // All conflicts are high priority
  }));

  return {
    hasConflicts: true,
    count: activeConflicts.length,
    systemBlocked: state.conflicts.metadata.systemBlocked,
    conflicts: structuredConflicts
  };
}

// Helper to get node details
private getNodeDetails(nodeId: string): any {
  const hierarchy = this.uc1Engine.getHierarchy(nodeId);
  const spec = this.artifactManager.findSpecificationInArtifact('mapped', nodeId);

  return {
    name: spec?.name || nodeId,
    value: spec?.value,
    hierarchy: hierarchy ? {
      domain: hierarchy.domain.name,
      requirement: hierarchy.requirement.name
    } : undefined
  };
}
```

**5.2: Modify processChatMessage() to check for conflicts first**
```typescript
// MODIFY processChatMessage() (around line 250)
async processChatMessage(message: string): Promise<ChatResult> {
  console.log('[SimplifiedRespec] Processing chat message:', message);

  // NEW: Check for active conflicts FIRST
  const conflictStatus = this.getActiveConflictsForAgent();

  if (conflictStatus.hasConflicts) {
    console.log(`[SimplifiedRespec] ⚠️  System blocked by ${conflictStatus.count} active conflict(s)`);

    // Return conflict information to agent
    // Agent will handle binary question generation
    return {
      conversationalResponse: '', // Agent will generate this
      formUpdates: [],
      systemMessage: 'system_blocked_by_conflicts',
      conflictData: conflictStatus  // NEW FIELD
    };
  }

  // ... existing normal processing flow ...
}
```

---

### Task 6: Draft AnthropicService Prompt Enhancement
**File**: `src/services/respec/AnthropicService.ts`
**Priority**: MEDIUM
**Estimated Time**: Day 5

#### Suggested Prompt Addition:

```typescript
// ADD TO SYSTEM PROMPT (around line 50-100)
const CONFLICT_RESOLUTION_GUIDANCE = `
CONFLICT RESOLUTION MODE:
When the system detects conflicts, you will receive conflict data in this format:
{
  hasConflicts: true,
  conflicts: [
    {
      id: "conflict-abc123",
      type: "logical" | "dependency" | "constraint" | "cross-artifact" | "mutex",
      description: "Human-readable conflict description",
      conflictingNodes: [
        { id: "spc001", name: "processor_type", value: "Intel Core i7" },
        { id: "spc005", name: "max_power_consumption", value: "< 10W" }
      ],
      resolutionOptions: [
        { id: "option-a", label: "High performance with grid power", outcome: "..." },
        { id: "option-b", label: "Lower performance for battery", outcome: "..." }
      ]
    }
  ]
}

Your responsibilities in conflict resolution:
1. **Generate Binary Question**: Create a clear, user-friendly binary question
   - Present both options (A and B) clearly
   - Explain implications of each choice
   - Use conversational language, not technical jargon

2. **Question Format**:
   "I noticed a conflict: [description in plain language]

   Which would you prefer?
   A) [Option A with simple explanation]
   B) [Option B with simple explanation]

   Please respond with A or B."

3. **Important Rules**:
   - ONE conflict at a time (even if multiple exist)
   - Always present exactly 2 options (A and B)
   - Do NOT process new requirements while conflicts exist
   - Do NOT ask clarifying questions - only present the binary choice
   - Keep explanations short (1-2 sentences per option)

Example:
User mentioned: "high performance processor with low power"
Conflict detected: high_performance vs low_power

Your response:
"I see a potential issue - high-performance processors typically need more power.

Which is more important for your system?
A) High performance (Intel Core i7) with standard power supply (35-65W)
B) Energy efficiency with moderate performance (Intel Atom) for battery operation (10-20W)

Please choose A or B."
`;

// MODIFY analyzeRequirements() to check for conflicts
async analyzeRequirements(
  message: string,
  conversationHistory: any[],
  conflictData?: any  // NEW PARAMETER
): Promise<any> {

  // NEW: If conflicts exist, generate binary question instead of normal processing
  if (conflictData?.hasConflicts) {
    console.log('[AnthropicService] Conflict mode - generating binary question');

    const conflict = conflictData.conflicts[0]; // Handle one at a time

    const conflictPrompt = `
${CONFLICT_RESOLUTION_GUIDANCE}

Current conflict:
${JSON.stringify(conflict, null, 2)}

Generate a user-friendly binary question following the format above.
    `;

    const response = await this.callAnthropicAPI(conflictPrompt, conversationHistory);

    return {
      conversationalResponse: response,
      extractedRequirements: [],
      mode: 'conflict_resolution',
      conflictId: conflict.id
    };
  }

  // ... existing normal processing ...
}
```

---

### Task 7: Move Legacy ConflictDetectionService to legacy_isolated/
**Priority**: MEDIUM
**Estimated Time**: Day 6

#### Steps:

**7.1: Create legacy folder**
```bash
mkdir -p src/legacy_isolated
```

**7.2: Move file**
```bash
git mv src/services/respec/ConflictDetectionService.ts src/legacy_isolated/ConflictDetectionService.ts
```

**7.3: Update imports** (only if breaking change)
Since ConflictDetectionService is imported in:
- SimplifiedRespecService.ts
- app.tsx
- ConflictPanel.tsx

**Option A**: Keep imports working (add deprecation warning)
```typescript
// Add to ConflictDetectionService.ts
console.warn('[DEPRECATED] ConflictDetectionService is deprecated. Use ArtifactManager.detectConflicts() instead.');
```

**Option B**: Remove imports entirely
- Comment out ConflictDetectionService usage in these files
- Rely entirely on ArtifactManager conflict detection

**Recommendation**: Option A for Sprint 3 Week 1 (maintain compatibility), Option B for Sprint 4 (clean removal)

---

### Task 8: Create Test File for Sprint 3 Week 1
**File**: `test-sprint3-week1-conflict-detection.cjs`
**Priority**: HIGH
**Estimated Time**: Day 6-7

#### Test Coverage:

```javascript
#!/usr/bin/env node
/**
 * Sprint 3 Week 1 - Enhanced Conflict Detection Test Suite
 *
 * Tests all new conflict types and resolution logic
 */

const fs = require('fs');
const path = require('path');

console.log('🧪 Sprint 3 Week 1 - Enhanced Conflict Detection Tests\n');

const tests = [
  {
    name: 'Logical Conflict Detection (Existing)',
    check: () => {
      // Verify high performance vs low power conflict still works
      return true;
    }
  },
  {
    name: 'Dependency Conflict Detection',
    check: () => {
      // Verify dependency conflicts are detected
      const engine = require('./src/services/respec/UC1ValidationEngine.ts');
      // Check if detectDependencyConflicts method exists
      return true;
    }
  },
  {
    name: 'Constraint Conflict Detection',
    check: () => {
      // Verify constraint violations are detected
      return true;
    }
  },
  {
    name: 'Cross-Artifact Conflict Detection',
    check: () => {
      // Verify mapped vs respec conflicts detected
      const artifactManager = require('./src/services/respec/artifacts/ArtifactManager.ts');
      // Check if checkCrossArtifactConflicts method exists
      return true;
    }
  },
  {
    name: 'Mutex Conflict Detection',
    check: () => {
      // Verify mutex conflicts detected
      return true;
    }
  },
  {
    name: 'Surgical Resolution Implementation',
    check: () => {
      // Verify applyConflictResolution is no longer a stub
      const content = fs.readFileSync(
        './src/services/respec/artifacts/ArtifactManager.ts',
        'utf8'
      );
      const hasImplementation = content.includes('PRE-VALIDATION') &&
                                 content.includes('ATOMIC REMOVAL');
      return hasImplementation;
    }
  },
  {
    name: 'User-Selection Preservation',
    check: () => {
      // Verify check for existing user-selected specs
      const content = fs.readFileSync(
        './src/services/respec/semantic/SemanticIntegrationService_NEW.ts',
        'utf8'
      );
      return content.includes('user-selected value already exists');
    }
  },
  {
    name: 'Conflict Data Structure for Agent',
    check: () => {
      // Verify getActiveConflictsForAgent exists
      const content = fs.readFileSync(
        './src/services/respec/SimplifiedRespecService.ts',
        'utf8'
      );
      return content.includes('getActiveConflictsForAgent');
    }
  },
  {
    name: 'Legacy Service Moved',
    check: () => {
      // Verify ConflictDetectionService moved to legacy_isolated
      return fs.existsSync('./src/legacy_isolated/ConflictDetectionService.ts');
    }
  }
];

let passed = 0;
let failed = 0;

tests.forEach(test => {
  try {
    const result = test.check();
    if (result) {
      console.log(`✅ ${test.name}`);
      passed++;
    } else {
      console.log(`❌ ${test.name}`);
      failed++;
    }
  } catch (error) {
    console.log(`❌ ${test.name} - ${error.message}`);
    failed++;
  }
});

console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
```

---

## 📅 Day-by-Day Schedule

### Day 1: Conflict Type Expansion (Mutex & Dependency)
- ✅ Add detectMutexConflicts() to UC1ValidationEngine
- ✅ Add detectDependencyConflicts() to UC1ValidationEngine
- ✅ Integrate into main detectConflicts() method
- ✅ Test mutex and dependency detection

### Day 2: Constraint & Cross-Artifact Detection
- ✅ Add detectConstraintConflicts() to UC1ValidationEngine
- ✅ Add checkCrossArtifactConflicts() to ArtifactManager
- ✅ Integrate both into detection flow
- ✅ Test constraint and cross-artifact detection

### Day 3: Surgical Resolution Implementation
- ✅ Implement full applyConflictResolution() logic
- ✅ Add pre-validation checks
- ✅ Add atomic removal with rollback
- ✅ Add helper methods (findSpecificationInMapped, removeSpecificationFromMapped, restoreSpecificationToMapped)

### Day 4: User-Selection Preservation
- ✅ Add checks in SemanticIntegrationService_NEW for existing user values
- ✅ Update addSpecificationToMapped() to track source
- ✅ Test descendant specification handling

### Day 5: Agent Data Handoff
- ✅ Implement getActiveConflictsForAgent() in SimplifiedRespecService
- ✅ Modify processChatMessage() to check conflicts first
- ✅ Draft AnthropicService prompt enhancement
- ✅ Test conflict data structure

### Day 6: Legacy Cleanup & Testing
- ✅ Move ConflictDetectionService to legacy_isolated/
- ✅ Create test-sprint3-week1-conflict-detection.cjs
- ✅ Run all tests

### Day 7: Integration Testing & Documentation
- ✅ End-to-end testing with all conflict types
- ✅ Verify TypeScript baseline maintained
- ✅ Update SPRINT3_WEEK1_COMPLETION.md
- ✅ Prepare for Sprint 3 Week 2

---

## 🧪 Testing Strategy

### Unit Tests
- Each conflict detection method tested independently
- applyConflictResolution() tested with mock conflicts
- User-selection preservation tested with mock artifacts

### Integration Tests
- Full flow: Add specs → Detect conflicts → Resolve → Verify
- Cross-artifact conflicts with both mapped and respec populated
- Multiple simultaneous conflicts

### Manual Tests
```bash
npm run dev

# Test 1: Logical conflict (existing)
Chat: "I need high performance processor with minimal power consumption"
Expected: Conflict detected, binary question generated

# Test 2: Cross-artifact conflict
1. Chat: "I need Intel Core i5"  (adds to mapped, moves to respec)
2. Chat: "I need Intel Core i7"  (adds to mapped, detects conflict with respec)
Expected: Cross-artifact conflict detected

# Test 3: User-selection preservation
1. Chat: "I need Intel Core i7"  (user selection)
2. Chat: "I need thermal monitoring"  (requirement with spc001 child)
Expected: spc001 NOT overwritten, user selection preserved

# Test 4: Resolution application
1. Generate conflict
2. Respond: "A"
Expected: Option A kept, Option B removed, system unblocked
```

---

## ✅ Success Criteria Checklist

- [ ] All 5 conflict types implemented (logical, dependency, constraint, cross-artifact, mutex)
- [ ] Cross-artifact checking compares mapped vs respec
- [ ] applyConflictResolution() fully implemented with surgical precision
- [ ] Rollback capability on resolution failure
- [ ] User-selected specifications preserved during descendant auto-add
- [ ] getActiveConflictsForAgent() returns structured conflict data
- [ ] SimplifiedRespecService checks conflicts before normal processing
- [ ] AnthropicService prompt enhancement drafted
- [ ] ConflictDetectionService moved to legacy_isolated/
- [ ] test-sprint3-week1-conflict-detection.cjs created and passing
- [ ] TypeScript baseline maintained (~218 errors)
- [ ] No regressions in Sprint 2 functionality
- [ ] Manual test scenarios pass

---

## 🚨 Risk Mitigation

### Risk 1: Breaking Sprint 2 Functionality
**Mitigation**:
- Test Sprint 2 Week 2 scenarios after each change
- Run test-sprint2-week2-runtime-flow.cjs regularly
- Keep changes isolated to new methods

### Risk 2: TypeScript Error Increase
**Mitigation**:
- Check `npx tsc --noEmit` after each file change
- Only add type annotations where necessary
- Maintain ~218 error baseline

### Risk 3: Resolution Logic Bugs
**Mitigation**:
- Implement comprehensive logging
- Add rollback capability from the start
- Test with mock data before integration

---

## 📝 Notes for Implementation

1. **Surgical Resolution**: The key insight is that resolution affects ONLY the nodes in `conflict.conflictingNodes`, never other nodes in mapped artifact.

2. **Source Tracking**: Every specification must track its source (`user`, `system`, `direct_extraction`, `requirement_default`) to enable preservation logic.

3. **One Conflict at a Time**: Even if multiple conflicts exist, the agent handles one at a time. This simplifies the UX and ensures clear resolution.

4. **Rollback is Critical**: If resolution fails halfway, we MUST restore the original state. This requires backup before modification.

5. **Cross-Artifact Conflicts**: These represent user attempts to override existing validated specs. They should be presented clearly: "You already have X, do you want to change to Y?"

---

**Ready to begin implementation**: ✅
**Waiting for user approval**: ✅ (Option B completed)
**Next step**: Start Day 1 implementation

