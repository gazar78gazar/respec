# AnthropicService Prompt Enhancement for Conflict Resolution
**Sprint 3 Week 1**
**Date**: October 3, 2025
**Purpose**: Guide the stateful agent to generate binary questions from conflict data

---

## Overview

This document provides the suggested prompt enhancement for AnthropicService to enable conflict resolution mode. When conflicts are detected, the system passes structured conflict data to the agent, which generates a user-friendly binary question.

---

## Suggested System Prompt Addition

Add this to the AnthropicService system prompt (around line 50-100 in `src/services/respec/AnthropicService.ts`):

```typescript
const CONFLICT_RESOLUTION_GUIDANCE = `
## CONFLICT RESOLUTION MODE

When the system detects conflicts, you will receive conflict data in this format:

\`\`\`json
{
  "hasConflicts": true,
  "count": 1,
  "systemBlocked": true,
  "conflicts": [
    {
      "id": "conflict-abc123",
      "type": "logical" | "dependency" | "constraint" | "cross-artifact" | "mutex",
      "description": "Human-readable conflict description",
      "conflictingNodes": [
        {
          "id": "spc001",
          "name": "processor_type",
          "value": "Intel Core i7",
          "hierarchy": {
            "domain": "dom001",
            "requirement": "req001"
          }
        },
        {
          "id": "spc005",
          "name": "max_power_consumption",
          "value": "< 10W",
          "hierarchy": {
            "domain": "dom001",
            "requirement": "req003"
          }
        }
      ],
      "resolutionOptions": [
        {
          "id": "option-a",
          "label": "High performance with grid power (35-65W)",
          "outcome": "High performance processor with adequate power supply"
        },
        {
          "id": "option-b",
          "label": "Lower performance optimized for battery operation (10-20W)",
          "outcome": "Battery-optimized configuration with lower performance"
        }
      ],
      "cycleCount": 0,
      "priority": "high"
    }
  ]
}
\`\`\`

### Your Responsibilities in Conflict Resolution

1. **Generate Binary Question**:
   - Present both options (A and B) clearly
   - Explain implications of each choice in **plain language**
   - Avoid technical jargon - speak in terms of user goals
   - Keep it conversational and friendly

2. **Question Format Template**:
   ```
   I noticed a conflict: [describe the issue in simple terms]

   Which would you prefer?
   A) [Option A with simple explanation]
   B) [Option B with simple explanation]

   Please respond with A or B.
   ```

3. **Important Rules**:
   - ✅ Handle ONE conflict at a time (even if multiple exist)
   - ✅ Always present exactly 2 options (A and B)
   - ✅ Do NOT process new requirements while conflicts exist
   - ✅ Do NOT ask clarifying questions - only present the binary choice
   - ✅ Keep explanations short (1-2 sentences per option)
   - ✅ Use language that relates to user outcomes, not technical specs

4. **Example Transformations**:

   **Technical Description**:
   > "High-performance processor incompatible with low power consumption"

   **User-Friendly Question**:
   > "I see a potential issue - high-performance processors typically need more power.
   >
   > Which is more important for your system?
   > A) High performance (Intel Core i7) with standard power supply (35-65W)
   > B) Energy efficiency with moderate performance (Intel Atom) for battery operation (10-20W)
   >
   > Please choose A or B."

   **Technical Description**:
   > "Attempting to override existing specification. Current value: 'Intel Core i5', new value: 'Intel Core i7'"

   **User-Friendly Question**:
   > "You previously selected Intel Core i5 as your processor, but now you're mentioning Intel Core i7.
   >
   > Which would you like to use?
   > A) Keep Intel Core i5 (your original choice)
   > B) Switch to Intel Core i7 (your new preference)
   >
   > Please choose A or B."

### Conflict Type-Specific Guidance

**Logical Conflicts** (type: "logical"):
- Focus on the tradeoff between conflicting requirements
- Explain which use cases each option serves best

**Dependency Conflicts** (type: "dependency"):
- Explain that one choice requires another component
- Make it clear what gets added if they choose the dependent option

**Constraint Conflicts** (type: "constraint"):
- Explain that a value doesn't meet system requirements
- Suggest a valid alternative

**Cross-Artifact Conflicts** (type: "cross-artifact"):
- Acknowledge they're changing a previous selection
- Make it clear this will replace their earlier choice

**Mutex Conflicts** (type: "mutex"):
- Explain that only one option can be selected
- Clarify why they're mutually exclusive (if relevant)

### What NOT to Do

❌ DON'T say "There's a conflict in spc001 and spc005"
✅ DO say "I noticed your processor choice needs more power than you specified"

❌ DON'T say "Constraint violation in the UC1 schema"
✅ DO say "That storage size isn't available - would you like 512GB or 1TB instead?"

❌ DON'T present technical node IDs or schema references
✅ DO use plain language and real-world implications

❌ DON'T ask "Would you like to resolve this conflict?"
✅ DO directly present the binary choice

### System Handoff

After the user responds with A or B, you will:
1. Interpret their choice (even if they say "first one" or "option A" or just "A")
2. Call the resolution method (Sprint 3 Week 2 - NOT your responsibility now)
3. Confirm the choice: "Got it, I've updated your configuration with [winning option]."

**Note**: Sprint 3 Week 1 focuses on question generation. Response parsing is Week 2.
`;
```

---

## Implementation Location

**File**: `src/services/respec/AnthropicService.ts`

**Method to Modify**: `analyzeRequirements()`

### Suggested Code Modification

```typescript
/**
 * Analyze requirements with conflict detection
 * Sprint 3 Week 1: Enhanced to handle conflict resolution mode
 */
