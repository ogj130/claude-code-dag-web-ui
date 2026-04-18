/** 模型提供商类型 */
export type ModelProvider = 'anthropic' | 'openai-compatible';

/** 模型配置 */
export interface ModelConfig {
  id: string;                    // 唯一 ID，格式: mcfg_${timestamp}_${random}
  name: string;                 // 配置名称
  model: string;               // 模型名称
  provider: ModelProvider;
  baseUrl?: string;            // API 端点
  apiKey?: string;             // 加密存储的 API Key
  isDefault: boolean;          // 是否为全局默认配置
  priority?: number;          // 优先级
  description?: string;        // 用户备注
  createdAt: number;
  updatedAt: number;
}

/** 工作目录预设 */
export interface WorkspacePreset {
  id: string;                  // 唯一 ID
  workspacePath: string;       // 工作目录路径
  configId: string | null;     // 引用的 ModelConfig ID，null 表示已失效
  isEnabled: boolean;          // 是否启用
  description?: string;        // 用途备注
  name: string;               // 显示名称（从路径自动生成或手动设置）
  systemPrompt?: string;      // 系统提示词
  createdAt: number;
  updatedAt: number;
}

/** 存储层的配置（加密字段） */
export interface StoredModelConfig extends Omit<ModelConfig, 'apiKey'> {
  encryptedApiKey?: string;
}

/** 会话启动时的模型选项 */
export interface ModelOptions {
  model?: string;
  baseUrl?: string;
  apiKey?: string;
}

/** Proxy 状态 */
export type ProxyStatus = 'stopped' | 'starting' | 'running' | 'error';
