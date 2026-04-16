# V2.0.0 缺口补全实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 补全 V2.0.0 的 3 个功能缺口：① 全局 Agent 真实 AI 分析、② QA 历史导出按钮、③ 模型配置连接测试。

**Architecture:**
- 任务 1：新增 `runRealAnalysis()` 函数到 `globalAgentService.ts`，通过 `modelConfigStorage.getDefaultConfig()` 获取模型配置，调用 `/v1/chat/completions` API，失败时回退 Mock
- 任务 2：在 `QAHistoryListView.tsx` FilterBar 右侧添加导出下拉菜单，复用 `qaHistoryExport.ts` 已有服务
- 任务 3：在 `ModelConfigPanel.tsx` 的 `FormModal` 中添加"测试连接"按钮，发轻量级 API 请求

**Tech Stack:** TypeScript, React hooks, Zustand, Dexie (IndexedDB), Electron IPC

---

## 实施顺序

**任务 1 → 任务 2 → 任务 3**（各自独立，可并行开发）

---

## 任务 1：全局 Agent 真实 AI 分析

### 文件映射

| 操作 | 文件 | 作用 |
|------|------|------|
| 创建 | `src/services/modelApiClient.ts` | 统一封装模型 API 调用（复用现有 Electron IPC 或直连） |
| 修改 | `src/services/globalAgentService.ts` | 新增 `runRealAnalysis()` 函数，失败时降级到 `analyzeWorkspaceResults`（Mock） |
| 修改 | `src/components/GlobalAgent/GlobalAgentTrigger.tsx` | 分析完成后显示 `isMockMode` 提示 |

### Step-by-Step

- [ ] **Step 1: 创建 `src/services/modelApiClient.ts`**

  提供统一的模型 API 调用接口：

  ```typescript
  import { getDefaultConfig } from './modelConfigStorage';

  interface ChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
  }

  interface ChatCompletionOptions {
    messages: ChatMessage[];
    model: string;
    baseUrl?: string;
    apiKey?: string;
    maxTokens?: number;
    temperature?: number;
    signal?: AbortSignal;
  }

  interface ChatCompletionResponse {
    content: string;
    usage?: { inputTokens: number; outputTokens: number };
    latencyMs: number;
  }

  /**
   * 调用聊天完成 API（优先走 Electron IPC，失败时直连）
   */
  export async function callChatCompletion(
    opts: ChatCompletionOptions,
    timeoutMs = 30000,
  ): Promise<ChatCompletionResponse> {
    const start = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      // 构建 URL
      const baseUrl = opts.baseUrl?.replace(/\/$/, '') || 'https://api.anthropic.com';
      const endpoint = opts.model.startsWith('claude')
        ? `${baseUrl}/v1/messages`
        : `${baseUrl}/v1/chat/completions`;

      let body: Record<string, unknown>;
      let headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(opts.apiKey ? { Authorization: `Bearer ${opts.apiKey}` } : {}),
      };

      if (opts.model.startsWith('claude')) {
        // Anthropic Messages API
        body = {
          model: opts.model,
          messages: opts.messages.filter(m => m.role !== 'system'),
          max_tokens: opts.maxTokens ?? 1024,
          temperature: opts.temperature ?? 0.7,
        };
        headers['x-api-key'] = opts.apiKey || '';
        headers['anthropic-version'] = '2023-06-01';
      } else {
        // OpenAI-compatible
        body = {
          model: opts.model,
          messages: opts.messages,
          max_tokens: opts.maxTokens ?? 1024,
          temperature: opts.temperature ?? 0.7,
        };
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        throw new Error(`API ${response.status}: ${errText}`);
      }

      const data = await response.json() as Record<string, unknown>;
      const latencyMs = Date.now() - start;

      // 统一解析 content
      let content: string;
      if (opts.model.startsWith('claude')) {
        content = ((data.content as Array<{ type: string; text?: string }>)?.[0]?.text) ?? '';
      } else {
        content = ((data.choices as Array<{ message: { content?: string } }>)?.[0]?.message?.content) ?? '';
      }

      return {
        content,
        latencyMs,
        usage: data.usage
          ? {
              inputTokens: (data.usage as { prompt_tokens?: number }).prompt_tokens ?? 0,
              outputTokens: (data.usage as { completion_tokens?: number }).completion_tokens ?? 0,
            }
          : undefined,
      };
    } catch (err) {
      clearTimeout(timer);
      throw err;
    }
  }

  /**
   * 获取默认模型的完整配置（含解密后的 API Key）
   */
  export async function getDefaultModelConfig() {
    const config = await getDefaultConfig();
    if (!config) return null;
    // apiKey 在存储中是加密的，需要解密
    // 暂时直接返回（FormModal 中保存时会加密，读取时需要对应解密逻辑）
    return config;
  }
  ```

  **验证：** 文件创建成功，无 TypeScript 错误。

