# Functional Technical Specification v1.0.1 - Update Document
## ReSpec - Intelligent Specification Extraction & Form Automation System

### Document Information
- **Version**: 1.0.1
- **Date**: January 30, 2025
- **Changes from v1.0.0**: Aligned with PRD Addendum v2.0.1
- **Target Stack**: TypeScript, React, Browser-based
- **Architecture Pattern**: Event-Driven, State Machine with Priority Queue

---

## Updated Sections

### 1.2 Processing Type Distribution (UPDATED)
```diff
- **LLM Operations (Blue)**: 30% - Natural language understanding, question generation
+ **LLM Operations (Blue)**: 40% - Extraction, semantic matching, question generation
- **Code Operations (Green)**: 70% - Validation, routing, state management  
+ **Code Operations (Green)**: 60% - Validation only (not matching), routing, state management
```

### 2.1.1 Central State Store (ENHANCED)
```typescript
interface AppState {
  // ... existing state ...
  
  // ADD: Branch Management State
  branchManagement: {
    hierarchy: {
      domains: Map<string, Set<string>>; // domainId -> requirementIds
      requirements: Map<string, Set<string>>; // reqId -> specIds
    };
    movements: {
      pending: Movement[];
      completed: Movement[];
      partial: PartialMovement[];
    };
  };
  
  // ADD: Priority Queue State
  priorityQueue: {
    currentPriority: 'CONFLICTS' | 'CLEARING' | 'PROCESSING';
    blocked: boolean;
    blockReason?: string;
    queue: PriorityItem[];
  };
  
  // ADD: Conflict Isolation State
  conflictIsolation: {
    isolated: Map<string, IsolatedConflict>;
    affected: Map<string, string[]>; // nodeId -> conflictIds
  };
}
```

### 2.2.1 Event System Architecture (EXPANDED)
```typescript
enum EventType {
  // ... existing events ...
  
  // ADD: Branch Management Events
  BRANCH_SPLIT = 'BRANCH_SPLIT',
  PARTIAL_MOVEMENT = 'PARTIAL_MOVEMENT',
  BRANCH_MERGED = 'BRANCH_MERGED',
  
  // ADD: Priority Events
  PRIORITY_BLOCKED = 'PRIORITY_BLOCKED',
  PRIORITY_RELEASED = 'PRIORITY_RELEASED',
  QUEUE_REORDERED = 'QUEUE_REORDERED',
  
  // ADD: Conflict Isolation Events
  CONFLICT_ISOLATED = 'CONFLICT_ISOLATED',
  NODE_ISOLATED = 'NODE_ISOLATED'
}
```

### 2.3.2 Extraction AND Matching Prompt Template (UPDATED)
```typescript
const EXTRACTION_AND_MATCHING_PROMPT = `
You are a technical specification extraction and matching agent for a power substation configuration system.

CONTEXT:
- User is configuring equipment based on UC1.json schema
- You must extract AND match to UC1 structure
- Perform semantic matching to find best fits

UC1 SCHEMA REFERENCE:
{uc1Schema}

USER INPUT: {userInput}

CURRENT FORM STATE: {formState}

PREVIOUS EXTRACTIONS: {previousExtractions}

TASKS:
1. EXTRACT: Identify all technical specifications mentioned
2. MATCH: Find best semantic match in UC1 schema for each extraction
3. CLASSIFY: Determine if domain, requirement, or specification
4. SCORE: Provide confidence for each match

MATCHING RULES:
- Use semantic similarity, not just exact text match
- "budget friendly" should match to budget-related requirements
- "fast response" should match to response time specifications
- "outdoor" should match to environmental requirements

OUTPUT FORMAT:
{
  "extractedAndMatched": [
    {
      "id": "generated_uuid",
      "extractedText": "original user text",
      "type": "domain|requirement|specification",
      "uc1Match": {
        "id": "matched_uc1_id",
        "name": "matched_uc1_name",
        "confidence": 0.95,
        "matchType": "exact|fuzzy|semantic"
      },
      "value": "extracted_value_if_specification",
      "attribution": "requirement"
    }
  ],
  "unmatchable": [],
  "potentialConflicts": []
}

