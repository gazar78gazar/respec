## System Flow Description - Conflict Resolution Pipeline
**Version 2.0 - Enhanced for Implementation**

---

### Definitions

**Stateful Agent**
- An LLM call with access to tools, system lists and memory elements
- Tracks pending binary questions to prevent mixups when multiple conflicts exist
- Notifies user when new data nodes arrive while awaiting answers to pending questions

**System Memory Resources**
- Time-stamped input/output logs of the chatbox and Form
- Conflict list, unmapped list
- MAPPED artifact, RESPEC artifact

**Conflict List**
- Receives conflicted data nodes
- Each conflicted data node may conflict with multiple other data nodes
- **Inheritance rule**: In UC8, if all children of a parent are conflicted with a certain data node, the parent inherits the conflict
- Organizes conflicts by evolution steps: `entry to list → sent to agent → binary question in chatbox → user answered → resolution → sent to agent → acknowledged to user`
- **Mechanism**: System uses `{ArtifactManager.state.conflicts.active + conflict list}` to track several conflicts, each in its own evolution step
- **Attributes**: Each conflict has identifying attributes to prevent mixup when multiple conflicts are sent to agent simultaneously

**Unmapped List**
- Stores all comments and unmapped user requirements
- Feeds the last form section/tab (not yet created)

**MAPPED Artifact**
- Staging area where data nodes undergo conflict resolution process
- Has same data model/structure as UC8 dataset
- **Entry condition**: When an extracted user scenario/requirement/specification is successfully matched with an existing UC8 data node, that data node is copied to MAPPED
- **Wait state**: Successfully matched data nodes await in MAPPED until all conflicts are resolved

**RESPEC Artifact**
- Final area hosting data nodes
- Data nodes are always fully coherent (conflict-clean)
- Each change automatically triggers Form update in GUI (Form is plain representation of RESPEC)
- **Coherence validation**: ArtifactManager should include a coherence checker after each resolution

**3 Conflict Types**
Conflicts can occur with data nodes currently in RESPEC artifact:

1. **Inherent Mutex in Extracted Nodes**
   - Example: Implementation scenarios s07:"indoor implementation" vs s64:"outdoor implementation"
   - Requirements with only one of the parents (s07 OR s64) inherit the mutex
   - **Resolution rule**: If a requirement has BOTH parents (s07 AND s64), then it is NOT excluded by selection of either

2. **Direct/Cascade Exclusion**
   - Data node relationship between any data node in MAPPED and any data node in RESPEC
   - 'excludes' is a data node attribute in UC8
   - Cascade example: "core i9" requires "GPU acceleration" which excludes "<10W power"

3. **Empty Specification Group**
   - Exclusions leaving no available dropdown selection items for a specification field
   - System does NOT prevent this conflict - it sends to agent using same fixed schema as other conflicts
   - Agent produces binary question for user to resolve

---

### Event-Driven Flow: MAPPED → Conflict Resolution

#### Trigger Event: Successful Match Found

**Steps:**
1. Map all associated data nodes logged in 'requires' attribute in UC8
   - These may also have their own 'requires' (recursive)
   - **Traversal order**: BFS (Breadth-First Search)
   - **Pull strategy**: Proactively pull in both 'requires' and 'excludes' from UC8
2. Copy the original and associated data nodes (name, excludes, requires) into MAPPED artifact

#### Trigger Event: New Data Node Entry to MAPPED Artifact

**Steps:**
1. Check each data node copied into MAPPED for all 3 conflict types
2. **If conflict found**:
   - Move data node from MAPPED to conflict list
   - Include all identified conflicting data nodes
3. **If no conflict**:
   - Move specs directly from MAPPED → RESPEC
   - Update form fields from RESPEC

#### Trigger Event: New Data Node Entry to Conflict List

**Conflict Priority Rules:**
- Process conflict with highest hierarchy first
- At same hierarchy: process conflict with most fields first

**Conflict Evolution Steps:**
1. Send to Stateful agent
2. Agent uses data nodes to curate binary question → sends via chatbox
3. User answers conflict via chatbox (ONLY via chatbox)
4. Agent uses answer to invoke conflict resolution method:
   - Delete unselected items (from either MAPPED or RESPEC)
   - Enter selected items (into either MAPPED or RESPEC)
   - **Resolution definition**: Conflict is "resolved" when deletion of unselected AND entry of selected data nodes completes
5. Resolution fulfillment message sent to agent
6. Agent communicates resolution confirmation to user via chatbox

---

### Component Flow Diagram

```
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

---

### System Components

| Component | Purpose | Location |
|-----------|---------|----------|
| **UCDataLayer** | Single data access layer for UC8 dataset | `src/services/data/UCDataLayer.ts` |
| **ConflictResolver** | Unified conflict detection & resolution | `src/services/data/ConflictResolver.ts` |
| **DependencyResolver** | Spec-level dependency management (OR/AND/exclude logic) | `src/services/data/DependencyResolver.ts` |
| **ArtifactManager** | Manages 4-artifact system, runs conflict detection, includes coherence checker | `src/services/respec/artifacts/ArtifactManager.ts` |
| **SimplifiedRespecService** | Orchestrates chat processing, formats conflict data | `src/services/respec/SimplifiedRespecService.ts` |
| **AnthropicService** | Handles agent conflict resolution logic | `src/services/respec/AnthropicService.ts` |
| **app.tsx** | UI layer, sends conflict data to agent | `src/app.tsx` |

---

### MVP Assumptions

**Single User, Compliant Behavior:**
- No time performance or scaling requirements
- Assume user follows system flow without challenging it
- No lock mechanisms needed for race conditions
- Ignore recursive depth limits (small dataset)
- Ignore circular dependency detection (dataset is validated)

**Form Field Behavior:**
- No validation rules needed on form fields
- Form fields update automatically per each change in RESPEC artifact

---

### Information Pending Extraction from Repository

**NOTE TO DEVELOPER**: The following items require code inspection and will be provided separately:

#### 1. Data Structures & Schemas
*(To be extracted from existing codebase)*
- Conflict object structure
- `ArtifactManager.state.conflicts.active` schema
- `SimplifiedRespecService.getActiveConflictsForAgent()` return format
- TypeScript interfaces for:
  - Conflicts
  - Data nodes in transit
  - Conflict log entries with evolution steps
  - Binary question structure sent to agent

#### 2. Agent Context & Prompt Engineering
*(To be extracted from existing codebase)*
- Memory elements included in each agent call
- System prompt template for conflict resolution
- How agent accesses conflict types (1/2/3)
- Expected binary question formats (examples)
- Agent's parsing logic for user A/B answers

#### 3. Testing Scenarios
*(To be extracted from existing codebase)*
- Sample UC8 data nodes demonstrating all 3 conflict types
- Expected binary questions for each conflict type
- Resolution outcomes for A vs B choices
- Multi-step conflict cascade examples

---

### Notes
- Component architecture shown above is a suggested structure
- Developer has final authority on implementation approach
- Developer already familiar with:
  - UC8 dataset structure
  - Data layer implementation
  - GUI components
  - `communicateWithMas` function for bidirectional GUI ↔ agentic system communication
