# Sprint 3 Week 2 - Agent-Driven Conflict Resolution Implementation Plan

**Date**: October 3, 2025
**Sprint**: 3, Week 2 (Days 8-14)
**Status**: Ready to Implement
**Depends On**: Sprint 3 Week 1 ✅ Complete

---

## 📋 Executive Summary

Sprint 3 Week 2 completes the conflict resolution system by implementing agent-driven response parsing and resolution orchestration. The agent interprets user responses (A/B), calls resolution methods, manages retry cycles, and handles multiple conflicts through a priority queue.

### Success Criteria
- ✅ Agent semantically parses user A/B responses
- ✅ Agent calls `artifactManager.resolveConflict()` with correct parameters
- ✅ Cycle management (max 3 attempts per conflict)
- ✅ Auto-escalation after 3 failed cycles
- ✅ Priority queue handles multiple conflicts (one at a time)
- ✅ Confirmation messages after successful resolution
- ✅ System unblocks after all conflicts resolved
- ✅ End-to-end flow tested and working

---

## 🔍 Current State (After Week 1)

### What's Already Working ✅

**From Sprint 3 Week 1**:
- All conflict types detected (logical, mutex, dependency, constraint, cross-artifact)
- `getActiveConflictsForAgent()` returns structured conflict data
- System blocks when conflicts exist
- `applyConflictResolution()` fully implemented with surgical precision
- Conflict data passed to agent via `conflictData` field

**Agent Receives**:
```json
{
  "hasConflicts": true,
  "count": 2,
  "systemBlocked": true,
  "conflicts": [
    {
      "id": "conflict-abc123",
      "type": "logical",
      "description": "High-performance processor incompatible with low power",
      "conflictingNodes": [...],
      "resolutionOptions": [
        {"id": "option-a", "label": "...", "outcome": "..."},
        {"id": "option-b", "label": "...", "outcome": "..."}
      ],
      "cycleCount": 0,
      "priority": "high"
    }
  ]
}
```

### What's Missing ❌

1. **Agent Response Parsing**: No semantic interpretation of user A/B responses
2. **Resolution Orchestration**: Agent doesn't call `resolveConflict()`
3. **Cycle Management**: No tracking of resolution attempts
4. **Auto-Escalation**: No action after 3 failed cycles
5. **Priority Queue**: Multiple conflicts not handled sequentially
6. **Confirmation Flow**: No user feedback after resolution

---

## 🎯 Sprint 3 Week 2 Implementation Tasks

### Task 1: Design Agent Response Parsing System
**Priority**: HIGH
**Estimated Time**: Day 8

#### Design Decisions

**What Qualifies as a Valid Response?**
- "A" or "a"
- "B" or "b"
- "Option A" or "option a"
- "Option B" or "option b"
- "First one" (maps to A)
- "Second one" (maps to B)
- "I prefer A"
- "Let's go with option B"

**Semantic Parsing Approach**:
```typescript
interface ParsedResponse {
  isResolution: boolean;      // Is this a conflict resolution response?
  choice: 'a' | 'b' | null;   // Parsed choice
  confidence: number;          // How confident is the parse (0-1)
  rawResponse: string;         // Original user message
}
```

**Implementation in AnthropicService**:
```typescript
/**
 * Parse user response for conflict resolution
 * Sprint 3 Week 2: Semantic interpretation of A/B choices
 */
async parseConflictResponse(
  userMessage: string,
  activeConflict: any
): Promise<ParsedResponse> {
  const prompt = `
You are parsing a user response to a binary choice question.

The user was asked to choose between Option A or Option B.

User's response: "${userMessage}"

Determine:
1. Is this a response to the binary choice? (yes/no)
2. Which option did they choose? (A, B, or unclear)
3. How confident are you? (0.0 to 1.0)

Respond in JSON:
{
  "isResolution": true/false,
  "choice": "a" | "b" | null,
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation"
}