Respond ONLY with valid JSON.
`;
```

### 2.4.1 UC1 Schema Interface (UPDATED)
```typescript
interface ValidationEngine {
  schema: UC1Schema;
  
  // REMOVED: Mapping methods (now in LLM)
  // findBestMatch(text: string): SchemaMatch; // MOVED TO LLM
  
  // Validation Methods (Code keeps these)
  validateNode(node: DataNode): ValidationResult;
  validateMatch(uc1Id: string, value: any): boolean;
  checkDependencies(specId: string): Dependency[];
  detectConflicts(specs: string[]): Conflict[];
  
  // Hierarchy Methods
  getHierarchy(id: string): HierarchyPath;
  getRelatedSpecs(id: string): string[];
  
  // Conflict Detection (Code-based)
  checkCompatibility(specA: string, specB: string): boolean;
  findConflictRules(spec: string): ConflictRule[];
}
```

### 2.5.1 Core Data Types (ENHANCED)
```typescript
// ADD: New interfaces for branch management
interface Movement {
  id: string;
  timestamp: Date;
  sourceArtifact: 'mapped' | 'conflicts';
  targetArtifact: 'respec' | 'unmapped';
  nodes: string[];
  trigger: 'validation_passed' | 'conflict_resolved' | 'timeout';
  partial: boolean;
}

interface PartialMovement extends Movement {
  originalBranch: string;
  movedNodes: string[];
  remainingNodes: string[];
  conflictNodes: string[];
}

interface IsolatedConflict {
  conflictId: string;
  isolatedNodes: string[];
  parentBranch: string;
  remainingBranch: string[];
  cycleCount: number;
}

interface PriorityItem {
  type: 'conflict' | 'mapping' | 'extraction';
  priority: number;
  payload: any;
  timestamp: Date;
  blocked: boolean;
}

interface MatchingResult {
  nodeId: string;
  uc1Match: string;
  confidence: number;
  matchType: 'exact' | 'fuzzy' | 'semantic';
}
```

### 2.5.2 Artifact Structures (UPDATED)
```typescript
// UC1-compliant structure for both Respec and Mapped
interface UC1CompliantStructure {
  domains: {
    [domainId: string]: {
      id: string;
      name: string;
      requirements: {
        [reqId: string]: {
          id: string;
          name: string;
          specifications: {
            [specId: string]: {
              id: string;
              value: any;
              attribution: 'requirement' | 'assumption';
              confidence: number;
              source: string;
            }
          }
        }
      }
    }
  };
}

interface RespecArtifact extends UC1CompliantStructure {
  id: string;
  version: string;
  created: Date;
  lastModified: Date;
  
  metadata: {
    completeness: number;
    validationStatus: 'valid' | 'warnings' | 'errors';
    userApproved: boolean;
    conflictsAllowed: false; // Respec is always coherent
  };
}

interface MappedArtifact extends UC1CompliantStructure {
  timestamp: Date;
  
  metadata: {
    conflictsAllowed: true; // Mapped can have internal conflicts
    pendingValidation: string[];
  };
}

interface ConflictList {
  active: Array<{
    id: string;
    conflictingNodes: string[]; // Individual nodes, not branches
    type: 'dependency' | 'value' | 'exclusion' | 'constraint';
    cycleCount: number;
  }>;
  resolved: Conflict[];
  escalated: Conflict[];
  history: ConflictHistory[];
}
```