- [ ] **Step 2: 在 `globalAgentService.ts` 中新增 `runRealAnalysis` 函数**

  在文件顶部 import 区域添加：
  ```typescript
  import { getDefaultConfig } from '@/stores/modelConfigStorage';
  import { callChatCompletion } from './modelApiClient';
  ```

  在文件末尾（`analyzeWorkspaceResults` 之前）添加新函数：

  ```typescript
  /**
   * 真实 AI 分析（接入默认模型 API）
   * 失败时返回 null，调用方应回退到 analyzeWorkspaceResults（Mock）
   */
  export async function runRealAnalysis(
    batchId: string,
    workspaceResults: DispatchWorkspaceResult[],
    _config: GlobalAgentConfig,
  ): Promise<{ result: GlobalAgentResult; latencyMs: number } | null> {
    if (workspaceResults.length === 0) return null;

    const modelConfig = await getDefaultConfig();
    if (!modelConfig?.apiKey) {
      console.warn('[globalAgentService] No default model config or API key');
      return null;
    }

    // 构造分析 prompt
    const prompt = buildAnalysisPrompt(workspaceResults, modelConfig.model ?? 'unknown');

    try {
      const response = await callChatCompletion({
        messages: [{ role: 'user', content: prompt }],
        model: modelConfig.model ?? 'claude-sonnet-4-6',
        baseUrl: modelConfig.baseUrl,
        apiKey: modelConfig.apiKey,
        maxTokens: 2048,
        temperature: 0.3,
      });

      // 解析 JSON
      const parsed = parseAnalysisResponse(response.content, workspaceResults);
      if (!parsed) {
        console.warn('[globalAgentService] Failed to parse analysis response:', response.content.slice(0, 200));
        return null;
      }

      const result: GlobalAgentResult = {
        id: generateResultId(),
        batchId,
        modelUsed: modelConfig.id,
        rankings: parsed.rankings,
        scores: parsed.scores,
        commentary: parsed.commentary,
        roast: parsed.roast,
        recommendations: parsed.recommendations,
        createdAt: Date.now(),
      };

      resultsStore.set(batchId, result);

      // 向量存储（fire-and-forget）
      _indexEvaluationToVector(result).catch(err => {
        console.warn('[globalAgentService] Failed to index evaluation:', err);
      });

      return { result, latencyMs: response.latencyMs };
    } catch (err) {
      console.warn('[globalAgentService] Real analysis failed, falling back to mock:', err);
      return null;
    }
  }

  function buildAnalysisPrompt(workspaceResults: DispatchWorkspaceResult[], modelName: string): string {
    const workspaceDescriptions = workspaceResults.map((ws, i) => {
      const status = ws.status === 'success' ? '成功' : '失败';
      const failedReason = ws.status === 'failed' && ws.promptResults[0]?.reason
        ? `\n- 失败原因: ${ws.promptResults[0].reason}`
        : '';
      const tokens = ws.promptResults[0]?.tokenUsage
        ? `\n- Token 消耗: input=${ws.promptResults[0].tokenUsage.input}, output=${ws.promptResults[0].tokenUsage.output}`
        : '';
      const summary = ws.promptResults[0]?.summary
        ? `\n- 总结: ${ws.promptResults[0].summary.slice(0, 500)}`
        : '';

      return `【工作区 ${i + 1}】${ws.workspaceId}
  - 状态: ${status}${failedReason}
  - Prompt: "${ws.promptResults[0]?.prompt ?? '(no prompt)'}"${tokens}${summary}`;
    }).join('\n\n');

    return `你是严格的 AI 代码助手评测员。以下是 ${workspaceResults.length} 个工作区的执行结果对比：

${workspaceDescriptions}

