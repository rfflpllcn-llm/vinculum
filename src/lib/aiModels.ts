export type AiModelOption = {
  value: string;
  label: string;
  provider: 'openai' | 'anthropic';
};

export const AI_MODEL_OPTIONS: AiModelOption[] = [
  { value: 'gpt-5.2', label: 'GPT-5.2', provider: 'openai' },
  { value: 'claude-opus-4.5', label: 'Claude Opus 4.5', provider: 'anthropic' },
  { value: 'claude-sonnet-4.5', label: 'Claude Sonnet 4.5', provider: 'anthropic' },
  { value: 'claude-haiku-4.5', label: 'Claude Haiku 4.5', provider: 'anthropic' },
];

export const DEFAULT_AI_MODEL = AI_MODEL_OPTIONS[0]?.value ?? 'gpt-4';