### 2.6.1 Form Field Mapping (UPDATED)
```typescript
class FormManager {
  fields: FormField[];
  
  initializeFromSchema(schema: UC1Schema): void;
  
  // UPDATED: Immediate update for specifications only
  updateFieldImmediate(specId: string, value: any, source: string): void {
    // Only specifications trigger immediate form updates
    // Domains and requirements don't map to form fields
    const field = this.fields.find(f => f.mapping.specificationId === specId);
    if (field && this.isSpecification(specId)) {
      field.value = value;
      field.state.filled = true;
      field.state.source = source;
      this.emit('FIELD_UPDATED', { field, immediate: true });
    }
  }
  
  getCompletion(): { count: number; percentage: number };
  validateForm(): ValidationResult;
  
  // RENAMED: No generation, just application of defaults
  applyDefaults(emptyFields: FormField[]): void {
    emptyFields.forEach(field => {
      const uc1Default = this.getUC1Default(field.mapping.specificationId);
      field.value = uc1Default || 'Not Required';
      field.state.attribution = 'assumption';
    });
  }
  
  // Export/Import
  exportConfiguration(): string;
  importConfiguration(json: string): void;
}
```

### 2.7.1 Main Processing Loop (REWRITTEN)
```typescript
class ProcessingPipeline {
  async processWithPriority(): Promise<void> {
    while (this.form.getCompletion().percentage < 70) {
      
      // PRIORITY 1: Check for conflicts (BLOCKING)
      if (this.hasActiveConflicts()) {
        this.state.priorityQueue.blocked = true;
        this.state.priorityQueue.blockReason = 'Conflicts must be resolved first';
        
        // Agent says: "Hold on, let's first resolve conflicting requirements:"
        await this.presentConflictQuestion();
        continue; // Loop back, don't process new input
      }
      
      // PRIORITY 2: Clear mapped artifact
      if (this.hasMappedNodes()) {
        await this.clearMappedArtifact();
        continue;
      }
      
      // PRIORITY 3: Process new input (only if no conflicts and mapped is clear)
      this.state.priorityQueue.blocked = false;
      const input = await this.getUserInput();
      if (input) {
        await this.processInput(input);
      }
    }
    
    // Threshold reached
    await this.triggerAutofill();
  }
  
  async processInput(input: string): Promise<void> {
    // Step 1: Extract AND match (LLM)
    const extractedAndMatched = await this.llm.extractAndMatch(input);
    
    // Step 2: Validate matches (Code)
    for (const node of extractedAndMatched) {
      const isValid = this.validator.validateMatch(node.uc1Match.id, node.value);
      
      if (isValid) {
        // Step 3: Add to mapped artifact (with all children)
        await this.addToMapped(node);
        
        // Step 4: If specification, update form immediately
        if (node.type === 'specification') {
          this.form.updateFieldImmediate(node.uc1Match.id, node.value, 'user');
        }
      } else {
        // Invalid match - add to unmapped
        this.artifacts.unmapped.add(node);
      }
    }
  }
  
  async clearMappedArtifact(): Promise<void> {
    const branches = this.getBranchesFromMapped();
    
    for (const branch of branches) {
      const conflicts = this.detectConflicts(branch);
      
      if (conflicts.length === 0) {
        // No conflicts - move entire branch to respec
        this.moveToRespec(branch);
      } else {
        // Split branch: isolate conflicts
        const nonConflicting = this.getNonConflictingNodes(branch, conflicts);
        const conflicting = this.getConflictingNodesWithDescendants(branch, conflicts);
        
        // Move non-conflicting to respec (if not already there)
        for (const node of nonConflicting) {
          if (!this.existsInRespec(node)) {
            this.moveToRespec([node]);
          }
        }
        
        // Move conflicting to conflict list
        this.moveToConflictList(conflicting);
      }
    }
  }
}
```

