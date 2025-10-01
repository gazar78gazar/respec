# API Contracts Documentation
*Current state after Sprint 1 Week 1 completion*

## UC1ValidationEngine

### Core Methods
```typescript
class UC1ValidationEngine {
  // Schema Management
  async loadSchema(schemaPath: string = '/uc1.json'): Promise<void>
  isReady(): boolean
  getMetadata(): UC1Metadata | null

  // Specification Access
  getSpecification(specId: string): UC1Specification | undefined
  getSpecificationsByRequirement(requirementId: string): UC1Specification[]

  // Hierarchy Navigation
  getHierarchy(nodeId: string): HierarchyPath | undefined
  getDomains(): UC1Domain[]
  getRequirementsByDomain(domainId: string): UC1Requirement[]

  // Validation
  validateSpecification(specId: string, value: any): ValidationResult
  detectConflicts(specifications: Array<{id: string, value: any}>): ConflictResult
  checkDependencies(requirementId: string, activeRequirements: string[]): ValidationResult
}
```

### Key Interfaces
```typescript
interface UC1Specification {
  id: string;
  name: string;
  parent: string[]; // CRITICAL: Required for ArtifactManager
  category: string;
  form_mapping?: {...};
  options?: string[];
  technical_details?: UC1TechnicalDetails;
}

interface ConflictResult {
  hasConflict: boolean;
  conflicts: Conflict[];
}

interface Conflict {
  type: 'logical' | 'constraint' | 'dependency' | 'cross-artifact';
  nodes: string[];
  description: string;
  resolution?: string;
}
```

## ArtifactManager

### Core Methods
```typescript
class ArtifactManager {
  constructor(uc1Engine: UC1ValidationEngine)

  // Lifecycle
  async initialize(): Promise<void>

  // State Access
  getState(): ArtifactState
  getRespecArtifact(): RespecArtifact
  getMappedArtifact(): MappedArtifact
  getUnmappedList(): UnmappedList
  getConflictList(): ConflictList

  // Specification Management
  async addSpecificationToMapped(
    spec: UC1Specification,  // MUST be real UC1Specification with parent[]
    value: any,
    originalRequest?: string,
    substitutionNote?: string
  ): Promise<void>

  // Conflict Management
  async detectConflicts(): Promise<ConflictResult>
  async resolveConflict(conflictId: string, resolutionId: string): Promise<void>

  // Movement Operations
  async moveNonConflictingToRespec(): Promise<void>
  async moveSpecificationsToRespec(
    specIds: string[],
    targetDomain?: string
  ): Promise<void>

  // Validation
  async validateArtifacts(): Promise<ArtifactValidationResult>
  async syncWithFormState(requirements: any): Promise<void>
}
```

### Key Data Structures
```typescript
interface ArtifactState {
  respec: RespecArtifact;      // Validated, coherent specifications
  mapped: MappedArtifact;      // LLM-matched, pending validation
  unmapped: UnmappedList;      // Unrecognized data nodes
  conflicts: ConflictList;     // Isolated conflicting nodes
  branchManagement: BranchManagement;
  priorityQueue: PriorityQueueState;
  initialized: boolean;
  lastSyncWithForm: Date;
}
```

## CompatibilityLayer

### Core Methods
```typescript
class CompatibilityLayer {
  constructor(artifactManager: ArtifactManager, uc1Engine: UC1ValidationEngine)

  // Bidirectional Sync
  syncArtifactToRequirements(requirements: LegacyRequirements): SyncResult
  syncRequirementsToArtifact(requirements: LegacyRequirements): SyncResult

  // Field Mapping
  getSpecIdFromField(section: string, field: string): string | undefined
  getFieldFromSpecId(specId: string): FieldMapping | undefined
  isFieldMapped(section: string, field: string): boolean

  // Validation
  validateSync(requirements: LegacyRequirements): {
    inSync: boolean;
    differences: Array<{...}>;
  }

  // Control
  enableSync(): void
  disableSync(): void
  isSyncEnabled(): boolean
}
```

### Field Mapping Structure
```typescript
interface FieldMapping {
  section: string;    // e.g., 'compute_performance'
  field: string;      // e.g., 'processor_type'
  specId: string;     // e.g., 'spc001'
  uc1Path: string;    // Full UC1 hierarchy path
}

// Current Mappings: 31 total
// Examples:
// compute_performance.processor_type → spc001
// form_factor.max_power_consumption → spc036
// io_connectivity.ethernet_ports → spc017
```

## App.tsx Integration

### State Management
```typescript
// New artifact state (additive to existing requirements)
const [artifactManager, setArtifactManager] = useState<ArtifactManager | null>(null);
const [compatibilityLayer, setCompatibilityLayer] = useState<CompatibilityLayer | null>(null);
const [artifactState, setArtifactState] = useState<ArtifactState | null>(null);

// Initialization (in useEffect)
await uc1ValidationEngine.loadSchema('/uc1.json');
const manager = new ArtifactManager(uc1ValidationEngine);
await manager.initialize();
const compatibility = new CompatibilityLayer(manager, uc1ValidationEngine);

// Sync Mechanism (in useEffect watching requirements)
const syncResult = compatibilityLayer.syncRequirementsToArtifact(requirements);
const conflictResult = await artifactManager.detectConflicts();
if (conflictResult.hasConflict) {
  // Display conflicts to user
}
```

## Conflict Detection Workflow

### Current Implementation
```typescript
// 1. Form Change Detected
form_update: {field: 'compute_performance.processor_type', value: 'Intel Core i9'}

// 2. Requirements State Updated
setRequirements(updated_requirements)

// 3. Compatibility Layer Sync Triggered
compatibilityLayer.syncRequirementsToArtifact(requirements)

// 4. UC1 Specification Lookup
const uc1Spec = uc1Engine.getSpecification('spc001')

// 5. Add to Mapped Artifact
artifactManager.addSpecificationToMapped(uc1Spec, 'Intel Core i9')

// 6. Conflict Detection
const conflicts = await artifactManager.detectConflicts()

// 7. User Notification
console.warn('🚨 Conflict: High-performance processor incompatible with low power consumption')
```

### Known Working Conflicts
```typescript
// Performance vs Power Consumption
Processors: ['Intel Core i5', 'Intel Core i7', 'Intel Core i9', 'Intel Xeon']
Power: ['< 10W', '10-20W']
→ Triggers logical conflict with resolution suggestions
```

## Testing & Validation

### Validation Scripts
- `test-uc1-validation-engine.cjs` - UC1 engine tests (5/5 passing)
- `test-state-management.cjs` - Integration tests (10/10 passing)
- `test-conflict-detection.cjs` - End-to-end validation (SUCCESS)

### Key Test Scenarios
1. **UC1 Schema Loading**: 56 specifications, 15 requirements, 3 domains
2. **Field Mapping**: 31 form fields → UC1 specifications
3. **Conflict Detection**: Intel Core i9 + < 10W → Logical conflict
4. **Requirements Sync**: Form changes → Artifact state updates
5. **Error Handling**: Non-blocking failures, existing functionality preserved

## Status: PRODUCTION READY ✅

Sprint 1 Week 1 complete. All systems operational for Sprint 1 Week 2: LLM Semantic Matching.