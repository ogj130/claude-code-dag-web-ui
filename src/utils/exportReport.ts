import type { ComparisonResult } from '@/types/globalAgent';

const DIMENSION_LABELS: Record<string, string> = {
  fileQuantity: '文件数量', fileDiversity: '类型多样性',
  codeDocRatio: '代码文档比', modificationDensity: '修改密度',
  codeQuality: '代码质量', correctness: '正确性',
  performance: '性能', consistency: '一致性',
  creativity: '创意', costEfficiency: '成本效率', speed: '速度',
};

function renderAsciiHeatmap(result: ComparisonResult): string {
  const wsIds = Object.keys(result.heatmapData);
  if (wsIds.length === 0) return '暂无数据\n';

  const allDims = Array.from(new Set(
    wsIds.flatMap(wsId => Object.keys(result.heatmapData[wsId] ?? {}))
  ));
  const wsNames = wsIds.map(id =>
    result.compositeRanking.find(r => r.workspaceId === id)?.workspaceName ?? id
  );

  function scoreChar(score: number): string {
    if (score >= 6) return '■';
    return '□';
  }

  let lines: string[] = [];
  lines.push(`工作区        ${allDims.map(d => DIMENSION_LABELS[d] ?? d).join(' ')}`);
  lines.push('─'.repeat(80));
  for (let i = 0; i < wsIds.length; i++) {
    const wsId = wsIds[i];
    const cells = allDims.map(dim => {
      const score = result.heatmapData[wsId]?.[dim] ?? 0;
      return scoreChar(score);
    });
    lines.push(`${wsNames[i].padEnd(12)} ${cells.join(' ')}`);
  }
  return lines.join('\n');
}

export function exportMarkdown(result: ComparisonResult): void {
  const date = new Date(result.generatedAt).toLocaleString('zh-CN');
  const medals = ['🥇', '🥈', '🥉'];

  let md = `# 全局分区多维度对比报告

**生成时间**: ${date}

---

## 综合排名

| 排名 | 工作区 | 综合分 |
|------|--------|--------|
`;
  for (const r of result.compositeRanking.slice(0, 5)) {
    const medal = medals[r.rank - 1] ?? '';
    md += `| ${medal} ${r.rank} | ${r.workspaceName} | ${r.totalScore.toFixed(1)} |\n`;
  }

  md += `
---

## 热力图矩阵

\`\`\`
${renderAsciiHeatmap(result)}
\`\`\`

---

## 各维度排名

`;
  for (const dimRank of result.dimensionRankings) {
    const dimLabel = DIMENSION_LABELS[dimRank.dimension] ?? dimRank.dimension;
    md += `### ${dimLabel}\n\n`;
    md += `| 排名 | 工作区 | 得分 |\n|------|--------|------|\n`;
    for (const item of dimRank.rankings.slice(0, 5)) {
      md += `| ${item.rank} | ${item.workspaceName} | ${item.score.toFixed(1)} |\n`;
    }
    md += '\n';
  }

  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `comparison-report-${Date.now()}.md`;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportHtml(result: ComparisonResult): void {
  const date = new Date(result.generatedAt).toLocaleString('zh-CN');
  const medals = ['🥇', '🥈', '🥉'];

  const rows = result.compositeRanking.map(r => {
    const medal = medals[r.rank - 1] ?? '';
    return `<tr><td>${medal}</td><td>${r.workspaceName}</td><td>${r.totalScore.toFixed(1)}</td></tr>`;
  }).join('\n');

  const dimSections = result.dimensionRankings.map(dimRank => {
    const dimLabel = DIMENSION_LABELS[dimRank.dimension] ?? dimRank.dimension;
    const dimRows = dimRank.rankings.slice(0, 5).map(item =>
      `<tr><td>${item.rank}</td><td>${item.workspaceName}</td><td>${item.score.toFixed(1)}</td></tr>`
    ).join('\n');
    return `<h3>${dimLabel}</h3>
<table><thead><tr><th>排名</th><th>工作区</th><th>得分</th></tr></thead><tbody>${dimRows}</tbody></table>`;
  }).join('\n');

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>全局分区多维度对比报告</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 900px; margin: 0 auto; padding: 24px; color: #333; }
  h1 { color: #1a7f37; }
  table { border-collapse: collapse; width: 100%; margin: 16px 0; }
  th, td { border: 1px solid #e5e5e5; padding: 8px 12px; text-align: left; }
  th { background: #f5f5f5; font-weight: 600; }
  pre { background: #f5f5f5; padding: 12px; border-radius: 6px; overflow-x: auto; font-size: 12px; }
  .timestamp { color: #888; font-size: 12px; }
</style>
</head>
<body>
<h1>全局分区多维度对比报告</h1>
<p class="timestamp">生成时间: ${date}</p>

<h2>综合排名</h2>
<table>
  <thead><tr><th>排名</th><th>工作区</th><th>综合分</th></tr></thead>
  <tbody>${rows}</tbody>
</table>

<h2>热力图矩阵</h2>
<pre>${renderAsciiHeatmap(result)}</pre>

<h2>各维度排名</h2>
${dimSections}
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `comparison-report-${Date.now()}.html`;
  a.click();
  URL.revokeObjectURL(url);
}