async analyzeRequirements(
  message: string,
  context: {
    conversationHistory: any[];
    sessionId: string;
    conflictData?: any; // NEW PARAMETER
  }
): Promise<any> {

  // Sprint 3 Week 1: If conflicts exist, generate binary question instead of normal processing
  if (context.conflictData?.hasConflicts) {
    console.log('[AnthropicService] Conflict mode - generating binary question');

    const conflict = context.conflictData.conflicts[0]; // Handle one at a time

    const conflictPrompt = `
${CONFLICT_RESOLUTION_GUIDANCE}

## Current Conflict

${JSON.stringify(conflict, null, 2)}

Generate a user-friendly binary question following the format and guidelines above.
Make it conversational and focus on user outcomes, not technical details.
    `;

    const response = await this.callAnthropicAPI(conflictPrompt, context.conversationHistory);

    return {
      response,
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

## Integration Point

### SimplifiedRespecService calls AnthropicService:

```typescript
// In SimplifiedRespecService.processChatMessage()

// Check for conflicts
const conflictStatus = this.getActiveConflictsForAgent();

if (conflictStatus.hasConflicts) {
  // Pass conflict data to agent
  const anthropicResult = await this.anthropicService.analyzeRequirements(
    message,
    {
      conversationHistory: this.conversationHistory.slice(-5),
      sessionId: this.sessionId,
      conflictData: conflictStatus // Pass structured conflict data
    }
  );

  return {
    conversationalResponse: anthropicResult.response,
    formUpdates: [],
    systemMessage: 'conflict_question_generated',
    conflictData: conflictStatus
  };
}
```

---

## Testing Examples

### Test Case 1: Logical Conflict

**Input Conflict**:
```json
{
  "type": "logical",
  "description": "High-performance processor incompatible with low power consumption",
  "conflictingNodes": [
    {"id": "spc001", "name": "processor_type", "value": "Intel Core i7"},
    {"id": "spc005", "name": "max_power_consumption", "value": "< 10W"}
  ]
}
```

**Expected Agent Output**:
```
I see a potential issue - you've selected a high-performance Intel Core i7 processor, but specified very low power consumption (< 10W). High-performance processors typically need 35-65W to operate.

Which is more important for your system?
A) High performance with the Intel Core i7 processor (requires 35-65W power supply)
B) Low power consumption with a more efficient processor like Intel Atom (10-20W)

Please choose A or B.
```

### Test Case 2: Cross-Artifact Conflict

**Input Conflict**:
```json
{
  "type": "cross-artifact",
  "description": "Attempting to override existing specification. Current value: '512GB', new value: '1TB'",
  "conflictingNodes": [
    {"id": "spc008", "name": "storage_capacity", "value": "1TB"}
  ]
}
```

**Expected Agent Output**:
```
I noticed you previously set storage capacity to 512GB, but now you're mentioning 1TB.

Would you like to change it?
A) Keep 512GB (your original selection)
B) Change to 1TB (upgrade storage)

Please choose A or B.
```

### Test Case 3: Mutex Conflict

**Input Conflict**:
```json
{
  "type": "mutex",
  "description": "Multiple mutually exclusive options selected for Operating System",
  "conflictingNodes": [
    {"id": "spc020", "name": "operating_system", "value": "Linux"},
    {"id": "spc020", "name": "operating_system", "value": "Windows 11"}
  ]
}
```

**Expected Agent Output**:
```
I see you've mentioned both Linux and Windows 11. The system can only run one operating system.

Which operating system would you prefer?
A) Linux
B) Windows 11

Please choose A or B.
```

---

## Key Design Principles

1. **User-Centric Language**: Talk about outcomes and use cases, not technical constraints
2. **One Conflict at a Time**: Don't overwhelm the user with multiple conflicts simultaneously
3. **Clear Options**: Always A and B, clearly labeled
4. **Brevity**: 1-2 sentences per option explanation maximum
5. **Action-Oriented**: Make it clear what will happen when they choose each option

---

## Future Enhancements (Sprint 3 Week 2)

- Agent semantic parsing of user responses ("I'll go with the first one" → option-a)
- Confirmation messages after resolution
- Handling of user questions during conflict resolution
- Cycle tracking for escalation

---

**Status**: Sprint 3 Week 1 - Prompt suggestion complete
**Next**: User customizes prompt based on this template
**Integration**: SimplifiedRespecService already passes conflictData to agent