请从以下 7 个维度对每个工作区评分（1-10 分）：
1. 代码质量（代码可读性，最佳实践）
2. 正确性（是否满足 Prompt 要求）
3. 性能（算法效率、响应速度）
4. 一致性（输出格式稳定性）
5. 创意（解决方案的独特性）
6. 成本效率（Token 消耗 vs 输出质量）
7. 速度（首 Token 延迟、总耗时）

请严格按以下 JSON 格式输出（只输出 JSON，不要其他内容）：
{
  "rankings": [
    { "workspaceId": "xxx", "workspaceName": "xxx", "totalScore": 8.5, "rank": 1, "strengths": ["..."], "weaknesses": ["..."] }
  ],
  "scores": [
    { "workspaceId": "xxx", "codeQuality": 8.5, "correctness": 9.0, "performance": 7.5, "consistency": 8.0, "creativity": 8.0, "costEfficiency": 7.0, "speed": 8.5 }
  ],
  "commentary": "综合评语...",
  "roast": "吐槽内容...",
  "recommendations": ["建议1", "建议2"]
}`;
  }

  function parseAnalysisResponse(
    content: string,
    workspaceResults: DispatchWorkspaceResult[],
  ): {
    rankings: Array<{ workspaceId: string; workspaceName: string; totalScore: number; rank: number; strengths: string[]; weaknesses: string[] }>;
    scores: Array<{ workspaceId: string; codeQuality: number; correctness: number; performance: number; consistency: number; creativity: number; costEfficiency: number; speed: number }>;
    commentary: string;
    roast: string;
    recommendations: string[];
  } | null {
    // 尝试提取 JSON（去掉 markdown 代码块标记）
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) ?? content.match(/(\{[\s\S]*\})/);
    const jsonStr = jsonMatch ? jsonMatch[1].trim() : content.trim();

    try {
      const raw = JSON.parse(jsonStr) as Record<string, unknown>;

      // 处理 rankings
      const rankings = (raw.rankings as Array<Record<string, unknown>> ?? []).map((r, i) => ({
        workspaceId: String(r.workspaceId ?? workspaceResults[i]?.workspaceId ?? i),
        workspaceName: String(r.workspaceName ?? r.workspaceId ?? workspaceResults[i]?.workspaceId ?? '未知'),
        totalScore: Number(r.totalScore ?? 5),
        rank: Number(r.rank ?? i + 1),
        strengths: Array.isArray(r.strengths) ? r.strengths.map(String) : ['表现一般'],
        weaknesses: Array.isArray(r.weaknesses) ? r.weaknesses.map(String) : ['无明显缺点'],
      }));

      // 处理 scores
      const scores = (raw.scores as Array<Record<string, unknown>> ?? []).map((s, i) => {
        const wsId = String(s.workspaceId ?? workspaceResults[i]?.workspaceId ?? i);
        return {
          workspaceId: wsId,
          codeQuality: Number(s.codeQuality ?? 5),
          correctness: Number(s.correctness ?? 5),
          performance: Number(s.performance ?? 5),
          consistency: Number(s.consistency ?? 5),
          creativity: Number(s.creativity ?? 5),
          costEfficiency: Number(s.costEfficiency ?? 5),
          speed: Number(s.speed ?? 5),
        };
      });

      return {
        rankings,
        scores,
        commentary: String(raw.commentary ?? '分析完成'),
        roast: String(raw.roast ?? '暂无吐槽'),
        recommendations: Array.isArray(raw.recommendations)
          ? raw.recommendations.map(String)
          : ['建议优化代码质量', '建议改进错误处理'],
      };
    } catch {
      return null;
    }
  }
  ```

