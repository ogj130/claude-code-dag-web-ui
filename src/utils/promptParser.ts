import type { GlobalInputMode, PromptInput } from '@/types/global-dispatch';

export function parsePromptInput(raw: string): {
  mode: GlobalInputMode;
  prompts: PromptInput[];
} {
  const lines = raw
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    throw new Error('Prompt input is empty');
  }

  return {
    mode: lines.length === 1 ? 'single' : 'list',
    prompts: lines.map(prompt => ({ prompt })),
  };
}
