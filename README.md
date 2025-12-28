# ReSpec - Intelligent Requirements Extraction & Specification Tool

## 🎯 Project Overview

**ReSpec** is a React TypeScript application that transforms natural language requirements into validated, conflict-free technical specifications for industrial systems. It combines LLM intelligence (40%) for understanding and matching with deterministic code (60%) for validation and state management.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run TypeScript check (baseline: ~218 errors)
npx tsc --noEmit

# Run test suite
npm test
```


## 📁 Project Structure

```
Respec/
├── src/                          # Source code
│   ├── app.tsx                   # Main application component
│   ├── components/               # React components
│   └── services/                 # Business logic services
│       └── respec/               # ReSpec core services
│           ├── artifacts/        # Multi-artifact state management
│           ├── conflicts/        # Conflict detection services
│           ├── integration/      # Integration layer
│           ├── semantic/         # Semantic matching services
│           └── validation/       # UC1 validation engine
├── public/                       # Static assets
│   └── uc1.json                  # UC1 schema definitions
├── docs/                         # Complete project documentation
│   ├── README.md                 # Documentation overview (START HERE)
│   ├── Claude Code Development Instructions.md  # Development workflow
│   ├── plans/                    # Technical specifications & plans
│   │   ├── respec-functional-tech-spec.md      # Master implementation guide
│   │   ├── API_CONTRACTS.md                     # API contracts & interfaces
│   │   ├── communicateWithMas_tech_spec.md     # Communication layer spec
│   │   ├── SPRINT3_WEEK1_draft.md              # Sprint 3 Week 1 findings
│   │   └── UC1_transcripts.md                   # UC1 schema documentation
│   ├── sprints+fixes/            # Sprint completion records & fixes
│   │   ├── DEVELOPMENT_SUMMARY_SPRINT1-2.md
│   │   ├── SPRINT2_WEEK1_COMPLETION.md
│   │   ├── SPRINT2_WEEK2_COMPLETION.md
│   │   └── [fix documentation files]
│   └── tests/                    # Testing protocols & reports
│       ├── TESTING_PROTOCOL_SPRINT2.md
│       ├── TEST_REPORT_SPRINT2_WEEK1.md
│       └── DEBUG_INSTRUCTIONS.md
└── test-*.cjs                    # Automated test scripts

```

Refactored UI and services live under `src/refactored/`:
- `src/refactored/app.tsx` is the refactored UI entry (not wired to `src/main.tsx`).
- `src/refactored/services` contains the refactored pipeline and artifact/conflict services.
- `src/refactored/types` holds shared types for the refactored code path.

## 📚 Documentation

### 🎓 Getting Started (Read in Order)

1. **[docs/README.md](./docs/README.md)** - Documentation overview and project context
2. **[docs/Claude Code Development Instructions.md](./docs/Claude%20Code%20Development%20Instructions.md)** - Development workflow and patterns
3. **[docs/plans/respec-functional-tech-spec.md](./docs/plans/respec-functional-tech-spec.md)** - Master implementation guide (Sprint 1-4)

### 📋 Technical Specifications

- **[docs/plans/API_CONTRACTS.md](./docs/plans/API_CONTRACTS.md)** - Complete API contracts and interfaces
- **[docs/plans/communicateWithMas_tech_spec.md](./docs/plans/communicateWithMas_tech_spec.md)** - Bidirectional communication architecture
- **[docs/plans/UC1_transcripts.md](./docs/plans/UC1_transcripts.md)** - UC1 schema documentation and field mappings

### 🏃 Sprint Documentation

- **[docs/sprints+fixes/DEVELOPMENT_SUMMARY_SPRINT1-2.md](./docs/sprints+fixes/DEVELOPMENT_SUMMARY_SPRINT1-2.md)** - Sprint 1-2 overview
- **[docs/sprints+fixes/SPRINT2_WEEK1_COMPLETION.md](./docs/sprints+fixes/SPRINT2_WEEK1_COMPLETION.md)** - Sprint 2 Week 1 completion report
- **[docs/sprints+fixes/SPRINT2_WEEK2_COMPLETION.md](./docs/sprints+fixes/SPRINT2_WEEK2_COMPLETION.md)** - Sprint 2 Week 2 completion report
- **[docs/plans/SPRINT3_WEEK1_draft.md](./docs/plans/SPRINT3_WEEK1_draft.md)** - Sprint 3 Week 1 code analysis and findings

### 🧪 Testing & Debugging

- **[docs/tests/TESTING_PROTOCOL_SPRINT2.md](./docs/tests/TESTING_PROTOCOL_SPRINT2.md)** - Complete testing protocol
- **[docs/tests/DEBUG_INSTRUCTIONS.md](./docs/tests/DEBUG_INSTRUCTIONS.md)** - Debug system usage guide
- **[docs/tests/TEST_REPORT_SPRINT2_WEEK1.md](./docs/tests/TEST_REPORT_SPRINT2_WEEK1.md)** - Sprint 2 Week 1 test results
- **Root test-*.cjs files** - Automated test scripts for validation

## ?? Current Status (December 2025)

- Active entrypoint: `src/main.tsx` renders `src/app.tsx` (legacy UI and services in `src/services/respec`).
- Refactored UI and services live in `src/refactored` and are not wired to the default entrypoint.
- Refactored pipeline uses a UC8-only data layer (`/uc_8.0_2.2.json`) plus centralized conflict detection/resolution in `src/refactored/services/ConflictResolver.ts`.
- TypeScript baseline: ~218 errors (maintained).

## ??? Architecture Overview

### Pipelines

Legacy (current app)
- `src/app.tsx` uses `src/services/respec/SimplifiedRespecService` and the UC1/UC8 hybrid services.

Refactored (in progress)
- `src/refactored/app.tsx` uses `src/refactored/services/RespecService`.
- `AnthropicService` extracts requirements and parses conflict responses.
- `SemanticIntegrationService` routes extracted requirements into `SemanticMatchingService`.
- `ArtifactManager` owns artifact state and defers conflict detection/resolution planning to `ConflictResolver`.
- `ConflictResolver` detects exclusions, field overwrites, cascades, and field constraint conflicts, and returns resolution options/plans.

### Refactored Processing Flow

1. `RespecService.processChatMessage` -> `AnthropicService.analyzeRequirements`
2. `SemanticIntegrationService.processExtractedRequirements` -> `SemanticMatchingService.matchExtractedNodesToUC`
3. `ArtifactManager.addSpecificationToMapped` -> `ConflictResolver.detectAllConflictsForSpecification`
4. If conflicts: `AnthropicService.handleConflictResolution` -> `ArtifactManager.resolveConflict`
5. If no conflicts: `ArtifactManager.moveNonConflictingToRespec` -> `ArtifactManager.generateFormUpdatesFromRespec`

Manual form edits in the refactored UI map field values back to UC8 specs
(by `selected_value` or `name`) and run conflict detection so A/B resolutions
stay aligned with `option-a` and `option-b` IDs.

## 🧪 Testing

### Automated Tests

```bash
# Run all test scripts
npm test

