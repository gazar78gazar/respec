# PRD v1.0.1 Update Recommendations
**Date**: January 30, 2025  
**From Version**: 1.0.0  
**To Version**: 1.0.1

---

## Updates to Main PRD Document

### Section 4.1 Data Extraction (LLM-Powered)
**UPDATE FR-001 and FR-002 to clarify LLM role:**

**FR-001**: Extract and match data nodes from unstructured user input
- Parse natural language for technical specifications
- **Match extracted nodes to UC1 schema using semantic similarity (LLM)**
- Identify domains, requirements, and specifications
- Maintain context across multi-turn conversations

**FR-002**: ~~Match extracted nodes to UC1.json schema~~ **Validate matched nodes against UC1.json constraints**
- ~~Fuzzy matching for specification identification~~ **Code validates LLM matches**
- Hierarchical relationship preservation
- Confidence scoring for matches

### Section 4.2 Conflict Detection (Code-Based)
**ADD new functional requirement FR-003a:**

**FR-003a**: Partial branch resolution
- When conflicts detected, isolate conflicting nodes and descendants
- Move non-conflicting portions of branch to respec if:
  - No mutex conflicts exist
  - No conflicts with existing respec data
  - Node is at same or higher hierarchy level than conflict
- Conflicting nodes and their descendants move to conflict list only

### Section 4.4 Data Management (Code-Based)
**UPDATE FR-007 to clarify artifact behaviors:**

**FR-007**: Maintain four artifact lists with specific movement rules
- **Respec Artifact**: Validated, coherent specifications (accepts partial branches)
- **Mapped Artifact**: Successfully matched specifications (allows internal conflicts)
- **Unmapped List**: Unrecognized data nodes
- **Conflict List**: Individual conflicting nodes (not full branches)

**ADD FR-007a**: Branch movement rules
- Branches can be split during conflict resolution
- Non-conflicting portions move independently to respec
- Already existing nodes in respec are skipped (no duplication)
- Priority is coherence over branch integrity

### Section 4.5 Form Integration
**UPDATE FR-009 to specify timing:**

**FR-009**: ~~Progressive~~ **Immediate** form population
- **Immediate field updates upon specification match**
- Visual progress indicator (X/37 fields complete)
- 70% completion threshold monitoring

### Section 5.1 Performance (NFR)
**ADD NFR-001a**: Processing priorities
- Conflict resolution has blocking priority
- System halts new input processing when conflicts exist
- Mapped artifact clearing occurs after conflict resolution
- New input processing resumes only when queues are clear

### Section 8. Technical Constraints
**UPDATE Architecture Decisions:**

| Decision | Original | Updated |
|----------|----------|---------|
| LLM Role | Extraction only | **Extraction AND Matching** |
| Code Role | Validation and routing | **Validation only (not matching)** |
| Autofill | LLM-assisted | **Pure code-based** |
| Branch Integrity | Maintained | **Can be split for conflict resolution** |

---

## Change Summary for PRD v1.0.1

1. **LLM Responsibilities Expanded**: Now handles both extraction and semantic matching
2. **Code Responsibilities Refined**: Focuses on validation, not matching
3. **Form Updates**: Clarified as immediate upon match
4. **Branch Splitting Allowed**: Partial branches can move to respec
5. **Conflict List Behavior**: Contains only conflicting nodes, not branches
6. **Priority Queue**: Added blocking behavior for conflicts
7. **Autofill**: Confirmed as purely algorithmic