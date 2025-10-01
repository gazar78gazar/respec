# ReSpec MVP Implementation Plan
## Comprehensive Development Reference & Tracking Document

**Document Version**: 1.0.0
**Date**: September 30, 2025
**Scope**: MVP Implementation Only
**Total Duration**: 7 weeks

---

## 🎯 Executive Summary

This document provides the complete implementation roadmap for building the ReSpec MVP system based on the PRD v1.0.1, PRD Addendum v2.0.1, and Technical Specification v1.0.1. All scope clarifications and corrections from sprint planning discussions are incorporated.

### **Core MVP Objectives**
1. **Multi-artifact state management** (Respec, Mapped, Unmapped, Conflicts)
2. **LLM semantic matching** to UC1.json schema with confidence scoring
3. **UC1-based conflict detection** and agent-driven resolution
4. **Seamless integration** with existing chat-form bidirectional communication

### **Key Constraints**
- **Preserve existing functionality** throughout implementation
- **No new UI components** - use existing chat for all interactions
- **MVP-focused** - no error handling, performance monitoring, or advanced features
- **7-week timeline** with clear validation gates

---

## 📋 Current State Analysis

### **What's Working Well ✅**
- **Bidirectional chat-form sync** via `communicateWithMAS` + `setChatMessages`
- **LLM field-aware processing** with substitution notes
- **Form field structure** with dropdown validation
- **Debug trace system** for development tracking
- **UC1.json basic loading** for field mappings

### **What's Missing ❌**
- **Multi-artifact state management** (only single requirements object exists)
- **LLM semantic matching** to UC1 schema (only basic extraction implemented)
- **Conflict detection system** (no mutex, constraint, or dependency validation)
- **UC1 hierarchical processing** (domain→requirement→specification)
- **Priority queue** with conflict blocking behavior

### **Integration Point Verification ✅**
**CONFIRMED ACTIVE FLOW**:
```
User Input → ChatWindow.onSendMessage → sendMessageWrapper → communicateWithMAS →
SimplifiedRespecService.processChatMessage → setChatMessages (displays result)
```

**Key Integration Functions**:
- `communicateWithMAS` (app.tsx:1056) - Central processing hub
- `setChatMessages` (app.tsx:1068-1071) - Chat display mechanism
- `sendMessageWrapper` (app.tsx:932) - User input handler
- `SimplifiedRespecService.processChatMessage` - Core processing logic

---

## 🏗️ Architecture Transformation

### **State Management Evolution**

#### **Current State Structure**
```typescript
// app.tsx:764
const [requirements, setRequirements] = useState<Requirements>({});
```

#### **Target MVP State Structure**
```typescript
interface AppState {
  // Legacy compatibility layer (preserve during transition)
  requirements: Requirements;

  // New multi-artifact system
  artifacts: {
    respec: RespecArtifact;      // Validated, coherent specifications
    mapped: MappedArtifact;      // LLM-matched, pending validation
    unmapped: UnmappedList;      // Unrecognized data nodes
    conflicts: ConflictList;     // Isolated conflicting nodes
  };

  // UC1 processing state
  uc1Schema: UC1Schema;
  branchManagement: {
    hierarchy: Map<string, string[]>;  // nodeId -> childIds
    movements: Movement[];
  };

  // Conflict management
  priorityQueue: {
    blocked: boolean;
    currentPriority: 'CONFLICTS' | 'CLEARING' | 'PROCESSING';
    conflictCycles: Map<string, number>;
  };
}
```

### **Processing Pipeline Transformation**

#### **Current Flow**
```
User Message → SimplifiedRespecService → Basic LLM → Form Update
```

#### **Target MVP Flow**
```
User Message → Extract & Match (LLM + UC1) → Validate (Code) → Route to Artifact →
Conflict Detection → Resolution or Form Update
```

---

## 📊 Sprint Planning - MVP Focused

### **Sprint 1: Foundation Architecture (2 weeks)**
**Goal**: Establish multi-artifact state and UC1 engine without breaking existing functionality