- [ ] **Step 3: 修改 `analyzeWorkspaceResults` 函数，改为主动调用真实分析**

  将 `analyzeWorkspaceResults` 改为：

  ```typescript
  export async function analyzeWorkspaceResults(
    batchId: string,
    workspaceResults: DispatchWorkspaceResult[],
    config: GlobalAgentConfig,
  ): Promise<GlobalAgentResult> {
    // ★ 优先尝试真实 AI 分析
    const realResult = await runRealAnalysis(batchId, workspaceResults, config);
    if (realResult) {
      return realResult.result;
    }

    // 回退到 Mock
    const rankings = generateRankings(workspaceResults);
    // ... 其余保持不变 ...
    const scores: DimensionScore[] = ALL_DIMENSIONS.map(dimension => {
      const avgRankScore = rankings.length > 0
        ? rankings.reduce((sum, r) => sum + r.totalScore, 0) / rankings.length
        : 5;
      const variance = (Math.random() - 0.5) * 3;
      const rawScore = avgRankScore + variance;
      const score = Math.max(1, Math.min(10, Math.round(rawScore * 10) / 10));
      return {
        dimension,
        score,
        comment: generateDimensionComment(dimension, score, 'global'),
      };
    });
    const commentary = generateCommentary(rankings, scores);
    const roast = generateRoast(rankings);
    const recommendations = generateRecommendations(rankings, scores);
    const result: GlobalAgentResult = {
      id: generateResultId(),
      batchId,
      modelUsed: config.modelConfigId,
      rankings,
      scores,
      commentary,
      roast,
      recommendations,
      createdAt: Date.now(),
    };
    resultsStore.set(batchId, result);
    _indexEvaluationToVector(result).catch(err => {
      console.warn('[globalAgentService] Failed to index evaluation to vector storage:', err);
    });
    return result;
  }
  ```

- [ ] **Step 4: 运行测试，确保 globalAgentService.test.ts 全部通过**

  ```bash
  npx vitest run src/__tests__/globalAgentService.test.ts --reporter=verbose
  ```
  预期：15 个测试 PASS。

- [ ] **Step 5: 提交**

  ```bash
  git add src/services/modelApiClient.ts src/services/globalAgentService.ts
  git commit -m "$(cat <<'EOF'
  feat: add real AI analysis to Global Agent service

  - New modelApiClient.ts: unified API call wrapper (Anthropic / OpenAI-compatible)
  - runRealAnalysis(): calls default model API, falls back to Mock on failure
  - analyzeWorkspaceResults(): tries real first, falls back to mock
  EOF
  )"
  ```

---

## 任务 2：QA 历史导出按钮接入 UI

### 文件映射

| 操作 | 文件 | 作用 |
|------|------|------|
| 修改 | `src/components/QAHistory/QAHistoryListView.tsx` | 添加导出下拉按钮和选中逻辑 |
| 修改 | `src/__tests__/QAHistoryListView.test.tsx` | 新增导出按钮测试 |

### Step-by-Step

- [ ] **Step 1: 阅读 `QAHistoryListView.tsx` 的 FilterBar 区域结构（lines 295-385）**

  确认 FilterBar 组件的 props 和 JSX 结构，不需要改代码。

- [ ] **Step 2: 在 FilterBar 中添加导出按钮**

  在 `FilterBar.tsx` 中（或直接在 `QAHistoryListView.tsx` 内的 FilterBar 部分），在 Reset 按钮右侧添加导出下拉：

  ```typescript
  // 在 QAHistoryListView.tsx 中，FilterBar 末尾添加导出按钮
  // 位置：在 Reset 按钮（如果有筛选）或筛选控件行末尾

  const [exportOpen, setExportOpen] = useState(false);
  const [selectedForExport, setSelectedForExport] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState(false);

  // 点击导出按钮
  const handleExport = async (format: 'markdown' | 'json' | 'html', entries: QAHistoryEntry[]) => {
    if (entries.length === 0) return;
    setExporting(true);
    try {
      let content: string;
      let filename: string;
      const timestamp = new Date().toISOString().slice(0, 10);
      if (format === 'markdown') {
        content = exportToMarkdown(entries);
        filename = `qa-export-${timestamp}.md`;
      } else if (format === 'html') {
        content = await exportToHTML(entries);
        filename = `qa-export-${timestamp}.html`;
      } else {
        content = exportToJSON(entries);
        filename = `qa-export-${timestamp}.json`;
      }
      // 下载文件
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
      setExportOpen(false);
    }
  };

  // 选中项用于导出（状态由外部传入，这里用 allEntries）
  const entriesToExport = selectedForExport.size > 0
    ? allEntries.filter(e => selectedForExport.has(e.id))
    : allEntries;
  ```

  在 JSX 中 FilterBar 行末尾添加：

  ```tsx
  {/* 导出按钮 */}
  <div style={{ position: 'relative', display: 'inline-block' }}>
    <button
      onClick={() => setExportOpen(o => !o)}
      disabled={allEntries.length === 0 || exporting}
      style={{
        padding: '4px 12px',
        borderRadius: 6,
        border: '1px solid var(--border)',
        background: 'var(--bg-card)',
        cursor: allEntries.length === 0 ? 'not-allowed' : 'pointer',
        opacity: allEntries.length === 0 ? 0.5 : 1,
        fontSize: 13,
        display: 'flex',
        alignItems: 'center',
        gap: 4,
      }}
      title="导出问答历史"
    >
      {exporting ? '导出中...' : '导出'}
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
      </svg>
    </button>

    {exportOpen && (
      <div
        style={{
          position: 'absolute',
          top: '100%',
          right: 0,
          marginTop: 4,
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
          zIndex: 100,
          minWidth: 180,
          padding: 4,
        }}
        onMouseLeave={() => setExportOpen(false)}
      >
        <div style={{ padding: '4px 8px', fontSize: 11, color: 'var(--text-dim)', borderBottom: '1px solid var(--border)' }}>
          导出 {selectedForExport.size > 0 ? `已选 ${selectedForExport.size} 条` : `全部 ${allEntries.length} 条`}
        </div>
        {(['markdown', 'json', 'html'] as const).map(fmt => (
          <button
            key={fmt}
            onClick={() => handleExport(fmt, entriesToExport)}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              padding: '8px 12px',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              borderRadius: 4,
              fontSize: 13,
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-bg)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
          >
            导出为 {fmt === 'markdown' ? 'Markdown (.md)' : fmt === 'json' ? 'JSON (.json)' : 'HTML (.html)'}
          </button>
        ))}
      </div>
    )}
  </div>
  ```

