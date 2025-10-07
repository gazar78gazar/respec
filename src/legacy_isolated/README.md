# Legacy Isolated Code

This folder contains deprecated code that has been replaced by newer implementations but is kept for reference or temporary compatibility.

## Files in this Folder

### ConflictDetectionService.ts
**Status**: DEPRECATED (Sprint 3 Week 1)
**Replaced By**: `ArtifactManager.detectConflicts()` + `UC1ValidationEngine` conflict detection methods
**Reason**: Field-level conflict detection was replaced with artifact-level, UC1-schema-aware conflict detection

**Original Purpose**:
- Field-by-field conflict detection for form updates
- Low-confidence extraction warnings
- Value change notifications

**Why Deprecated**:
- Not integrated with multi-artifact system
- Focused on form fields instead of UC1 specifications
- Sprint 2 Week 2 introduced ArtifactManager-based conflict detection
- Sprint 3 Week 1 completed all conflict types in UC1ValidationEngine

**Current Usage**:
- Imported by SimplifiedRespecService.ts (line 10) - Not actively used
- Imported by app.tsx - Not actively used
- Imported by ConflictPanel.tsx - Not actively used

**Migration Path**:
If you need conflict detection, use:
```typescript
// New approach (Sprint 3 Week 1)
const artifactManager = new ArtifactManager(uc1Engine);
await artifactManager.detectConflicts(); // Returns all conflict types

// Access conflict data
const state = artifactManager.getState();
const activeConflicts = state.conflicts.active;
```

**Removal Timeline**:
- Sprint 3 Week 1: Moved to legacy_isolated/
- Sprint 4: Update imports to remove references
- Post-Sprint 4: Delete file entirely

---

**Last Updated**: October 3, 2025
**Sprint**: Sprint 3 Week 1