#### **Week 1: State Management Foundation**

**Tasks**:
1. **Implement AppState Interface**
   - Create artifact management classes in new files
   - Add state initialization alongside existing requirements state
   - Build compatibility layer to maintain existing form functionality

2. **Create Artifact Classes**
   ```typescript
   // New files to create:
   // src/services/respec/artifacts/RespecArtifact.ts
   // src/services/respec/artifacts/MappedArtifact.ts
   // src/services/respec/artifacts/UnmappedList.ts
   // src/services/respec/artifacts/ConflictList.ts
   ```

3. **State Migration Utilities**
   - Functions to sync between old and new state structures
   - Ensure existing `updateField` continues working
   - Preserve all trace logging functionality

**Integration Points**:
- Modify `app.tsx` state initialization (lines 764-771)
- Extend `updateField` function (lines 1582-1661) to update both states
- Preserve `communicateWithMAS` functionality

**Validation Criteria**:
- ✅ All existing chat-form functionality works unchanged
- ✅ New artifact state accessible via debug console
- ✅ TypeScript compilation unchanged (~218 baseline errors)
- ✅ All existing `.cjs` test scripts pass

#### **Week 2: UC1 Schema Engine**

**Tasks**:
1. **UC1 Schema Loading Enhancement**
   - Extend existing UC1.json loading (SimplifiedRespecService.ts:160-177)
   - Parse full domain→requirement→specification hierarchy
   - Build node relationship mapping

2. **Validation Engine Implementation**
   ```typescript
   // New file: src/services/respec/UC1ValidationEngine.ts
   class UC1ValidationEngine {
     validateNode(node: DataNode): ValidationResult;
     checkMutexConflicts(nodeIds: string[]): Conflict[];
     validateConstraints(spec: Specification): ValidationResult;
     getHierarchy(nodeId: string): HierarchyPath;
   }
   ```

3. **Integration with Existing Flow**
   - Enhance `SimplifiedRespecService.initialize()` to load UC1 schema
   - Add validation to existing field mapping logic
   - Preserve all current field definitions functionality

**Integration Points**:
- Enhance `SimplifiedRespecService.initialize()` (lines 152-198)
- Extend existing UC1.json loading logic
- Integrate with `buildFieldOptionsMap()` (lines 254-274)

**Validation Criteria**:
- ✅ UC1.json correctly parsed into hierarchy structure
- ✅ Validation functions operational and testable
- ✅ Existing field mappings enhanced with UC1 relationships
- ✅ Form field options still work with dropdown validation

**Sprint 1 Deliverables**:
- Multi-artifact state management foundation
- UC1 schema validation engine
- All existing functionality preserved
- Debug access to new systems

---

### **Sprint 2: LLM Semantic Matching (2 weeks)**
**Goal**: Upgrade LLM to handle extraction AND UC1 semantic matching with confidence scoring

#### **Week 1: LLM Enhancement**

**Tasks**:
1. **Prompt Template Enhancement**
   - Implement UC1-aware prompts as specified in tech spec (lines 80-131)
   - Add semantic matching capabilities to `AnthropicService`
   - Include confidence scoring in LLM responses

2. **AnthropicService Upgrade**
   ```typescript
   // Enhance existing AnthropicService.ts
   interface EnhancedRequirement {
     section: string;
     field: string;
     value: any;
     uc1Match: {
       id: string;
       confidence: number;  // 0.0 to 1.0
       matchType: 'exact' | 'fuzzy' | 'semantic';
     };
     originalRequest?: string;
     substitutionNote?: string;
   }
   ```

3. **UC1 Context Integration**
   - Pass UC1 schema to LLM prompts
   - Implement semantic matching instructions
   - Add match validation logic

**Integration Points**:
- Enhance `AnthropicService.analyzeRequirements()` (lines 46-115)
- Extend system prompt building (lines 191-258)
- Integrate with existing field options context