Examples:
- "A" → {"isResolution": true, "choice": "a", "confidence": 1.0}
- "I'll go with the first one" → {"isResolution": true, "choice": "a", "confidence": 0.9}
- "Tell me more about option B" → {"isResolution": false, "choice": null, "confidence": 0.0}
- "What's the difference?" → {"isResolution": false, "choice": null, "confidence": 0.0}
`;

  const response = await this.callAnthropicAPI(prompt, []);
  return JSON.parse(response);
}
```

---

### Task 2: Implement Resolution Orchestration in AnthropicService
**Priority**: HIGH
**Estimated Time**: Day 9-10

#### Implementation

**File**: `src/services/respec/AnthropicService.ts`

**New Method**:
```typescript
/**
 * Orchestrate conflict resolution
 * Sprint 3 Week 2: Complete resolution flow
 */
async handleConflictResolution(
  userMessage: string,
  conflictData: any,
  artifactManager: ArtifactManager
): Promise<any> {
  console.log('[AnthropicService] Handling conflict resolution');

  // Get the active conflict (one at a time)
  const conflict = conflictData.conflicts[0];

  // Step 1: Parse user response
  const parsed = await this.parseConflictResponse(userMessage, conflict);

  // Step 2: Handle non-resolution responses
  if (!parsed.isResolution) {
    // User is asking a question or needs clarification
    return this.generateClarification(userMessage, conflict);
  }

  // Step 3: Handle low-confidence responses
  if (parsed.confidence < 0.7) {
    return {
      response: `I'm not sure which option you're choosing. Please respond with either "A" or "B".`,
      mode: 'clarification_needed',
      conflictId: conflict.id
    };
  }

  // Step 4: Validate choice
  if (!parsed.choice || !['a', 'b'].includes(parsed.choice)) {
    return {
      response: `Please choose either Option A or Option B.`,
      mode: 'invalid_choice',
      conflictId: conflict.id
    };
  }

  // Step 5: Map choice to resolution option
  const resolutionId = parsed.choice === 'a' ? 'option-a' : 'option-b';
  const selectedOption = conflict.resolutionOptions.find(opt => opt.id === resolutionId);

  // Step 6: Call ArtifactManager to apply resolution
  try {
    await artifactManager.resolveConflict(conflict.id, resolutionId);

    // Step 7: Generate confirmation message
    const confirmation = `
Got it! I've updated your configuration with ${selectedOption.label}.

${selectedOption.outcome}

Your system is now conflict-free. What else would you like to configure?
    `.trim();

    return {
      response: confirmation,
      mode: 'resolution_success',
      conflictId: conflict.id,
      chosenOption: selectedOption
    };

  } catch (error) {
    console.error('[AnthropicService] Resolution failed:', error);

    // Step 8: Handle resolution failure
    return {
      response: `I encountered an issue applying that choice. Let me try presenting the options again.`,
      mode: 'resolution_failed',
      conflictId: conflict.id,
      error: error.message
    };
  }
}

/**
 * Generate clarification for user questions during conflict resolution
 */
private async generateClarification(userMessage: string, conflict: any): Promise<any> {
  const prompt = `
The user is in a conflict resolution flow. They were asked to choose between:

Option A: ${conflict.resolutionOptions[0].label}
Option B: ${conflict.resolutionOptions[1].label}

Instead of choosing, they asked: "${userMessage}"

Provide a helpful clarification that:
1. Answers their question
2. Reminds them of the two options
3. Asks them to choose A or B

Keep it brief and friendly.
  `;

  const response = await this.callAnthropicAPI(prompt, []);

  return {
    response,
    mode: 'clarification_provided',
    conflictId: conflict.id
  };
}
```

---

### Task 3: Wire Resolution Orchestration to SimplifiedRespecService
**Priority**: HIGH
**Estimated Time**: Day 10

#### Implementation

**File**: `src/services/respec/SimplifiedRespecService.ts`

