# ReSpec - Requirements to UC8 Specifications

## Project Overview
ReSpec is a React + TypeScript single-page app that turns natural-language requirements into UC8-aligned specifications for industrial systems. LLM extraction provides the intent and field signals, while deterministic services handle matching, validation, conflict detection, and artifact state. LLM calls split between threaded, session-backed extraction for stateful agents (ConversationService + SessionStore) and stateless matching calls (SemanticExtractor).

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
- `src/config/`: form field definitions, grouping metadata, UC8 dataset, and agent config JSON
- `src/services/`: orchestration, agents, matching, artifacts, conflicts, data layer, exports
- `src/services/agents/`: LLM role agents (PreSaleEngineer, SemanticExtractor)
- `src/services/interfaces/StatefulAgent.ts`: agent interface for session init + IDs
- `src/services/ConversationService.ts`: threaded Anthropic calls with session history
- `src/services/interfaces/SessionStore.ts` / `src/services/LocalSessionStore.ts`: session history persistence
- `src/services/interfaces/PromptProvider.ts`: prompt provider interface for system prompts
- `src/services/prompts/`: prompt provider abstractions
- `src/config/prompts/`: markdown system prompts
- `src/types/`: form-state, artifacts, conflicts, semantic, service, UC data types
- `src/utils/`: form mapping, validation, and UI helpers
- `src/utils/agent-config.ts` / `src/utils/agent-config.types.ts`: agent config parsing + defaults
- `src/styles/`: shared UI styles
- `src/config/uc_8.0_2.2.json`: UC8 dataset (spec-only)

## Runtime Flow
1. `App` loads UC8 data via `ucDataLayer.load()` and initializes `RespecService` and `ArtifactManager`.
2. Chat message -> `RespecService.processChatMessage` -> `PreSaleEngineer.analyzeRequirements` (threaded via `ConversationService` + `SessionStore` using the agent-owned session ID).
3. `SemanticIntegrationService` converts extractions to nodes and calls `SemanticExtractor` (stateless) for P## matches.
4. `ArtifactManager` adds specifications to mapped, runs `ConflictResolver`, and promotes non-conflicting specs to respec.
5. Form updates are generated from respec and applied back to the UI; conflicts surface A/B resolution prompts.

## LLM Session Model
- **Threaded extraction**: `PreSaleEngineer` uses `ConversationService` with `SessionStore` and an agent-owned session ID to retain chat context.
- **Stateless matching**: `SemanticExtractor` and conflict parsing call `AnthropicService` directly to keep matching isolated (SemanticExtractor reads `VITE_LLM_*`).
- **Session limits**: History is stored in localStorage and trimmed to `maxSessionTurns` from `src/config/agents-config.json`; no backend persistence.
- **Testing**: `npm test` covers session behavior in `src/services/__tests__/ConversationService.test.ts` and `src/services/__tests__/LocalSessionStore.test.ts`.

## Form State and Terminology
- Form state lives in `src/types/form-state.types.ts` as `Requirements` and `RequirementFieldState`.
- UI and services still use "requirements" naming for form fields, but those values map to UC8 specifications (P##) in the data layer.

## Conflict Handling
- Supported conflict types: `field_overwrite`, `exclusion`, `cascade`, `field_constraint`.
- Respec artifact stays conflict-free; conflicts are resolved before promotion.

## Configuration and Data
- UC8 dataset must load before matching or artifact operations (`src/config/uc_8.0_2.2.json`).
- Anthropic is the only LLM client in use; provider flags like `VITE_LLM_PROVIDER` are currently ignored.
- Anthropic API access uses `VITE_ANTHROPIC_API_KEY` for SDK initialization.
- Stateful agent settings live in `src/config/agents-config.json` (model, max_tokens, temperature, maxSessionTurns) and are loaded at agent init via `src/utils/agent-config.ts`.
- Stateful agents own their session IDs; `ConversationService` persists and trims session history to `maxSessionTurns`.
- `SemanticExtractor` still reads `VITE_LLM_MODEL`, `VITE_LLM_MAX_TOKENS`, and `VITE_LLM_TEMPERATURE` for its stateless matching calls (defaults apply if unset).
- Stateless LLM calls (semantic matching and conflict parsing) go directly through `AnthropicService` without session history.
- System prompts live in `src/config/prompts/*.md` and are loaded via `LocalPromptProvider` (Vite `?raw` imports) for easy future backend swapping.
- Without `VITE_ANTHROPIC_API_KEY`, LLM extraction falls back to empty responses and semantic matching is skipped.
- Session history is persisted per agent via `SessionStore`/`LocalSessionStore` in browser localStorage; there is no backend service.

## Testing
- `npm run dev` for manual UI checks.
- `npm test` runs Vitest suites in `src/services/__tests__`.
- `npm run test:ui` and `npm run test:coverage` are also available.
- Husky pre-commit runs `npm run format`, `npm run lint`, `npm run ts:check`, and `npm test -- --run`.

## Documentation
- This README is the single documentation entrypoint for the repo.