**Validation Criteria**:
- ✅ LLM can match user input to UC1 schema nodes
- ✅ Confidence scores between 0.0-1.0 returned
- ✅ Semantic matching works for test cases ("budget friendly" → budget requirements)
- ✅ Existing substitution note functionality preserved

#### **Week 2: Artifact Population**

**Tasks**:
1. **Mapped Artifact Creation**
   - Route LLM matches to mapped artifact
   - Build hierarchical branch structures
   - Preserve existing immediate form updates for specifications

2. **Integration with Processing Pipeline**
   - Enhance `SimplifiedRespecService.processChatMessage()` (lines 381-478)
   - Route different node types appropriately
   - Maintain existing chat response functionality

3. **Form Field Integration**
   - Preserve existing immediate specification updates
   - Enhance with UC1 node validation
   - Maintain substitution note display

**Integration Points**:
- Enhance `processChatMessage()` in SimplifiedRespecService
- Preserve existing `EnhancedFormUpdate` processing (app.tsx:1089-1153)
- Maintain `setChatMessages` display mechanism

**Validation Criteria**:
- ✅ LLM matches correctly populate mapped artifact
- ✅ Form fields update immediately for specifications (existing behavior preserved)
- ✅ Chat responses display properly via `setChatMessages`
- ✅ Substitution notes continue to work

**Sprint 2 Deliverables**:
- LLM semantic matching to UC1 schema
- Confidence scoring system
- Mapped artifact population
- Enhanced but compatible chat flow

---

### **Sprint 3: Conflict Detection & Resolution (2 weeks)**
**Goal**: Implement UC1-based conflict management with agent-driven resolution

#### **Week 1: Conflict Detection Engine**

**Tasks**:
1. **UC1-Based Conflict Detection**
   ```typescript
   // Implementation methods based on UC1 schema:
   // 1. Mutex: Check node.mutex_ids arrays (exact matching)
   // 2. Dependency: Validate parent_ids/child_ids relationships
   // 3. Constraint: Check node.constraints validation rules
   ```

2. **Branch Analysis System**
   - Implement conflict isolation algorithms
   - Identify non-conflicting nodes for immediate processing
   - Build partial branch movement logic per PRD specifications

3. **Integration with Processing Pipeline**
   - Add conflict detection to mapped artifact processing
   - Implement branch splitting logic
   - Route conflicts to conflict list, clean nodes to respec

**Integration Points**:
- Add conflict detection to `communicateWithMAS` flow
- Integrate with existing artifact state management
- Preserve existing processing pipeline structure

**Validation Criteria**:
- ✅ Mutex conflicts detected using UC1 schema
- ✅ Constraint violations identified
- ✅ Branch splitting isolates conflicts correctly
- ✅ Non-conflicting portions move to respec immediately

#### **Week 2: Agent-Driven Resolution**

**Tasks**:
1. **Priority Queue Implementation**
   - Implement blocking behavior when conflicts exist
   - Route conflict questions through existing chat system
   - Prevent new processing until conflicts resolved

2. **Resolution Flow Integration**
   ```typescript
   // Resolution flow using EXISTING chat infrastructure:
   // 1. Detection → Agent formulates binary question
   // 2. Question sent via setChatMessages (existing mechanism)
   // 3. User response via ChatWindow.onSendMessage (existing)
   // 4. Response processed by SimplifiedRespecService (existing)
   // 5. Conflict resolved and artifacts updated
   ```

3. **Cycle Management**
   - Track conflict resolution attempts
   - Auto-resolve after 3 cycles per PRD specification
   - Move persistent conflicts to unmapped list

**Integration Points**:
- **NO NEW UI NEEDED** - Use existing chat components
- Enhance `communicateWithMAS` to check conflict state first
- Route conflict questions through existing `setChatMessages`
- Process resolutions through existing `processChatMessage`

**Validation Criteria**:
- ✅ Conflicts block new processing (prompt-level logic)
- ✅ Binary questions display in existing chat interface
- ✅ User responses correctly extract resolution choice
- ✅ Conflict resolution updates all artifacts appropriately
- ✅ Cycle detection prevents infinite loops