### NEW Section 2.9 - Branch and Priority Management
```typescript
class BranchManager {
  // Identify branches in artifacts
  identifyBranches(artifact: UC1CompliantStructure): Branch[] {
    const branches: Branch[] = [];
    
    // Start from domains
    for (const domain of Object.values(artifact.domains)) {
      const branch: Branch = {
        root: domain.id,
        type: 'domain',
        nodes: [domain.id],
        children: []
      };
      
      // Add requirements
      for (const req of Object.values(domain.requirements)) {
        branch.nodes.push(req.id);
        
        // Add specifications
        for (const spec of Object.values(req.specifications)) {
          branch.nodes.push(spec.id);
        }
      }
      
      branches.push(branch);
    }
    
    return branches;
  }
  
  // Split branch when conflicts detected
  splitBranch(branch: Branch, conflictNodes: string[]): SplitResult {
    const conflictSet = new Set(conflictNodes);
    const descendants = this.getDescendants(conflictNodes);
    const toIsolate = new Set([...conflictSet, ...descendants]);
    
    return {
      clean: branch.nodes.filter(n => !toIsolate.has(n)),
      conflicted: Array.from(toIsolate)
    };
  }
  
  // Get all descendants of nodes
  getDescendants(nodeIds: string[]): string[] {
    const descendants: string[] = [];
    
    for (const nodeId of nodeIds) {
      const node = this.getNode(nodeId);
      if (node.type === 'domain') {
        // Add all requirements and their specs
        const reqs = this.state.branchManagement.hierarchy.domains.get(nodeId);
        for (const reqId of reqs || []) {
          descendants.push(reqId);
          const specs = this.state.branchManagement.hierarchy.requirements.get(reqId);
          descendants.push(...(specs || []));
        }
      } else if (node.type === 'requirement') {
        // Add all specifications
        const specs = this.state.branchManagement.hierarchy.requirements.get(nodeId);
        descendants.push(...(specs || []));
      }
    }
    
    return descendants;
  }
}

class PriorityQueueManager {
  private queue: PriorityItem[] = [];
  private blocked: boolean = false;
  
  // Conflict resolution always has highest priority
  setPriority(item: PriorityItem): void {
    if (item.type === 'conflict') {
      item.priority = 1000; // Highest
      this.blocked = true;
    } else if (item.type === 'mapping') {
      item.priority = 500;
    } else {
      item.priority = 100; // Lowest for new extraction
    }
    
    this.queue.push(item);
    this.queue.sort((a, b) => b.priority - a.priority);
  }
  
  getNext(): PriorityItem | null {
    if (this.blocked && this.queue[0]?.type !== 'conflict') {
      return null; // Only process conflicts when blocked
    }
    return this.queue.shift() || null;
  }
  
  unblock(): void {
    this.blocked = false;
    this.emit('PRIORITY_RELEASED');
  }
}
```

### 3.1 Development Sequence (UPDATED)
```diff
1. **Phase 1**: Core state management and event system
+ 1a. **Phase 1a**: Branch management and priority queue
2. **Phase 2**: UC1 validation engine
- 3. **Phase 3**: LLM integration and prompts
+ 3. **Phase 3**: LLM integration for extraction AND matching
4. **Phase 4**: Conflict detection and resolution
+ 4a. **Phase 4a**: Conflict isolation and partial branch movement
5. **Phase 5**: Form integration and autofill
6. **Phase 6**: Testing and optimization
```

---

## Summary of Changes in v1.0.1

1. **LLM Responsibilities Expanded**: Now handles both extraction and semantic matching (40% of operations)
2. **Code Simplified**: Only validates, doesn't match (60% of operations)
3. **State Management Enhanced**: Added branch tracking, priority queue, and conflict isolation
4. **Artifacts Restructured**: Both Respec and Mapped follow UC1.json hierarchical structure
5. **Processing Pipeline Rewritten**: Implements blocking priority for conflicts
6. **Form Updates Clarified**: Only specifications trigger immediate updates
7. **Branch Splitting Added**: Detailed logic for isolating conflicts while moving clean nodes
8. **New Classes Added**: BranchManager and PriorityQueueManager
9. **Event Types Expanded**: Added events for branch operations and priority management
10. **Autofill Renamed**: `generateAssumptions()` → `applyDefaults()` to reflect its true behavior

## Implementation Notes

- Priority system ensures conflicts are always resolved before new processing
- Branch splitting allows efficient queue clearing without blocking entire branches
- UC1-compliant structure ensures consistency across all artifacts
- Immediate form updates provide better user feedback
- Conflict isolation minimizes processing delays