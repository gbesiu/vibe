// Single source of truth for selectable AI models (client dropdown + server validation).
export const AI_MODELS = [
  { label: "Claude Sonnet 4", value: "claude-sonnet-4-20250514" },
  { label: "Claude Sonnet 4.6", value: "claude-sonnet-4-6" },
  { label: "Claude Haiku 4.5 (fast)", value: "claude-haiku-4-5-20251001" },
  { label: "Claude Opus 4.8 (most capable)", value: "claude-opus-4-8" },
] as const;

export type AiModelValue = (typeof AI_MODELS)[number]["value"];

// Non-empty tuple for z.enum()
export const AI_MODEL_VALUES = AI_MODELS.map((m) => m.value) as [AiModelValue, ...AiModelValue[]];

export const DEFAULT_AI_MODEL: AiModelValue = "claude-sonnet-4-20250514";