**Sprint 3 Deliverables**:
- Complete UC1-based conflict detection
- Agent-driven resolution via existing chat
- Priority queue with blocking behavior
- Cycle management and auto-resolution

---

### **Sprint 4: Final Integration & Validation (1 week)**
**Goal**: Complete end-to-end integration and validate full MVP functionality

#### **Week 1: Integration & Testing**

**Tasks**:
1. **End-to-End Flow Validation**
   - Test complete user journey: chat → extraction → matching → validation → resolution
   - Verify all artifacts behave according to specifications
   - Ensure form updates work correctly throughout

2. **Autofill Enhancement**
   - Replace pattern-based defaults with respec-derived suggestions
   - Implement suggestion generation from validated respec artifact
   - Integrate with existing autofill trigger mechanisms

3. **Final Integration Testing**
   - Run comprehensive test scenarios
   - Validate performance within acceptable limits
   - Ensure all existing functionality preserved

**Integration Points**:
- Complete integration testing via existing `.cjs` test scripts
- Validate `communicateWithMAS` → `setChatMessages` flow
- Test all existing form field operations

**Validation Criteria**:
- ✅ Complete user journey functional
- ✅ All artifact states managed correctly
- ✅ Existing functionality unchanged
- ✅ Performance acceptable for MVP (<2 seconds response time)

**Sprint 4 Deliverables**:
- Fully functional ReSpec MVP
- Complete end-to-end integration
- Validated against all specification requirements
- Ready for user testing

---

## 🧪 Testing & Validation Strategy

### **Continuous Validation Requirements**

**Every Sprint Must Maintain**:
- ✅ All existing functionality works unchanged
- ✅ TypeScript error count stays at ~218 baseline
- ✅ All existing `.cjs` test scripts pass
- ✅ Chat-form bidirectional sync preserved
- ✅ Substitution notes continue working
- ✅ Debug trace system operational

### **Sprint-Specific Test Scenarios**

**Sprint 1 Tests**:
- New artifact state accessible via console
- Existing form operations unchanged
- UC1.json loading enhanced but compatible

**Sprint 2 Tests**:
- LLM semantic matching: "budget friendly" → budget-related UC1 nodes
- Confidence scores: 0.0-1.0 range validation
- Form updates: immediate specification processing preserved

**Sprint 3 Tests**:
- Conflict detection: mutex, constraint, dependency validation
- Resolution flow: binary questions → user responses → conflict resolution
- Priority blocking: no new processing during conflicts

**Sprint 4 Tests**:
- End-to-end scenarios: complex user requirements with conflicts
- Performance validation: response times < 2 seconds
- Integration completeness: all MVP requirements satisfied

### **Test Execution Strategy**
- **Automated**: Extend existing `.cjs` test scripts for each sprint
- **Manual**: User scenario testing via chat interface
- **Integration**: Full pipeline testing using `communicateWithMAS`
- **Regression**: Preserve all existing functionality tests

---

## 🔧 Technical Implementation Details

### **Key File Modifications**

**app.tsx** (Primary Integration File):
- Lines 764-771: Add multi-artifact state alongside requirements
- Lines 1056-1071: Enhance `communicateWithMAS` with conflict checking
- Lines 1582-1661: Extend `updateField` for dual state management

**SimplifiedRespecService.ts** (Core Processing):
- Lines 152-198: Enhance `initialize()` with UC1 schema loading
- Lines 381-478: Upgrade `processChatMessage()` with semantic matching
- Add new methods for conflict detection and artifact management

**AnthropicService.ts** (LLM Integration):
- Lines 46-115: Enhance `analyzeRequirements()` with UC1 context
- Lines 191-258: Upgrade system prompts with semantic matching
- Add confidence scoring and match validation

