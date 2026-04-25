import { useState, useCallback } from 'react';
import type { ModelConfig, ModelProvider } from '@/types/models';
import {
  saveConfig as dbSave,
  updateConfig as dbUpdate,
} from '@/stores/modelConfigStorage';

export interface ModelFormData {
  name: string;
  model: string;
  provider: ModelProvider;
  baseUrl?: string;
  apiKey?: string;
  description?: string;
  isDefault: boolean;
}

const ANTHROPIC_MODELS = [
  { value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
  { value: 'claude-opus-4-6', label: 'Claude Opus 4.6' },
  { value: 'claude-haiku-4-6', label: 'Claude Haiku 4.6' },
];

export function useModelForm() {
  const [formData, setFormData] = useState<ModelFormData>({
    name: '',
    model: '',
    provider: 'anthropic',
    isDefault: false,
  });
  const [isSaving, setIsSaving] = useState(false);

  const updateField = useCallback(<K extends keyof ModelFormData>(
    field: K,
    value: ModelFormData[K]
  ) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  const reset = useCallback(() => {
    setFormData({
      name: '',
      model: '',
      provider: 'anthropic',
      isDefault: false,
    });
  }, []);

  const loadConfig = useCallback((config: ModelConfig) => {
    setFormData({
      name: config.name,
      model: config.model,
      provider: config.provider,
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
      description: config.description,
      isDefault: config.isDefault,
    });
  }, []);

  const save = useCallback(async (id?: string) => {
    setIsSaving(true);
    try {
      if (id) {
        if (window.electron?.invoke) {
          await window.electron.invoke('model-config:update', id, formData);
        } else {
          await dbUpdate(id, formData);
        }
      } else {
        if (window.electron?.invoke) {
          await window.electron.invoke('model-config:save', formData);
        } else {
          await dbSave({ ...formData, isDefault: false });
        }
      }
      reset();
      return true;
    } catch (error) {
      console.error('Failed to save config:', error);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [formData, reset]);

  const isValid = formData.name.trim() && formData.model.trim();

  return {
    formData,
    updateField,
    reset,
    loadConfig,
    save,
    isValid,
    isSaving,
    ANTHROPIC_MODELS,
  };
}
