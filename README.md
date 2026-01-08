# ReSpec - Requirements to UC8 Specifications

## Project Overview
ReSpec is a React + TypeScript single-page app that turns natural-language requirements into UC8-aligned specifications for industrial systems. LLM extraction provides the intent and field signals, while deterministic services handle matching, validation, conflict detection, and artifact state.

The UC8 dataset in this repo is spec-only:
- P## specification nodes
- C## standalone comments
- spec-to-spec exclusions
Scenario and requirement nodes are not part of the dataset.

## Quick Start
```bash
npm install
npm run dev
npm run ts:check
npm test
```

## Project Structure
- `src/main.tsx`: entrypoint that renders the app
- `src/app.tsx`: main application component and MAS bridge
- `src/components/`: chat UI, form UI, conflict UI, progress UI
- `src/config/`: form field definitions and grouping metadata
- `src/services/`: orchestration, agents, matching, artifacts, conflicts, data layer, exports
- `src/services/agents/`: LLM role agents (PreSaleEngineer, SemanticExtractor)
- `src/services/prompts/`: prompt provider abstractions
- `src/config/prompts/`: markdown system prompts
- `src/types/`: form-state, artifacts, conflicts, semantic, service, UC data types
- `src/utils/`: form mapping, validation, and UI helpers
- `src/styles/`: shared UI styles
- `public/uc_8.0_2.2.json`: UC8 dataset (spec-only)

## Runtime Flow
1. `App` loads UC8 data via `ucDataLayer.load()` and initializes `RespecService` and `ArtifactManager`.
2. Chat message -> `RespecService.processChatMessage` -> `PreSaleEngineer.analyzeRequirements`.
3. `SemanticIntegrationService` converts extractions to nodes and calls `SemanticExtractor` for P## matches.
4. `ArtifactManager` adds specifications to mapped, runs `ConflictResolver`, and promotes non-conflicting specs to respec.
5. Form updates are generated from respec and applied back to the UI; conflicts surface A/B resolution prompts.

## Form State and Terminology
- Form state lives in `src/types/form-state.types.ts` as `Requirements` and `RequirementFieldState`.
- UI and services still use "requirements" naming for form fields, but those values map to UC8 specifications (P##) in the data layer.

## Conflict Handling
- Supported conflict types: `field_overwrite`, `exclusion`, `cascade`, `field_constraint`.
- Respec artifact stays conflict-free; conflicts are resolved before promotion.

## Configuration and Data
- UC8 dataset must load before matching or artifact operations (`public/uc_8.0_2.2.json`).
- Anthropic is the only LLM client in use; provider flags like `VITE_LLM_PROVIDER` are currently ignored.
- LLM configuration uses `VITE_ANTHROPIC_API_KEY`, `VITE_LLM_MODEL`, `VITE_LLM_MAX_TOKENS`, and `VITE_LLM_TEMPERATURE` (defaults apply if unset).
- System prompts live in `src/config/prompts/*.md` and are loaded via `LocalPromptProvider` (Vite `?raw` imports) for easy future backend swapping.
- Without `VITE_ANTHROPIC_API_KEY`, LLM extraction falls back to empty responses and semantic matching is skipped.
- Session history and project exports use browser localStorage; there is no backend service.

## Testing
- `npm run dev` for manual UI checks.
- `npm test` runs Vitest suites in `src/services/__tests__`.
- `npm run test:ui` and `npm run test:coverage` are also available.

## Documentation
- This README is the single documentation entrypoint for the repo.