**New Files to Create**:
```
src/services/respec/artifacts/
├── RespecArtifact.ts
├── MappedArtifact.ts
├── UnmappedList.ts
└── ConflictList.ts

src/services/respec/
├── UC1ValidationEngine.ts
├── ConflictDetector.ts
└── BranchManager.ts
```

### **UC1 Schema Integration Points**

**Conflict Detection Methods**:
- **Mutex**: Check `node.mutex_ids` array for exact matches
- **Dependency**: Validate `parent_ids/child_ids` relationships exist
- **Constraint**: Validate against `node.constraints` rules

**Semantic Matching Process**:
1. LLM receives UC1 schema context in prompt
2. Performs semantic similarity matching
3. Returns confidence score (0.0-1.0)
4. Code validates match against UC1 constraints

**Branch Processing Logic**:
1. Identify conflicting nodes using UC1 validation
2. Isolate conflicts + descendants to conflict list
3. Move non-conflicting siblings to respec immediately
4. Maintain hierarchy integrity per UC1 structure

---

## 📋 Development Tracking

### **Sprint Completion Checklist**

**Sprint 1 Complete When**:
- [ ] Multi-artifact state implemented
- [ ] UC1 validation engine operational
- [ ] All existing tests pass
- [ ] Legacy compatibility maintained

**Sprint 2 Complete When**:
- [ ] LLM semantic matching functional
- [ ] Confidence scoring implemented
- [ ] Mapped artifact population working
- [ ] Form integration preserved

**Sprint 3 Complete When**:
- [ ] Conflict detection operational
- [ ] Agent resolution via chat working
- [ ] Priority queue blocking implemented
- [ ] Cycle management functional

**Sprint 4 Complete When**:
- [ ] End-to-end flow validated
- [ ] Performance requirements met
- [ ] All MVP requirements satisfied
- [ ] Ready for user testing

### **Risk Mitigation Tracking**

**Technical Risks**:
- State management complexity → Mitigate with compatibility layer
- LLM integration changes → Preserve existing fallback patterns
- Conflict detection performance → Use efficient UC1 lookups
- Chat flow modifications → Maintain existing integration points

**Scope Risks**:
- Feature creep → Strict MVP focus, no advanced features
- UI expectations → Clarify no new UI components needed
- Performance requirements → MVP-level acceptable performance only

---

## 🎯 Success Criteria

### **MVP Completion Definition**
The ReSpec MVP is complete when:

1. **Multi-Artifact Management**: Four distinct artifact types operational
2. **LLM Semantic Matching**: UC1-aware extraction and matching with confidence
3. **Conflict Resolution**: UC1-based detection with agent-driven resolution
4. **Seamless Integration**: All existing functionality preserved and enhanced
5. **Validation**: Complete test coverage and performance within limits

### **User Experience Goals**
- Users can input complex requirements via chat
- System intelligently matches to UC1 schema
- Conflicts resolved through clear binary questions
- Form populates immediately and accurately
- No learning curve - existing interface enhanced

### **Technical Achievement Goals**
- Clean architecture supporting future expansion
- Robust UC1 integration foundation
- Efficient conflict management system
- Preserved development velocity
- Maintainable and testable codebase

---

## 📞 Information Requests & Answers

### **Original Questions & Your Responses**

✅ **1. UC1 Schema Structure**:
- **Answer**: Check `root\public\uc1.json` for mutex and constraint patterns
- **Analysis**: UC1.json contains specifications with `technical_details` for constraint validation but **NO explicit mutex fields**. Conflict detection will need to be implemented through **constraint analysis** and **dependency relationships**.

✅ **2. Conflict Resolution Examples**:
- **Answer**: High performance compute vs low power consumption conflict - either high processing with grid power OR low processing with battery/non-grid power
- **Analysis**: Key conflict example identified in UC1: `processor_type` (high performance) vs `max_power_consumption` (low power) vs `power_input` (grid/battery)

✅ **3. Performance Expectations**:
- **Answer**: 4 seconds acceptable, 5 seconds less preferred
- **Updated**: Performance target adjusted to <4 seconds (was <2 seconds)