**Modify processChatMessage()**:
```typescript
async processChatMessage(message: string, currentRequirements?: any): Promise<ChatResult> {
  if (!this.isInitialized) {
    await this.initialize();
  }

  console.log(`[SimplifiedRespec] Processing: "${message}"`);

  // Sprint 3 Week 1: Check for active conflicts FIRST
  const conflictStatus = this.getActiveConflictsForAgent();

  if (conflictStatus.hasConflicts) {
    console.log(`[SimplifiedRespec] ⚠️  System blocked by ${conflictStatus.count} active conflict(s)`);

    // Sprint 3 Week 2: Handle conflict resolution response
    const resolutionResult = await this.anthropicService.handleConflictResolution(
      message,
      conflictStatus,
      this.artifactManager!
    );

    // Add resolution result to conversation history
    this.conversationHistory.push({
      role: 'user',
      content: message,
      timestamp: new Date()
    });

    this.conversationHistory.push({
      role: 'assistant',
      content: resolutionResult.response,
      timestamp: new Date()
    });

    // Save session
    this.saveSession();

    return {
      success: true,
      systemMessage: resolutionResult.response,
      formUpdates: [],
      confidence: 1.0,
      mode: resolutionResult.mode,
      conflictData: resolutionResult.mode === 'resolution_success' ? null : conflictStatus
    };
  }

  // ... existing normal processing flow ...
}
```

---

### Task 4: Implement Cycle Management
**Priority**: MEDIUM
**Estimated Time**: Day 11

#### Design

**Cycle Management Rules**:
1. Each conflict tracks `cycleCount` (starts at 0)
2. Increment `cycleCount` when:
   - User provides invalid response
   - User provides low-confidence response
   - Resolution fails technically
3. After 3 cycles, escalate conflict
4. Escalation options:
   - Move to `escalated` list
   - Auto-resolve with default choice
   - Skip and continue with other conflicts

#### Implementation

**File**: `src/services/respec/artifacts/ArtifactManager.ts`

**Add Method**:
```typescript
/**
 * Increment conflict cycle count
 * Sprint 3 Week 2: Track resolution attempts
 */
incrementConflictCycle(conflictId: string): void {
  const conflictIndex = this.state.conflicts.active.findIndex(c => c.id === conflictId);
  if (conflictIndex === -1) {
    console.warn(`[ArtifactManager] Conflict ${conflictId} not found for cycle increment`);
    return;
  }

  const conflict = this.state.conflicts.active[conflictIndex];
  conflict.cycleCount++;
  conflict.lastUpdated = new Date();

  console.log(`[ArtifactManager] Conflict ${conflictId} cycle count: ${conflict.cycleCount}`);

  // Check for escalation threshold
  if (conflict.cycleCount >= 3) {
    console.warn(`[ArtifactManager] ⚠️  Conflict ${conflictId} reached max cycles (3) - escalating`);
    this.escalateConflict(conflictId);
  }
}

/**
 * Escalate conflict after max cycles
 * Sprint 3 Week 2: Auto-resolution or skip
 */
private escalateConflict(conflictId: string): void {
  const conflictIndex = this.state.conflicts.active.findIndex(c => c.id === conflictId);
  if (conflictIndex === -1) return;

  const conflict = this.state.conflicts.active[conflictIndex];

  // Move to escalated list
  const escalatedConflict = {
    ...conflict,
    escalatedAt: new Date(),
    escalationReason: 'Max resolution cycles reached (3)'
  };

  this.state.conflicts.escalated.push(escalatedConflict);
  this.state.conflicts.active.splice(conflictIndex, 1);
  this.state.conflicts.metadata.activeCount--;
  this.state.conflicts.metadata.escalatedCount++;

  console.log(`[ArtifactManager] Conflict ${conflictId} escalated to manual review`);

  // Unblock system if no more active conflicts
  if (this.state.conflicts.active.length === 0) {
    this.state.priorityQueue.blocked = false;
    this.state.priorityQueue.blockReason = undefined;
    this.state.conflicts.metadata.systemBlocked = false;
    this.state.conflicts.metadata.blockingConflicts = [];

    console.log(`[ArtifactManager] ✅ All active conflicts resolved or escalated - system unblocked`);
  }
}
```

