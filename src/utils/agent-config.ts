import agentsConfigJson from "../config/agents-config.json";
import type { AgentConfig } from "./agent-config.types";

const FALLBACK_AGENT_CONFIG: AgentConfig = {
  maxSessionTurns: 12,
  model: "claude-opus-4-1-20250805",
  max_tokens: 1024,
  temperature: 0.3,
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const ensurePositiveInt = (value: unknown, fallback: number): number => {
  if (!isFiniteNumber(value)) return fallback;
  const normalized = Math.floor(value);
  return normalized > 0 ? normalized : fallback;
};

const ensureNumber = (value: unknown, fallback: number): number =>
  isFiniteNumber(value) ? value : fallback;

const mergeAgentConfig = (
  base: AgentConfig,
  overrides: Record<string, unknown> | undefined,
): AgentConfig => {
  const raw = overrides || {};
  return {
    maxSessionTurns: ensurePositiveInt(
      raw.maxSessionTurns,
      base.maxSessionTurns,
    ),
    model: isNonEmptyString(raw.model) ? raw.model.trim() : base.model,
    max_tokens: ensurePositiveInt(raw.max_tokens, base.max_tokens),
    temperature: ensureNumber(raw.temperature, base.temperature),
  };
};

export const parseAgentConfig = (
  input: unknown,
  agentKey?: string,
): AgentConfig => {
  if (!isPlainObject(input)) {
    return FALLBACK_AGENT_CONFIG;
  }

  const raw = input as Record<string, unknown>;
  const defaultConfig = mergeAgentConfig(
    FALLBACK_AGENT_CONFIG,
    isPlainObject(raw.default) ? raw.default : undefined,
  );

  if (!agentKey || !isPlainObject(raw[agentKey])) {
    return defaultConfig;
  }

  return mergeAgentConfig(
    defaultConfig,
    raw[agentKey] as Record<string, unknown>,
  );
};

export const DEFAULT_AGENT_CONFIG: AgentConfig =
  parseAgentConfig(agentsConfigJson);

export const loadAgentConfig = (agentKey?: string): AgentConfig =>
  parseAgentConfig(agentsConfigJson, agentKey);