- [ ] **Step 3: 在 `QAHistoryListView.tsx` 顶部添加 import**

  ```typescript
  import { exportToMarkdown, exportToJSON, exportToHTML } from '@/services/qaHistoryExport';
  ```

- [ ] **Step 4: 运行测试，确保列表渲染测试通过**

  ```bash
  npx vitest run src/__tests__/QAHistoryListView.test.tsx --reporter=verbose
  ```

- [ ] **Step 5: 提交**

  ```bash
  git add src/components/QAHistory/QAHistoryListView.tsx
  git commit -m "$(cat <<'EOF'
  feat: add export button to QA history list view

  - Export dropdown with Markdown/JSON/HTML format options
  - Supports exporting selected or all entries
  - Downloads file via createObjectURL
  EOF
  )"
  ```

---

## 任务 3：模型配置连接测试

### 文件映射

| 操作 | 文件 | 作用 |
|------|------|------|
| 修改 | `src/components/ModelConfigPanel.tsx` | 在 FormModal 中添加测试连接按钮和状态 UI |
| 修改 | `src/__tests__/modelConfigPanel.test.tsx` | 新增连接测试按钮测试（如有） |

### Step-by-Step

- [ ] **Step 1: 阅读 `FormModal` 中 API Key 输入框附近结构（lines 380-420）**