**Modify handleConflictResolution()**:
```typescript
// In AnthropicService.handleConflictResolution()

// Step 3: Handle low-confidence responses
if (parsed.confidence < 0.7) {
  // Increment cycle count
  artifactManager.incrementConflictCycle(conflict.id);

  return {
    response: `I'm not sure which option you're choosing. Please respond with either "A" or "B".`,
    mode: 'clarification_needed',
    conflictId: conflict.id,
    cycleCount: conflict.cycleCount + 1
  };
}

// Step 4: Validate choice
if (!parsed.choice || !['a', 'b'].includes(parsed.choice)) {
  // Increment cycle count
  artifactManager.incrementConflictCycle(conflict.id);

  return {
    response: `Please choose either Option A or Option B.`,
    mode: 'invalid_choice',
    conflictId: conflict.id,
    cycleCount: conflict.cycleCount + 1
  };
}
```

---

### Task 5: Implement Priority Queue for Multiple Conflicts
**Priority**: MEDIUM
**Estimated Time**: Day 12

#### Design

**Priority Queue Rules**:
1. Present conflicts one at a time (user should never see multiple conflicts simultaneously)
2. Priority order:
   - `cross-artifact` (highest - user is changing existing choices)
   - `logical` (high - fundamental incompatibilities)
   - `constraint` (medium - schema violations)
   - `dependency` (medium - missing requirements)
   - `mutex` (low - multiple selections)
3. After resolving one conflict, immediately check for next
4. System stays blocked until ALL conflicts resolved or escalated

#### Implementation

**File**: `src/services/respec/SimplifiedRespecService.ts`

**Enhance getActiveConflictsForAgent()**:
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

  // Sprint 3 Week 2: Sort by priority
  const priorityOrder = {
    'cross-artifact': 1,
    'logical': 2,
    'constraint': 3,
    'dependency': 3,
    'mutex': 4
  };

  activeConflicts = activeConflicts.sort((a, b) => {
    const priorityA = priorityOrder[a.type] || 99;
    const priorityB = priorityOrder[b.type] || 99;
    return priorityA - priorityB;
  });

  // Sprint 3 Week 2: Only return the FIRST (highest priority) conflict
  const topConflict = activeConflicts[0];

  // Structure conflict for agent consumption
  const structuredConflict = {
    id: topConflict.id,
    type: topConflict.type,
    description: topConflict.description,
    conflictingNodes: topConflict.conflictingNodes.map(nodeId => ({
      id: nodeId,
      ...this.getNodeDetails(nodeId)
    })),
    resolutionOptions: topConflict.resolutionOptions.map(option => ({
      id: option.id,
      label: option.description,
      outcome: option.expectedOutcome
    })),
    cycleCount: topConflict.cycleCount,
    priority: topConflict.type === 'cross-artifact' ? 'critical' : 'high'
  };

  return {
    hasConflicts: true,
    count: activeConflicts.length,  // Total count for transparency
    currentConflict: 1,              // Currently handling first one
    totalConflicts: activeConflicts.length,
    systemBlocked: state.conflicts.metadata.systemBlocked,
    conflicts: [structuredConflict]  // Only ONE conflict at a time
  };
}
```

---

### Task 6: Add Confirmation Messages and UX Polish
**Priority**: LOW
**Estimated Time**: Day 13

#### Implementation

**Confirmation Message Templates**:
```typescript
// In AnthropicService.handleConflictResolution()