✅ **4. Validation Scenarios**:
- **Answer**: You have user input/system output transcripts that can be added to docs folder
- **Next Step**: Please add these transcripts to `/docs` folder for comprehensive test scenario development

✅ **5. Legacy Code Cleanup**:
- **Answer**: Do deep analysis of current codebase to suggest cleanup opportunities
- **Analysis Complete**: See detailed findings below

---

## 🔍 Deep Codebase Analysis Results

### **UC1.json Conflict Detection Strategy**

**Key Finding**: UC1.json does **NOT contain explicit mutex fields** as mentioned in the specifications. Instead, conflicts must be detected through:

1. **Constraint Conflicts**: Compare `technical_details.value` ranges and operators
   ```json
   // Example from spc001 vs spc036:
   "spc001": { "parameter": "processor_tier", "value": 3, "operator": "min" }
   "spc036": { "parameter": "power_max", "value": 20, "operator": "max", "unit": "W" }
   ```

2. **Dependency Conflicts**: Analyze `dependencies` arrays in requirements
   ```json
   "req001": { "dependencies": [{"target": "req004", "type": "all"}] }
   ```

3. **Logical Conflicts**: High-performance processor + low power consumption scenario
   - `processor_type`: "Intel Core i7" (high performance)
   - `max_power_consumption`: "10-20W" (low power)
   - `power_input`: "24V DC" vs "PoE+" (grid vs non-grid)

### **Legacy Code Cleanup Opportunities**

**High Priority Cleanup**:
1. **Isolate Legacy Files** (Sprint 1):
   - Move `src/backup_migration/` to `src/legacy_isolated/backup_migration/`
   - Move `src/services/respec/ReSpecService.ts.disabled` to `src/legacy_isolated/`
   - **DO NOT DELETE** - preserve for reference

2. **Remove TODO Comments**:
   - `app.tsx:1529-1536` - ReSpec integration placeholder
   - `app.tsx:1963` - Share functionality placeholder

3. **Simplify Dual Chat Implementations** (Sprint 4):
   - Remove legacy `sendMessageWrapper` pattern (app.tsx:932-962)
   - Consolidate to single `communicateWithMAS` flow
   - Clean up duplicate chat rendering code

**Medium Priority Cleanup**:
1. **Remove Debug Comments**:
   - `app.tsx:19` - "RequirementLegend component - removed as unused"
   - Multiple "oldValue" debug logging

2. **Consolidate Placeholder Text**:
   - Standardize chat placeholder text across components
   - Remove hardcoded "Requirements Assistant" titles

**Low Priority** (Post-MVP):
- UI text standardization
- CSS class consolidation
- Type definition cleanup in `respec-types.ts`

---

## 🎯 Updated Technical Implementation Details

### **UC1 Conflict Detection Implementation**

```typescript
// NEW: UC1-based conflict detection (no mutex fields exist)
class UC1ConflictDetector {
  detectConstraintConflicts(specs: Specification[]): Conflict[] {
    const conflicts: Conflict[] = [];

    // Check processor tier vs power consumption conflicts
    const processor = specs.find(s => s.technical_details?.parameter === 'processor_tier');
    const power = specs.find(s => s.technical_details?.parameter === 'power_max');

    if (processor && power) {
      const highPerformance = processor.technical_details.value >= 3;
      const lowPower = power.technical_details.value <= 20;

      if (highPerformance && lowPower) {
        conflicts.push({
          type: 'constraint',
          nodes: [processor.id, power.id],
          description: 'High-performance processor incompatible with low power consumption'
        });
      }
    }

    return conflicts;
  }
}
```

### **Revised Conflict Types**

Based on UC1.json analysis, conflict detection will handle:
1. **Constraint Conflicts**: Parameter value range incompatibilities
2. **Dependency Conflicts**: Missing required dependencies
3. **Logical Conflicts**: Business rule violations (performance vs power)
4. **Cross-Artifact Conflicts**: New vs existing respec conflicts