# Individual test scripts (in root folder)
node test-sprint2-week1-validation.cjs
node test-sprint2-week2-artifact-population.cjs
node test-sprint2-week2-runtime-flow.cjs
node test-semantic-matching.cjs
node test-conflict-detection.cjs
```

### Manual Test Scenarios

```bash
# Start dev server
npm run dev

# Test in browser chat:
1. "I need 500GB storage" → Should update form with storage_capacity
2. "High performance processor" → Should add to specifications
3. "High performance with minimal power" → Should detect conflict
4. Chat history should maintain context
```

## 🚨 Critical Development Rules

### Must Maintain
- TypeScript error baseline: ~218 errors (DO NOT FIX unrelated errors)
- Four-phase implementation pattern
- Console-based debugging only
- Bidirectional chat-form synchronization
- Refactored services: conflict detection/resolution planning lives in `src/refactored/services/ConflictResolver.ts`, and `ArtifactManager` applies plans and mutates artifacts.
- Shared refactored service types live in `src/refactored/types/*.types.ts` (notably `service.types.ts` and `semantic.types.ts`).

### Never Do
- Fix unrelated TypeScript errors
- Add UI debug overlays (console only)
- Break existing bidirectional communication
- Create new files unless absolutely necessary
- Merge the four artifacts (respec, mapped, unmapped, conflicts)
- Let respec artifact contain conflicts
- Skip conflict detection after artifact updates

## 🔑 Key Technologies

- **React 18** with TypeScript
- **Vite** for build tooling
- **Anthropic Claude API** for LLM processing
- **Tailwind CSS** for styling
- **UC datasets** in `public/` (`uc1.json`, `uc_8.0_2.2.json`) for schema-driven matching and validation

## 📞 Development Workflow

1. **Before starting**: Read [docs/Claude Code Development Instructions.md](./docs/Claude%20Code%20Development%20Instructions.md)
2. **Check current state**: Run `npm run dev` and manual tests
3. **Verify baseline**: Run `npx tsc --noEmit` (should show ~218 errors)
4. **Plan implementation**: Break work into phases
5. **Test continuously**: Run test scripts after changes
6. **Document changes**: Update relevant docs in `docs/` folder

## ?? Next Steps

- Legacy pipeline planning lives in `docs/plans/` (see `docs/plans/respec-functional-tech-spec.md`).
- Refactored pipeline work is tracked in `src/refactored/services` and tests under `src/refactored/services/__tests__`.

---

**Version**: 3.0
**Last Updated**: December 28, 2025
**Current Focus**: Refactored services and conflict resolution flow in `src/refactored`

For questions or issues, see the comprehensive documentation in the `docs/` folder.


