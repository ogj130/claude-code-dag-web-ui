import type { DispatchPromptResult, PromptInput } from '@/types/global-dispatch';

export interface GlobalTerminalRuntimeExecuteInput {
  sessionId: string;
  prompt: string;
}

export interface GlobalTerminalRuntimeExecuteResult {
  status: 'success' | 'failed';
  output?: string;
  reason?: string;
}

export interface GlobalTerminalRuntimeEvent {
  type: 'prompt_start' | 'prompt_end';
  sessionId: string;
  prompt: string;
  result?: GlobalTerminalRuntimeExecuteResult;
}

export interface RunGlobalTerminalRuntimeInput {
  sessionId: string;
  prompts: PromptInput[];
  executePrompt: (
    input: GlobalTerminalRuntimeExecuteInput,
  ) => Promise<GlobalTerminalRuntimeExecuteResult>;
  onEvent?: (event: GlobalTerminalRuntimeEvent) => void;
}

export interface GlobalTerminalRuntimeResult {
  status: 'success' | 'partial' | 'failed';
  promptResults: DispatchPromptResult[];
}

function resolveRuntimeStatus(
  promptResults: DispatchPromptResult[],
): GlobalTerminalRuntimeResult['status'] {
  const successCount = promptResults.filter(result => result.status === 'success').length;

  if (successCount === promptResults.length) {
    return 'success';
  }

  if (successCount === 0) {
    return 'failed';
  }

  return 'partial';
}

export async function runGlobalTerminalRuntime(
  input: RunGlobalTerminalRuntimeInput,
): Promise<GlobalTerminalRuntimeResult> {
  const promptResults: DispatchPromptResult[] = [];

  for (const item of input.prompts) {
    input.onEvent?.({
      type: 'prompt_start',
      sessionId: input.sessionId,
      prompt: item.prompt,
    });

    const executionResult = await input.executePrompt({
      sessionId: input.sessionId,
      prompt: item.prompt,
    });

    const promptResult: DispatchPromptResult = {
      prompt: item.prompt,
      status: executionResult.status,
      ...(executionResult.output ? { output: executionResult.output } : {}),
      ...(executionResult.reason ? { reason: executionResult.reason } : {}),
    };

    promptResults.push(promptResult);

    input.onEvent?.({
      type: 'prompt_end',
      sessionId: input.sessionId,
      prompt: item.prompt,
      result: executionResult,
    });
  }

  return {
    status: resolveRuntimeStatus(promptResults),
    promptResults,
  };
}