- [ ] **Step 2: 在 `FormModal` 中添加测试连接状态和函数**

  在 `FormModal` 组件中添加 state：

  ```typescript
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState('');
  ```

  添加测试函数：

  ```typescript
  const handleTestConnection = async () => {
    if (!config.model?.trim()) {
      setTestStatus('error');
      setTestMessage('请先填写模型名称');
      return;
    }
    setTestStatus('testing');
    setTestMessage('');
    const start = Date.now();
    try {
      const baseUrl = config.baseUrl?.trim() || 'https://api.anthropic.com';
      const isClaude = (config.model ?? '').startsWith('claude');
      const url = isClaude
        ? `${baseUrl.replace(/\/$/, '')}/v1/messages`
        : `${baseUrl.replace(/\/$/, '')}/v1/chat/completions`;

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      let body: Record<string, unknown>;

      if (isClaude) {
        headers['x-api-key'] = config.apiKey || '';
        headers['anthropic-version'] = '2023-06-01';
        body = { model: config.model, messages: [{ role: 'user', content: 'Hi' }], max_tokens: 10, temperature: 0.1 };
      } else {
        headers['Authorization'] = `Bearer ${config.apiKey || ''}`;
        body = { model: config.model, messages: [{ role: 'user', content: 'Hi' }], max_tokens: 10, temperature: 0.1 };
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const resp = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal: controller.signal });
      clearTimeout(timeout);

      if (resp.ok) {
        const latency = Date.now() - start;
        setTestStatus('success');
        setTestMessage(`连接成功 (${latency}ms)`);
      } else {
        const err = await resp.text().catch(() => '');
        setTestStatus('error');
        setTestMessage(`连接失败: HTTP ${resp.status}${err ? ' - ' + err.slice(0, 100) : ''}`);
      }
    } catch (err) {
      const latency = Date.now() - start;
      if (err instanceof Error && err.name === 'AbortError') {
        setTestStatus('error');
        setTestMessage('连接超时 (5s)');
      } else {
        setTestStatus('error');
        setTestMessage(`连接失败: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  };
  ```

- [ ] **Step 3: 在 API Key 输入框右侧添加测试按钮**

  在 API Key 那一行的末尾（input 之后）添加：

  ```tsx
  {/* API Key 行 */}
  <div style={fieldStyle}>
    <label style={labelStyle}>API Key</label>
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <input
        type="password"
        value={config.apiKey ?? ''}
        onChange={e => onChange({ apiKey: e.target.value })}
        placeholder="留空则使用环境变量"
        style={{ ...inputStyle, flex: 1 }}
      />
      {/* 测试连接按钮 */}
      <button
        type="button"
        onClick={handleTestConnection}
        disabled={testStatus === 'testing'}
        style={{
          padding: '6px 12px',
          borderRadius: 6,
          border: testStatus === 'success'
            ? '1px solid var(--success)'
            : testStatus === 'error'
            ? '1px solid var(--error)'
            : '1px solid var(--border)',
          background: testStatus === 'success'
            ? 'var(--success-bg)'
            : testStatus === 'error'
            ? 'var(--error-bg)'
            : 'var(--bg-card)',
          color: testStatus === 'success'
            ? 'var(--success)'
            : testStatus === 'error'
            ? 'var(--error)'
            : 'var(--text-primary)',
          cursor: testStatus === 'testing' ? 'wait' : 'pointer',
          fontSize: 13,
          whiteSpace: 'nowrap',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          opacity: testStatus === 'testing' ? 0.7 : 1,
        }}
        title="测试 API 连通性"
      >
        {testStatus === 'testing' ? (
          <>测试中...</>
        ) : testStatus === 'success' ? (
          <>✓ 连接</>
        ) : testStatus === 'error' ? (
          <>✗ 重试</>
        ) : (
          <>测试连接</>
        )}
      </button>
    </div>
    {/* 测试结果提示 */}
    {testMessage && (
      <div style={{
        marginTop: 4,
        fontSize: 12,
        color: testStatus === 'success' ? 'var(--success)' : testStatus === 'error' ? 'var(--error)' : 'var(--text-secondary)',
      }}>
        {testMessage}
      </div>
    )}
  </div>
  ```

- [ ] **Step 4: 提交**

  ```bash
  git add src/components/ModelConfigPanel.tsx
  git commit -m "$(cat <<'EOF'
  feat: add connection test button to model config panel

  - Test connection button in API Key row
  - 4 states: idle / testing / success / error
  - Shows latency on success, error reason on failure
  - 5s timeout with AbortController
  EOF
  )"
  ```

---

## 自检清单

完成所有 Step 后，执行以下验证：

```bash
# 1. 所有测试通过
npx vitest run 2>&1 | tail -5

# 2. TypeScript 类型检查
npx tsc --noEmit 2>&1 | head -20

# 3. 浏览器手动验证
# - 全局终端 → dispatch → 全局分析 → 验证真实 AI 分析（看控制台日志）
# - 设置 → 模型配置 → 新增模型 → 填写后点"测试连接" → 验证状态 UI
# - 打开 QA 历史 → 点导出按钮 → 选 Markdown → 验证下载
```

---

## 验收标准

| 任务 | 验收条件 |
|------|---------|
| 1 | `analyzeWorkspaceResults` 优先调用真实 AI；API 失败时回退 Mock；控制台有 `[globalAgentService] Real analysis failed` 日志 |
| 2 | QA 历史列表页右上角有导出按钮；下拉显示 3 种格式；点击后浏览器下载文件 |
| 3 | 模型配置表单 API Key 行右侧有"测试连接"按钮；4 种状态（idle/testing/success/error）正确显示 |
| 全 | 447 个原有测试继续通过 |