const confirmationTemplates = {
  'cross-artifact': (option) => `
Perfect! I've updated ${option.field} to "${option.value}".

This replaces your previous selection. Your configuration is now consistent.

${conflictData.totalConflicts > 1 ? `\n(${conflictData.totalConflicts - 1} more conflict(s) to resolve)` : 'What else would you like to configure?'}
  `.trim(),

  'logical': (option) => `
Got it! I've configured your system for ${option.label.toLowerCase()}.

${option.outcome}

${conflictData.totalConflicts > 1 ? `\n(${conflictData.totalConflicts - 1} more conflict(s) to resolve)` : 'What else would you like to configure?'}
  `.trim(),

  'mutex': (option) => `
Understood! I've selected ${option.value} as your ${option.field}.

${conflictData.totalConflicts > 1 ? `\n(${conflictData.totalConflicts - 1} more conflict(s) to resolve)` : 'What else would you like to configure?'}
  `.trim(),

  'default': (option) => `
Great! I've applied your choice: ${option.label}

${conflictData.totalConflicts > 1 ? `\n(${conflictData.totalConflicts - 1} more conflict(s) to resolve)` : 'What else would you like to configure?'}
  `.trim()
};

// Use template based on conflict type
const template = confirmationTemplates[conflict.type] || confirmationTemplates.default;
const confirmation = template(selectedOption);
```

**Progress Indicators**:
```typescript
// In binary question generation
if (conflictData.totalConflicts > 1) {
  question += `\n\n📊 Resolving conflict 1 of ${conflictData.totalConflicts}`;
}
```

---

### Task 7: End-to-End Testing
**Priority**: HIGH
**Estimated Time**: Day 14

#### Test Scenarios

**Scenario 1: Single Conflict - Happy Path**
```
User: "I need high performance processor with minimal power"
Agent: [Generates binary question with A/B options]
User: "A"
Agent: "Got it! I've configured for high performance..."
System: ✅ Conflict resolved, system unblocked
```

**Scenario 2: Single Conflict - Clarification Needed**
```
User: "I need high performance processor with minimal power"
Agent: [Binary question]
User: "What's the difference?"
Agent: [Explains difference, re-presents A/B]
User: "Option B"
Agent: "Understood! I've configured for low power..."
System: ✅ Resolved (cycle count = 1)
```

**Scenario 3: Multiple Conflicts - Sequential Resolution**
```
User: [Input causes 2 conflicts]
Agent: [Presents conflict 1 of 2]
User: "A"
Agent: "Great! Resolved. Now, conflict 2 of 2..."
User: "B"
Agent: "Perfect! All conflicts resolved."
System: ✅ Both resolved, system unblocked
```

**Scenario 4: Max Cycles - Escalation**
```
User: [Input causes conflict]
Agent: [Binary question]
User: "Maybe" (invalid)
Agent: "Please choose A or B"
User: "I don't know" (invalid)
Agent: "Please choose A or B"
User: "Hmm" (invalid)
System: ⚠️ Max cycles reached, conflict escalated
Agent: "I've set this aside for manual review. Let's continue..."
System: ✅ Unblocked (conflict escalated)
```

**Scenario 5: Cross-Artifact Conflict**
```
User: "I need 512GB storage" [moves to respec]
User: "Actually, make it 1TB"
Agent: "You previously selected 512GB. Would you like to change it?
       A) Keep 512GB
       B) Change to 1TB"
