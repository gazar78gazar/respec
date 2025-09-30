# PRD Addendum v2.0.1 Update Recommendations
**Date**: January 30, 2025  
**From Version**: 2.0.0  
**To Version**: 2.0.1

---

## Key Updates to Addendum

### Section 2.2 Stage 2: Matching Process
**REPLACE entire matching algorithm with:**

```
EXTRACTED NODES → LLM MATCHING → CODE VALIDATION
```

**Matching Algorithm**:
```
For each extracted_node:
  1. LLM determines node type and attempts semantic matching to UC1
  
  2. If SPECIFICATION:
     - LLM finds best match in UC1 specifications
     - Code validates match against allowed options
     - If valid → Update form field immediately + Add to matched_specifications
     - If invalid → Add to Extracted Data nodes list
  
  3. If REQUIREMENT:
     - LLM matches to UC1 requirements semantically
     - Code validates parent domain exists
     - Process ALL child specifications (recursive)
     - Invalid → Add to Extracted Data nodes list
  
  4. If DOMAIN:
     - LLM matches to UC1 domains semantically
     - Process ALL child requirements (recursive)
     - No match → Add to unmapped list

NOTE: LLM performs ALL matching operations, code only validates
```

### Section 4.2 Mapped Artifact
**REPLACE the Processing section with:**

**Processing**:
```
1. Receive matched branches from LLM
2. Copy entire branch including all descendants
3. Code parses for conflicts:
   - Inherent conflicts (mutex, constraints)
   - Conflicts against respec artifact
   
4. Branch Resolution Logic:
   IF no conflicts detected:
      → Move entire branch to respec
   
   IF conflicts detected:
      → Move ONLY conflicting nodes + descendants to conflict list
      → Move non-conflicting nodes to respec IF:
         - Not already in respec (no duplication)
         - At same or higher hierarchy than conflict
         - No mutex relationships
   
   Example:
   req001 (branch root)
   ├── spc001 (no conflict) → moves to respec
   ├── spc002 (no conflict) → moves to respec
   ├── spc003 (CONFLICT!) → moves to conflict list
   │   └── spc003.child → moves with parent to conflict
   └── spc004 (no conflict) → moves to respec
```

### Section 4.4 Conflict List
**UPDATE Structure description:**

**Structure**:
```json
{
  "active": [
    {
      "id": "CONF-XXX-001",
      "conflictingNodes": ["spc003", "spc003.child"],
      "type": "constraint|mutex|dependency|cross-artifact",
      "cycle": 0
    }
  ],
  "pending": [],
  "resolved": [],
  "escalated": []
}
```

**Note**: Conflict list contains individual nodes, not full branches

### Section 6.1 Branch Processing
**REPLACE entire section with:**

### 6.1 Branch Processing Rules

```
Partial Branch Movement Example:

ORIGINAL BRANCH:
req001 (Real-Time Thermal Imaging)
├── spc001 (processor_type) 
├── spc002 (memory_capacity)
├── spc003 (storage_type) ← CONFLICT with budget constraint
├── spc004 (storage_capacity) ← Child of conflict
├── spc005 (response_latency)
└── spc006 (throughput_fps)

AFTER CONFLICT DETECTION:
To Respec:                    To Conflict List:
req001                        spc003
├── spc001                    └── spc004
├── spc002                    
├── spc005
└── spc006

Rules:
1. Non-conflicting nodes move to respec immediately
2. Conflicting nodes + descendants move to conflict list
3. Branch integrity is secondary to coherence
4. No duplication - skip nodes already in respec
```

### Section 6.2 Conflict Cycle Management
**ADD clarification:**

```
For each nodeId in conflict list:
  cycle_count in conflict_cycles map
  
  On conflict detection:
    cycle_count++
    
    IF cycle_count >= 3:
      Auto-resolve:
        - Move ONLY the conflicting node + descendants to unmapped
        - Do NOT move entire original branch
        - Clear from conflict list
        - Notify: "Conflicting specifications moved to custom items"
```

### Section 7.1 Stateless Extraction LLM Operations
**UPDATE to clarify:**

- Each extraction AND matching call is independent
- LLM performs semantic matching to UC1
- No memory between LLM calls
- Fresh UC1 context provided each time for matching

---

## Summary of Changes in v2.0.1

1. **LLM Role Clarified**: Handles both extraction AND semantic matching
2. **Branch Splitting Explicit**: Detailed examples of partial branch movement
3. **Conflict List Structure**: Shows it contains nodes, not branches
4. **Immediate Form Updates**: Confirmed upon specification match
5. **Resolution Priority**: Non-conflicting parts move to respec immediately
6. **Duplication Prevention**: Explicit rule to skip existing respec nodes
7. **Branch Integrity**: Explicitly stated as secondary to coherence

## Implementation Note

These updates prioritize:
- **System coherence** over branch integrity
- **Immediate resolution** of non-conflicting portions
- **Efficient queue clearing** through partial movements
- **Conflict isolation** to minimize blocked processing