**Note**: No explicit mutex detection needed - UC1.json doesn't contain mutex fields.

---

## 📋 Updated Sprint Planning

### **Sprint 1: Foundation Architecture**
- **Duration**: 2 weeks (unchanged)
- **Week 1 Order**: Start with UC1 Schema Engine (less complexity) → Then State Management
- **Additional Tasks**:
  - Isolate legacy files to `src/legacy_isolated/` folder
  - Clean TODO comments during implementation

### **Sprint 2: LLM Semantic Matching**
- **Duration**: 2 weeks (unchanged)
- **Updated Performance Target**: <4 seconds response time (was <2 seconds)
- **Additional Task**: Implement UC1 constraint-based matching

### **Sprint 3: Conflict Detection & Resolution**
- **Duration**: 2 weeks (unchanged)
- **Updated Approach**: Focus on UC1-discovered conflicts only (no additional conflict types for MVP)
- **Primary Conflict Scenario**: High performance vs low power consumption
- **Scope**: Implement only conflicts found in UC1 analysis, defer additional types post-MVP

### **Sprint 4: Final Integration**
- **Duration**: 1 week (unchanged)
- **Additional Task**: Clean up dual chat implementations
- **Test Scenarios**: Use provided user transcripts (when added to /docs)

---

## 🧪 Updated Testing Strategy

### **Primary Test Scenario (Your Conflict Example)**
```
User Input: "I need high performance thermal imaging with battery power operation"

Expected System Behavior:
1. Extract: processor_type → "Intel Core i7", max_power_consumption → "< 10W", power_input → "PoE+"
2. Detect Conflict: High performance processor incompatible with low power/battery operation
3. Agent Question: "I detected a conflict: High performance thermal imaging requires powerful processors (Intel Core i7) which consume 35-65W, but battery operation typically supports only 10-20W systems. Would you prefer: (A) High performance with grid power, or (B) Lower performance optimized for battery operation?"
4. User Response: "A" or "B"
5. Resolution: Update specifications accordingly and continue processing
```

### **Additional Test Scenarios**
- Will be developed from user transcripts when provided to `/docs` folder
- Focus on constraint validation and business logic conflicts
- Performance validation: all responses < 4 seconds

---

## ✅ FINAL DECISIONS & IMPLEMENTATION START

### **Confirmed Approach**

1. **User Transcripts**: Begin Sprint 1 without transcripts, integrate when provided later
2. **Legacy Files**: Isolate to `src/legacy_isolated/` folder, preserve for reference
3. **Conflict Scope**: Focus only on UC1-discovered conflicts for MVP
4. **Sprint 1 Order**: Start with UC1 Schema Engine (less complex) before State Management

### **Sprint 1 Week 1 - Implementation Order (Minimum Complexity Path)**

**Day 1-3: UC1 Schema Engine**
```typescript
// Start with simple, isolated component
// src/services/respec/UC1ValidationEngine.ts
class UC1ValidationEngine {
  private uc1Data: any;

  async loadSchema(): Promise<void> {
    // Load and parse UC1.json
  }

  validateConstraints(spec: any): ValidationResult {
    // Simple constraint validation
  }
}
```

**Day 4-7: State Management Foundation**
```typescript
// Add multi-artifact state after UC1 engine works
// Extend existing state rather than replace
interface AppState {
  requirements: Requirements; // Keep existing
  artifacts: ArtifactState;   // Add new
}
```

### **Ready for Implementation**

All questions answered, approach confirmed:
- ✅ Legacy files will be isolated, not removed
- ✅ Focus on UC1 conflicts only (performance vs power)
- ✅ Start with UC1 Schema Engine for minimum complexity
- ✅ User transcripts can be added later without blocking progress

**Sprint 1 begins with UC1 Schema Engine implementation.**

This implementation plan will serve as my comprehensive guide throughout the 7-week development process, ensuring I stay aligned with the MVP goals while maintaining the existing system's reliability and user experience.