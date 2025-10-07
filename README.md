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

## 🎯 Current Status (October 2025)

### ✅ Completed (Sprint 1 & Sprint 2)

**Sprint 1: Foundation** ✅
- Multi-artifact state structure (respec, mapped, unmapped, conflicts)
- UC1ValidationEngine for schema handling
- Basic ArtifactManager structure
- Compatibility layer for existing code

**Sprint 2: LLM Semantic Matching** ✅
- **Week 1**: Semantic matching and routing layer
  - SemanticMatchingService (stateless UC1 matcher)
  - SemanticIntegrationService_NEW (routing layer)
  - Enhanced AnthropicService prompts
  - Form update preservation
- **Week 2**: Artifact population and conflict detection wiring
  - Artifact population methods (addSpecificationToMapped, addRequirementToMapped, addDomainToMapped)
  - Conflict detection triggering
  - System blocking when conflicts detected
  - Basic conflict detection framework

### 🚀 Current Sprint: Sprint 3 - Conflict Detection & Resolution

**Sprint 3 Week 1: Enhanced Conflict Detection** (READY TO START)
- Enhance UC1ValidationEngine with complete conflict types
- Add cross-artifact conflict checking (mapped vs respec)
- Complete applyConflictResolution() with safety policies
- Structure conflict data for agent consumption
- Return conflict data to SimplifiedRespecService → AnthropicService
- Deprecate legacy ConflictDetectionService

**Sprint 3 Week 2: Agent-Driven Resolution Flow** (Future)
- Agent semantic parsing of user resolution responses (A/B)
- Agent-orchestrated conflict resolution
- Priority queue management
- Cycle management (3 attempts max)

### 📊 Progress Metrics

- **Overall Progress**: 35% complete (14/40 days)
- **Sprint 1**: 100% ✅
- **Sprint 2 Week 1**: 100% ✅
- **Sprint 2 Week 2**: 100% ✅
- **Sprint 3 Week 1**: 0% (Ready to begin)
- **TypeScript Baseline**: 218 errors (maintained)

## 🏗️ Architecture Overview

### Three-Layer Architecture

```
┌────────────────────────────────────────────┐
│         ORCHESTRATION LAYER                │
│       SimplifiedRespecService              │
│  (Session context, conversation history)   │
└────────────────┬───────────────────────────┘
                 ↓
┌────────────────────────────────────────────┐
│         PROCESSING LAYER                   │
├────────────────┬───────────────────────────┤
│  Extraction    │  Matching & Routing       │
│ AnthropicServ. │ SemanticMatchingService   │
│ (Stateful LLM) │ (Stateless LLM) +         │
│                │ SemanticIntegrationService│
└────────────────┴───────────────────────────┘
                 ↓
┌────────────────────────────────────────────┐
│      STATE MANAGEMENT LAYER                │
├──────────┬─────────┬──────────┬────────────┤
│Artifacts │Conflicts│   UC1    │   Form     │
│Manager   │Detection│Validation│  Updates   │
└──────────┴─────────┴──────────┴────────────┘
```

### Processing Flow

```
User Input → SimplifiedRespecService.processChatMessage()
    ↓
AnthropicService.analyzeRequirements() (Extraction)
    ↓
SemanticIntegrationService.processMessage() (Routing)
    ↓
SemanticMatchingService.matchToUC1() (Matching)
    ↓
ArtifactManager.addToMapped() (State Update)
    ↓
ArtifactManager.detectConflicts() (Validation)
    ↓
If NO conflicts: moveToRespec() + updateForm()
If CONFLICT: isolateConflict() + generateQuestion()
```

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
- **UC1.json** for schema-driven validation

## 📞 Development Workflow

1. **Before starting**: Read [docs/Claude Code Development Instructions.md](./docs/Claude%20Code%20Development%20Instructions.md)
2. **Check current state**: Run `npm run dev` and manual tests
3. **Verify baseline**: Run `npx tsc --noEmit` (should show ~218 errors)
4. **Plan implementation**: Break work into phases
5. **Test continuously**: Run test scripts after changes
6. **Document changes**: Update relevant docs in `docs/` folder

## 🎯 Next Steps

To continue development on **Sprint 3 Week 1**, see:
- **[docs/plans/respec-functional-tech-spec.md](./docs/plans/respec-functional-tech-spec.md)** - Lines 389-432 (Sprint 3 Week 1 tasks)
- **[docs/plans/SPRINT3_WEEK1_draft.md](./docs/plans/SPRINT3_WEEK1_draft.md)** - Detailed code analysis and implementation plan

---

**Version**: 3.0
**Last Updated**: October 3, 2025
**Current Sprint**: Sprint 3 Week 1 (Conflict Detection Enhancement)

For questions or issues, see the comprehensive documentation in the `docs/` folder.