User: "B"
Agent: "Updated to 1TB!"
System: ✅ Respec value updated
```

---

## 📅 Day-by-Day Schedule

### Day 8: Response Parsing Design & Implementation
- ✅ Design ParsedResponse interface
- ✅ Implement `parseConflictResponse()` in AnthropicService
- ✅ Test parsing with various user inputs
- ✅ Handle edge cases (typos, variations)

### Day 9-10: Resolution Orchestration
- ✅ Implement `handleConflictResolution()` in AnthropicService
- ✅ Implement `generateClarification()` for user questions
- ✅ Wire to SimplifiedRespecService.processChatMessage()
- ✅ Test basic resolution flow

### Day 11: Cycle Management
- ✅ Implement `incrementConflictCycle()` in ArtifactManager
- ✅ Implement `escalateConflict()` for max cycles
- ✅ Add cycle tracking to resolution flow
- ✅ Test escalation behavior

### Day 12: Priority Queue
- ✅ Enhance `getActiveConflictsForAgent()` with sorting
- ✅ Implement one-at-a-time presentation
- ✅ Test multiple conflict handling
- ✅ Verify sequential resolution

### Day 13: UX Polish
- ✅ Add confirmation message templates
- ✅ Add progress indicators (X of Y)
- ✅ Improve error messages
- ✅ Test user experience flow

### Day 14: End-to-End Testing
- ✅ Run all 5 test scenarios
- ✅ Verify Sprint 2 functionality preserved
- ✅ Check TypeScript baseline maintained
- ✅ Create completion report

---

## 🧪 Testing Strategy

### Automated Tests
Create `test-sprint3-week2-resolution-flow.cjs`:
- Parse response variations (A, a, Option A, first one, etc.)
- Resolution success path
- Clarification flow
- Cycle increment logic
- Escalation after 3 cycles
- Priority queue sorting
- Multiple conflict sequential handling

### Manual Tests
```bash
npm run dev

# Test 1: Basic resolution
Chat: "high performance with low power"
Wait for binary question
Chat: "A"
Expected: Confirmation message, system unblocked

# Test 2: Clarification
Chat: [trigger conflict]
Wait for binary question
Chat: "What does option A mean?"
Expected: Clarification provided, still in resolution mode
Chat: "A"
Expected: Resolution confirmed

# Test 3: Multiple conflicts
[Trigger 2 conflicts]
Expected: See "Conflict 1 of 2"
Resolve first
Expected: See "Conflict 2 of 2"
Resolve second
Expected: "All conflicts resolved!"
```

---

## ✅ Success Criteria Checklist

- [ ] Agent parses "A", "B", "option a", "first one", etc.
- [ ] Agent confidence threshold working (< 0.7 asks for clarification)
- [ ] Agent calls `artifactManager.resolveConflict()` successfully
- [ ] Resolution success generates confirmation message
- [ ] Cycle count increments on invalid/unclear responses
- [ ] Conflict escalates after 3 cycles
- [ ] System unblocks after escalation
- [ ] Priority queue sorts conflicts correctly
- [ ] Only one conflict presented at a time
- [ ] Progress indicators show "X of Y"
- [ ] All 5 test scenarios pass
- [ ] TypeScript baseline maintained (~218 errors)
- [ ] Sprint 2 functionality preserved

---

## 🚨 Risk Mitigation

### Risk 1: Agent Misinterprets User Response
**Mitigation**:
- Use confidence threshold (0.7)
- Ask for clarification when uncertain
- Allow cycle management for retries

### Risk 2: Infinite Loop in Conflict Resolution
**Mitigation**:
- Max 3 cycles per conflict
- Auto-escalation prevents infinite loops
- System unblocks after escalation

### Risk 3: Breaking Sprint 2 Functionality
**Mitigation**:
- Test Sprint 2 scenarios after each change
- Run `test-sprint2-week2-runtime-flow.cjs` regularly
- Only modify conflict-related code paths

---

## 📝 Notes for Implementation

1. **Agent Prompts**: The user will customize AnthropicService prompts based on Week 1 documentation
2. **One Conflict at a Time**: Critical for UX - never overwhelm user with multiple conflicts
3. **Graceful Degradation**: If resolution fails, escalate rather than crash
4. **Audit Trail**: Log every resolution attempt for debugging
5. **User Agency**: User can ask questions during resolution - don't force immediate choice

---

**Ready to begin implementation**: ✅
**Next step**: Start Day 8 - Response Parsing Design & Implementation

