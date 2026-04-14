import { useState, useEffect } from 'react';
import type { ModelConfig, WorkspacePreset } from '@/types/models';
import type { ModelOptions } from '@/types/events';

export interface UseWorkspaceModelConfigResult {
  preset: WorkspacePreset | null;
  config: ModelConfig | null;
  isLoading: boolean;
  reload: () => Promise<void>;
}

/**
 * 根据工作目录自动获取对应的模型配置
 */
export function useWorkspaceModelConfig(
  workspacePath: string | null
): UseWorkspaceModelConfigResult {
  const [preset, setPreset] = useState<WorkspacePreset | null>(null);
  const [config, setConfig] = useState<ModelConfig | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!workspacePath) {
      setPreset(null);
      setConfig(null);
      return;
    }

    loadPreset();
  }, [workspacePath]);

  async function loadPreset() {
    if (!workspacePath) return;

    setIsLoading(true);
    try {
      // 1. 查询该工作目录的预设
      const preset = await window.electron.invoke(
        'workspace-preset:get-by-path',
        workspacePath
      ) as WorkspacePreset | undefined;

      if (!preset || !preset.configId || !preset.isEnabled) {
        setPreset(null);
        setConfig(null);
        setIsLoading(false);
        return;
      }

      setPreset(preset);

      // 2. 获取预设引用的配置
      const configs = await window.electron.invoke('model-config:get-all') as ModelConfig[];
      const config = configs.find(c => c.id === preset.configId);

      setConfig(config || null);
    } catch (error) {
      console.error('[useWorkspaceModelConfig] Failed to load preset:', error);
      setPreset(null);
      setConfig(null);
    } finally {
      setIsLoading(false);
    }
  }

  return {
    preset,
    config,
    isLoading,
    reload: loadPreset,
  };
}

/**
 * 从 ModelConfig 获取 modelOptions 用于启动会话
 */
export function getModelOptionsFromConfig(config: ModelConfig | null): ModelOptions | undefined {
  if (!config) return undefined;

  return {
    model: config.model,
    baseUrl: config.baseUrl,
    apiKey: config.apiKey,
  };
}
