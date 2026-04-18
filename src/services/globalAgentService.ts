/**
 * 全局 Agent 分析服务
 *
 * 在 Mock 模式下生成模拟评价结果，用于测试和演示。
 * 实际生产环境可替换为真实 AI API 调用。
 */

import { getDefaultConfig } from '@/stores/modelConfigStorage';
import type {
  GlobalAgentConfig,
  GlobalAgentResult,
  WorkspaceRanking,
  DimensionScore,
  AnalysisDimension,
} from '@/types/globalAgent';
import type { DispatchWorkspaceResult } from '@/types/global-dispatch';
import { callChatCompletion } from './modelApiClient';

// 内存存储（模拟持久化）
const resultsStore = new Map<string, GlobalAgentResult>();

/**
 * 清理存储（仅用于测试）
 * @internal
 */
export function _clearResultsStore(): void {
  resultsStore.clear();
}

/** 评分维度列表 */
const ALL_DIMENSIONS: AnalysisDimension[] = [
  'codeQuality',
  'correctness',
  'performance',
  'consistency',
  'creativity',
  'costEfficiency',
  'speed',
];

/** 生成随机 ID */
function generateResultId(): string {
  return `gar_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * 计算单个工作区的综合得分（Mock 模式）
 * 根据执行状态和 prompt 结果生成合理的分数
 */
function calculateWorkspaceScore(
  workspaceResult: DispatchWorkspaceResult,
): number {
  const { status, promptResults } = workspaceResult;

  // 基础分根据执行状态
  let baseScore = 10;
  if (status === 'failed') baseScore = 3;
  else if (status === 'partial') baseScore = 6;

  // 根据 prompt 结果调整
  const successCount = promptResults.filter(p => p.status === 'success').length;
  const totalCount = promptResults.length;
  const successRate = totalCount > 0 ? successCount / totalCount : 0;

  return Math.round(baseScore * successRate * 10) / 10;
}

/**
 * 生成维度评分的注释（Mock 模式）
 */
function generateDimensionComment(
  dimension: AnalysisDimension,
  score: number,
  _workspaceId: string,
): string {
  const comments: Record<AnalysisDimension, string[]> = {
    codeQuality: [
      '代码结构清晰，模块化做得不错',
      '代码组织合理，函数职责单一',
      '存在一些代码重复，可以抽取公共函数',
      '代码风格需要统一，建议引入 linter',
    ],
    correctness: [
      '逻辑完全正确，结果符合预期',
      '大部分功能正常，边界情况处理有待加强',
      '存在逻辑漏洞，建议增加参数校验',
      '测试覆盖不足，建议补充单元测试',
    ],
    performance: [
      '性能表现优秀，响应速度快',
      '执行效率良好，没有明显性能问题',
      '有些操作可以优化，考虑批量处理',
      '性能有待提升，频繁 IO 操作需要优化',
    ],
    consistency: [
      '风格保持一致，看起来很专业',
      '大部分代码风格统一',
      '存在风格不一致的地方，建议制定规范',
      '代码风格差异较大，需要统一重构',
    ],
    creativity: [
      '解决方案很有创意，令人眼前一亮',
      '采用了实用的方案，中规中矩',
      '可以尝试更创新的方法解决问题',
      '方案比较保守，缺乏创新',
    ],
    costEfficiency: [
      '资源利用高效，性价比很高',
      '消耗合理，在可接受范围内',
      '有些资源使用可以更高效',
      '资源消耗较大，需要优化',
    ],
    speed: [
      '响应非常迅速，体验极佳',
      '速度正常，等待时间可接受',
      '响应有些慢，可以考虑优化',
      '速度较慢，需要大幅优化',
    ],
  };

  // 根据分数选择评论
  let commentIndex: number;
  if (score >= 9) commentIndex = 0;
  else if (score >= 7) commentIndex = 1;
  else if (score >= 5) commentIndex = 2;
  else commentIndex = 3;

  return comments[dimension][commentIndex];
}

/**
 * 生成工作区排名（Mock 模式）
 */
function generateRankings(
  workspaceResults: DispatchWorkspaceResult[],
): WorkspaceRanking[] {
  // 计算每个工作区的得分
  const workspaceScores = workspaceResults.map(result => ({
    workspaceId: result.workspaceId,
    workspaceName: result.workspaceId, // Mock 模式下使用 ID 作为名称
    totalScore: calculateWorkspaceScore(result),
    strengths: generateMockStrengths(result),
    weaknesses: generateMockWeaknesses(result),
  }));

  // 按分数降序排列
  workspaceScores.sort((a, b) => b.totalScore - a.totalScore);

  // 添加排名
  return workspaceScores.map((ws, index) => ({
    ...ws,
    rank: index + 1,
  }));
}

/**
 * 生成 Mock 优点列表
 */
function generateMockStrengths(result: DispatchWorkspaceResult): string[] {
  const strengths: string[] = [];

  if (result.status === 'success') {
    strengths.push('所有 prompt 都执行成功');
  }
  if (result.promptResults.length > 2) {
    strengths.push('完成了多个任务');
  }
  if (result.promptResults.every(p => p.status === 'success')) {
    strengths.push('零失败，执行稳定性高');
  }

  if (strengths.length === 0) {
    strengths.push('有尝试执行任务');
  }

  return strengths;
}

/**
 * 生成 Mock 缺点列表
 */
function generateMockWeaknesses(result: DispatchWorkspaceResult): string[] {
  const weaknesses: string[] = [];

  const failedPrompts = result.promptResults.filter(p => p.status === 'failed');
  if (failedPrompts.length > 0) {
    weaknesses.push(`${failedPrompts.length} 个 prompt 执行失败`);
    if (failedPrompts[0].reason) {
      weaknesses.push(`失败原因: ${failedPrompts[0].reason}`);
    }
  }

  if (result.status === 'partial') {
    weaknesses.push('部分任务未完成');
  }
  if (result.status === 'failed') {
    weaknesses.push('整体执行失败');
  }

  if (weaknesses.length === 0) {
    weaknesses.push('暂无明显缺点');
  }

  return weaknesses;
}

/**
 * 生成综合评语（Mock 模式）
 */
function generateCommentary(
  rankings: WorkspaceRanking[],
  scores: DimensionScore[],
): string {
  if (rankings.length === 0) {
    return '本次没有任何工作区执行结果，无法进行分析。';
  }

  const topWorkspace = rankings[0];
  const bottomWorkspace = rankings[rankings.length - 1];

  const avgScore =
    scores.reduce((sum, s) => sum + s.score, 0) / scores.length;

  let commentary = `本次全局 Agent 分析共评估了 ${rankings.length} 个工作区。\n\n`;

  if (rankings.length >= 2) {
    commentary += `最佳表现: ${topWorkspace.workspaceName} (总分 ${topWorkspace.totalScore}/10)，展现出了优秀的综合能力。\n`;
    commentary += `需要改进: ${bottomWorkspace.workspaceName} (总分 ${bottomWorkspace.totalScore}/10)，建议参考最佳实践进行优化。\n\n`;
  }

  // 找出最高和最低的维度
  const sortedScores = [...scores].sort((a, b) => b.score - a.score);
  const highestDim = sortedScores[0];
  const lowestDim = sortedScores[sortedScores.length - 1];

  commentary += `综合评分: ${avgScore.toFixed(1)}/10\n`;
  commentary += `最强维度: ${highestDim.dimension} (${highestDim.score}/10)\n`;
  commentary += `待提升: ${lowestDim.dimension} (${lowestDim.score}/10)\n`;

  return commentary;
}

/**
 * 生成吐槽（Mock 模式）
 */
function generateRoast(rankings: WorkspaceRanking[]): string {
  if (rankings.length === 0) {
    return '没有数据，吐槽什么呢？先去让 AI 跑起来吧！';
  }

  const roasts: string[] = [];

  // 对最后一名进行吐槽
  const lastPlace = rankings[rankings.length - 1];
  if (lastPlace.totalScore < 5) {
    const roastLines = [
      `${lastPlace.workspaceName} 的表现嘛... 我就不点名了，大家心里都有数。`,
      `${lastPlace.workspaceName} 是不是偷偷用了纸和笔？AI 跑成这样也是本事。`,
      `${lastPlace.workspaceName}，我怀疑你是不是在测试 AI 的容错能力？`,
      `建议 ${lastPlace.workspaceName} 的主人去看看 prompt 是不是写错了。`,
    ];
    roasts.push(roastLines[Math.floor(Math.random() * roastLines.length)]);
  }

  // 对有失败的工作区进行吐槽
  const failedWorkspaces = rankings.filter(w => w.totalScore < 6);
  if (failedWorkspaces.length > 0) {
    roasts.push(`话说回来，有 ${failedWorkspaces.length} 个工作区翻车了，确定不是网络问题？`);
  }

  // 对所有都失败的情况进行吐槽
  if (rankings.every(w => w.totalScore < 5)) {
    roasts.push('全部阵亡... 今天的咖啡是不是洒在键盘上了？');
  }

  // 对都成功的进行轻微调侃
  if (rankings.every(w => w.totalScore >= 8)) {
    roasts.push('哇哦，全部表现优秀！今天太阳从西边出来了吗？');
  }

  if (roasts.length === 0) {
    roasts.push('整体还行，但也别高兴太早，下次可能就没这么幸运了。');
  }

  return roasts.join('\n');
}

/**
 * 生成改进建议（Mock 模式）
 */
function generateRecommendations(
  rankings: WorkspaceRanking[],
  scores: DimensionScore[],
): string[] {
  const recommendations: string[] = [];

  // 根据薄弱维度给出建议
  const sortedScores = [...scores].sort((a, b) => a.score - b.score);
  const weakestDims = sortedScores.slice(0, 3);

  for (const dim of weakestDims) {
    if (dim.score < 7) {
      const advice: Record<string, string> = {
        codeQuality: '建议加强代码审查，引入 ESLint 和 Prettier 保持风格统一',
        correctness: '建议增加边界测试用例，完善错误处理逻辑',
        performance: '考虑使用缓存、优化数据库查询、减少不必要的 API 调用',
        consistency: '制定并遵循代码规范，定期进行代码评审',
        creativity: '可以多参考开源项目，学习不同的解决方案',
        costEfficiency: '考虑使用更小的模型处理简单任务，合理配置资源',
        speed: '检查网络延迟，优化异步操作，使用并发处理',
      };
      const suggestion = advice[dim.dimension];
      if (suggestion) recommendations.push(suggestion);
    }
  }

  // 对表现最差的工作区给出建议
  if (rankings.length > 0) {
    const worst = rankings[rankings.length - 1];
    if (worst.totalScore < 6) {
      recommendations.push(
        `针对 ${worst.workspaceName}，建议检查 prompt 质量和工作区配置`,
      );
    }
  }

  if (recommendations.length === 0) {
    recommendations.push('继续保持，当前表现良好！');
  }

  return recommendations.slice(0, 5); // 最多 5 条建议
}

/**
 * 构建真实 AI 分析 prompt
 */
function buildAnalysisPrompt(
  workspaceResults: DispatchWorkspaceResult[],
  modelName: string,
): string {
  const isClaudeModel = modelName.toLowerCase().startsWith('claude');

  const workspaceLines = workspaceResults.map(ws => {
    const successCount = ws.promptResults.filter(p => p.status === 'success').length;
    const totalCount = ws.promptResults.length;
    const tokens = ws.promptResults.reduce(
      (sum, p) => sum + (p.inputTokens ?? 0) + (p.outputTokens ?? 0),
      0,
    );
    const firstFailed = ws.promptResults.find(p => p.status === 'failed');

    let line = `- Workspace: ${ws.workspaceId}\n`;
    line += `  Status: ${ws.status} (${successCount}/${totalCount} prompts succeeded)\n`;
    if (ws.errorMessage) line += `  Error: ${ws.errorMessage}\n`;
    if (firstFailed) line += `  First failure reason: ${firstFailed.reason ?? 'unknown'}\n`;
    line += `  Total tokens: ${tokens}`;

    // 包含 summary（如果 prompt 有）
    const summaries = ws.promptResults
      .filter(p => p.status === 'success' && p.prompt)
      .map(p => `  - [${p.status}] ${p.prompt}`)
      .join('\n');
    if (summaries) line += `\n  Prompt summaries:\n${summaries}`;

    return line;
  }).join('\n\n');

  const systemInstruction = isClaudeModel
    ? '你是一位专业的 AI 代码分析专家。请根据以下工作区执行结果，生成详细的分析报告。'
    : '你是一位专业的 AI 代码分析专家。请根据以下工作区执行结果，生成详细的分析报告。';

  const outputFormat = `
请以 JSON 格式返回分析结果，包含以下字段：
{
  "rankings": [
    {
      "workspaceId": "工作区ID",
      "workspaceName": "工作区名称",
      "totalScore": 8.5,
      "strengths": ["优点1", "优点2"],
      "weaknesses": ["缺点1", "缺点2"]
    }
  ],
  "scores": [
    {
      "dimension": "codeQuality|correctness|performance|consistency|creativity|costEfficiency|speed",
      "score": 8.5,
      "comment": "维度评语"
    }
  ],
  "commentary": "综合评语（Markdown 格式）",
  "roast": "吐槽语（轻松幽默）",
  "recommendations": ["建议1", "建议2", "建议3"]
}

注意：
1. rankings 应按 totalScore 降序排列，rank 字段从 1 开始
2. scores 需包含全部 7 个维度：codeQuality, correctness, performance, consistency, creativity, costEfficiency, speed
3. totalScore 和 score 均为 1-10 的数字
4. commentary 应包含本次分析的亮点、整体评价
5. roast 需轻松幽默，对表现差的适当吐槽
6. recommendations 最多 5 条`;

  return `${systemInstruction}

## 工作区执行结果

${workspaceLines}

${outputFormat}`;
}

/**
 * 解析 AI 返回的 JSON 分析响应
 */
function parseAnalysisResponse(
  content: string,
  workspaceResults: DispatchWorkspaceResult[],
): {
  rankings: WorkspaceRanking[];
  scores: DimensionScore[];
  commentary: string;
  roast: string;
  recommendations: string[];
} | null {
  // 提取 JSON 块
  const jsonMatch =
    content.match(/```(?:json)?\s*([\s\S]*?)```/) ?? content.match(/(\{[\s\S]*\})/);

  if (!jsonMatch) return null;

  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(jsonMatch[1]);
  } catch {
    return null;
  }

  const workspaceIdSet = new Set(workspaceResults.map(ws => ws.workspaceId));

  const rankings: WorkspaceRanking[] = (raw.rankings as Record<string, unknown>[] ?? []).map(
    (r, index) => ({
      workspaceId: (r.workspaceId as string) ?? '',
      workspaceName: (r.workspaceName as string) ?? (r.workspaceId as string) ?? '',
      totalScore: Number(r.totalScore ?? 0),
      rank: Number(r.rank ?? (index + 1)),
      strengths: Array.isArray(r.strengths) ? r.strengths as string[] : [],
      weaknesses: Array.isArray(r.weaknesses) ? r.weaknesses as string[] : [],
    }),
  );

  // 补充缺失的 workspaceId（AI 可能遗漏某些工作区）
  const rankedIds = new Set(rankings.map(r => r.workspaceId));
  for (const wsId of workspaceIdSet) {
    if (!rankedIds.has(wsId)) {
      rankings.push({
        workspaceId: wsId,
        workspaceName: wsId,
        totalScore: 5,
        rank: rankings.length + 1,
        strengths: [],
        weaknesses: [],
      });
    }
  }

  const scores: DimensionScore[] = (raw.scores as Record<string, unknown>[] ?? []).map(s => ({
    dimension: (s.dimension as AnalysisDimension) ?? 'codeQuality',
    score: Number(s.score ?? 5),
    comment: (s.comment as string) ?? '',
  }));

  // 补全缺失维度
  const existingDims = new Set(scores.map(s => s.dimension));
  for (const dim of ALL_DIMENSIONS) {
    if (!existingDims.has(dim)) {
      scores.push({ dimension: dim, score: 5, comment: '' });
    }
  }

  return {
    rankings,
    scores,
    commentary: (raw.commentary as string) ?? '',
    roast: (raw.roast as string) ?? '',
    recommendations: Array.isArray(raw.recommendations) ? raw.recommendations as string[] : [],
  };
}

/**
 * 真实 AI 分析（接入默认模型 API）
 * 失败时返回 null，调用方应回退到 Mock
 */
async function runRealAnalysis(
  batchId: string,
  workspaceResults: DispatchWorkspaceResult[],
  _config: GlobalAgentConfig,
): Promise<{ result: GlobalAgentResult; latencyMs: number } | null> {
  if (workspaceResults.length === 0) return null;

  const cfg = await getDefaultConfig();
  if (!cfg || !cfg.apiKey) return null;

  const modelName = cfg.model;
  const prompt = buildAnalysisPrompt(workspaceResults, modelName);

  let response: Awaited<ReturnType<typeof callChatCompletion>>;
  try {
    response = await callChatCompletion({
      messages: [{ role: 'user', content: prompt }],
      model: modelName,
      baseUrl: cfg.baseUrl,
      apiKey: cfg.apiKey,
      maxTokens: 2048,
      temperature: 0.3,
    });
  } catch (err) {
    console.warn('[globalAgentService] runRealAnalysis failed:', err);
    return null;
  }

  const parsed = parseAnalysisResponse(response.content, workspaceResults);
  if (!parsed) {
    console.warn('[globalAgentService] runRealAnalysis: failed to parse AI response');
    return null;
  }

  const result: GlobalAgentResult = {
    id: generateResultId(),
    batchId,
    modelUsed: cfg.id,
    rankings: parsed.rankings,
    scores: parsed.scores,
    commentary: parsed.commentary,
    roast: parsed.roast,
    recommendations: parsed.recommendations,
    createdAt: Date.now(),
  };

  resultsStore.set(batchId, result);

  // 向量化存储（fire-and-forget）
  _indexEvaluationToVector(result).catch(err => {
    console.warn('[globalAgentService] Failed to index evaluation to vector storage:', err);
  });

  return { result, latencyMs: response.latencyMs };
}

/**
 * 核心分析函数：分析工作区执行结果并生成评价
 *
 * @param batchId - 批次 ID
 * @param workspaceResults - 工作区执行结果
 * @param config - Agent 配置
 * @returns 分析结果
 */
export async function analyzeWorkspaceResults(
  batchId: string,
  workspaceResults: DispatchWorkspaceResult[],
  config: GlobalAgentConfig,
): Promise<GlobalAgentResult> {
  // 优先尝试真实 AI 分析
  const realResult = await runRealAnalysis(batchId, workspaceResults, config);
  if (realResult) {
    return realResult.result;
  }

  // 回退到 Mock
  // 生成排名
  const rankings = generateRankings(workspaceResults);

  // 生成维度评分
  const scores: DimensionScore[] = ALL_DIMENSIONS.map(dimension => {
    // Mock 模式：根据排名分布生成合理的分数
    // 排名越高，各维度分数越高
    const avgRankScore =
      rankings.length > 0
        ? rankings.reduce((sum, r) => sum + r.totalScore, 0) / rankings.length
        : 5;

    // 添加一些随机波动 (-1.5 到 +1.5)
    const variance = (Math.random() - 0.5) * 3;
    const rawScore = avgRankScore + variance;

    // 确保分数在 1-10 范围内
    const score = Math.max(1, Math.min(10, Math.round(rawScore * 10) / 10));

    return {
      dimension,
      score,
      comment: generateDimensionComment(dimension, score, 'global'),
    };
  });

  // 生成评语、吐槽和建议
  const commentary = generateCommentary(rankings, scores);
  const roast = generateRoast(rankings);
  const recommendations = generateRecommendations(rankings, scores);

  // 构建结果
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

  // 存储结果
  resultsStore.set(batchId, result);

  // F-03-05: 评价结果向量化存储（RAG 检索增强），失败不影响主流程
  _indexEvaluationToVector(result).catch(err => {
    console.warn('[globalAgentService] Failed to index evaluation to vector storage:', err);
  });

  return result;
}

/**
 * 将评价结果向量化存入向量库（fire-and-forget）
 * F-03-05: 供 RAG 检索使用，便于检索历史评价经验。
 */
async function _indexEvaluationToVector(result: GlobalAgentResult): Promise<void> {
  try {
    const { indexAnswerChunks } = await import('@/stores/vectorStorage');

    // 拼接评价内容（commentary + roast + recommendations）
    const contentParts: string[] = [
      `[Commentary]\n${result.commentary}`,
      `[Roast]\n${result.roast}`,
      `[Recommendations]\n${result.recommendations.map((r, i) => `${i + 1}. ${r}`).join('\n')}`,
      `[Rankings]\n${result.rankings.map(r => `${r.rank}. ${r.workspaceName} (score: ${r.totalScore}/10)`).join('\n')}`,
      `[Scores]\n${result.scores.map(s => `${s.dimension}: ${s.score}/10 — ${s.comment}`).join('\n')}`,
    ];

    const content = contentParts.join('\n\n');
    const sessionId = result.batchId; // 复用 batchId 作为 sessionId
    const queryId = result.id;        // 评价结果 ID
    const workspacePath = 'global';    // 全局评价，使用 'global' 作为路径

    const metadata: Record<string, unknown> = {
      batchId: result.batchId,
      modelUsed: result.modelUsed,
      rankings: result.rankings,
      scores: result.scores,
      recommendations: result.recommendations,
      createdAt: result.createdAt,
    };

    await indexAnswerChunks(sessionId, queryId, workspacePath, content, metadata);
  } catch (err) {
    // 已在调用处统一处理警告，此处仅阻止异常外溢
    throw err;
  }
}

/**
 * 根据 batchId 查询分析结果
 *
 * @param batchId - 批次 ID
 * @returns 分析结果或 undefined
 */
export async function getGlobalAgentResult(
  batchId: string,
): Promise<GlobalAgentResult | undefined> {
  return resultsStore.get(batchId);
}

// ── 全局总结 ─────────────────────────────────────────────────────────────────

/** 全局总结输入 */
export interface GlobalSummaryInput {
  workspaceId: string;
  workspaceName: string;
  promptHistory: Array<{
    prompt: string;
    status: 'pending' | 'success' | 'failed';
    summary?: string;
    timestamp: number;
    queryId?: string;
  }>;
}

/**
 * 生成跨工作区全局总结
 *
 * Mock 模式：遍历所有工作区的 completed prompts，格式化为 Markdown 总结。
 * 生产模式可接入 LLM API。
 */
export async function generateGlobalSummary(
  inputs: GlobalSummaryInput[],
  _config: GlobalAgentConfig,
): Promise<string> {
  const lines: string[] = ['# 跨工作区全局总结\n'];

  let totalSuccess = 0;
  let totalFailed = 0;

  for (const ws of inputs) {
    const successPrompts = ws.promptHistory.filter(p => p.status === 'success');
    const failedPrompts = ws.promptHistory.filter(p => p.status === 'failed');
    totalSuccess += successPrompts.length;
    totalFailed += failedPrompts.length;

    lines.push(`## ${ws.workspaceName}`);
    lines.push('');

    if (successPrompts.length === 0 && failedPrompts.length === 0) {
      lines.push('> 暂无完成的 prompt\n');
      continue;
    }

    for (const p of ws.promptHistory) {
      if (p.status === 'failed') {
        lines.push(`- **Q**: ${p.prompt}`);
        lines.push(`  - ✗ 执行失败${p.summary ? `: ${p.summary}` : ''}\n`);
      } else if (p.status === 'success') {
        lines.push(`- **Q**: ${p.prompt}`);
        lines.push(`  - ✓ ${p.summary ?? '(无摘要)'}\n`);
      }
    }
  }

  // 汇总统计
  lines.push('---');
  lines.push('');
  lines.push(`**汇总**：共 ${totalSuccess + totalFailed} 个 prompt，${totalSuccess} 成功，${totalFailed} 失败。`);

  return lines.join('\n');
}

