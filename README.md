# ReSpec - Requirements to UC8 Specifications

## Project Overview
ReSpec is a React + TypeScript single-page app that turns natural-language requirements into UC8-aligned specifications for industrial systems. LLM extraction provides the intent and field signals, while deterministic services handle matching, validation, conflict detection, and artifact state. LLM calls split between threaded, session-backed extraction for stateful agents (ConversationService + SessionStore) and stateless conflict parsing calls via AnthropicService.

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
- `src/services/agents/`: LLM role agents (PreSaleEngineer)
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
3. `RespecService` returns form updates from extracted requirements; the UI applies them.
4. Agent selections are synced into the mapped artifact and exclusion conflicts are checked before returning updates, so conflicts can surface immediately.
5. Form updates (manual/system/autofill) call `RespecService.processFormUpdate`, which syncs selections into `ArtifactManager`, removes cleared entries, promotes non-conflicting specs to respec, auto-adds dependencies as assumptions, and returns respec delta updates so the form stays aligned.
6. When conflicts are active, `ArtifactManager` supplies the A/B prompt and `RespecService` parses responses locally, falling back to `PreSaleEngineer` only when replies are ambiguous.

## LLM Session Model
- **Threaded extraction**: `PreSaleEngineer` uses `ConversationService` with `SessionStore` and an agent-owned session ID to retain chat context.
- **Optional conflict parsing**: `PreSaleEngineer` uses `AnthropicService` only to interpret ambiguous A/B conflict replies.
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
- Conflict-choice parsing (when needed) goes directly through `AnthropicService` without session history.
- System prompts live in `src/config/prompts/*.md` and are loaded via `LocalPromptProvider` (Vite `?raw` imports) for easy future backend swapping.
- Without `VITE_ANTHROPIC_API_KEY`, LLM extraction falls back to empty responses and ambiguous conflict replies reuse the original A/B question.
- Session history is persisted per agent via `SessionStore`/`LocalSessionStore` in browser localStorage; there is no backend service.

## Testing
- `npm run dev` for manual UI checks.
- `npm test` runs Vitest suites in `src/services/__tests__`.
- `npm run test:ui` and `npm run test:coverage` are also available.
- Husky pre-commit runs `npm run format`, `npm run lint`, `npm run ts:check`, and `npm test -- --run`.

## Documentation
- This README is the single documentation entrypoint for the repo.
