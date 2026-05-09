/**
 * FlowTemplates — Built-in flow templates and empty flow constant
 * Extracted from VisualFlowBuilder.tsx
 */

import type { Flow } from './FlowTypes';

export const BUILTIN_TEMPLATES: { id: string; name: string; description: string; flow: Flow }[] = [  // line 337
  {
    id: 'tpl_linear',
    name: '线性任务流',
    description: '简单的输入 → 分析 → 生成 → 输出流水线',
    flow: {
      name: '线性任务流',
      description: '经典的四步线性流程',
      created: Date.now(),
      nodes: [
        { id: 'n1', type: 'input', label: '用户输入', x: 60, y: 180, status: 'idle' },
        { id: 'n2', type: 'task', label: '代码分析', x: 260, y: 170, status: 'idle', config: { command: 'analyze' } },
        { id: 'n3', type: 'task', label: '代码生成', x: 500, y: 170, status: 'idle', config: { command: 'generate' } },
        { id: 'n4', type: 'output', label: '最终输出', x: 740, y: 180, status: 'idle' },
      ],
      edges: [
        { id: 'e1', source: 'n1', target: 'n2' },
        { id: 'e2', source: 'n2', target: 'n3' },
        { id: 'e3', source: 'n3', target: 'n4' },
      ],
    },
  },
  {
    id: 'tpl_decision',
    name: '条件分支流',
    description: '包含决策节点的条件分支流程',
    flow: {
      name: '条件分支流',
      description: '支持条件判断的分支流程，包含成功和错误处理路径',
      created: Date.now(),
      nodes: [
        { id: 'n1', type: 'input', label: '任务输入', x: 40, y: 140, status: 'idle' },
        { id: 'n2', type: 'task', label: '预处理', x: 220, y: 130, status: 'idle', config: { command: 'preprocess' } },
        {
          id: 'n3',
          type: 'decision',
          label: '质量检查',
          x: 430,
          y: 110,
          status: 'idle',
          config: { condition: 'quality > 0.8' },
        },
        { id: 'n4', type: 'task', label: '优化处理', x: 600, y: 60, status: 'idle', config: { command: 'optimize' } },
        { id: 'n5', type: 'task', label: '错误处理', x: 600, y: 240, status: 'idle', config: { command: 'error_handle' } },
        { id: 'n6', type: 'output', label: '成功输出', x: 820, y: 70, status: 'idle' },
        { id: 'n7', type: 'output', label: '错误报告', x: 820, y: 250, status: 'idle' },
      ],
      edges: [
        { id: 'e1', source: 'n1', target: 'n2' },
        { id: 'e2', source: 'n2', target: 'n3' },
        { id: 'e3', source: 'n3', target: 'n4', sourceHandle: 'true', label: 'true' },
        { id: 'e4', source: 'n3', target: 'n5', sourceHandle: 'false', label: 'false' },
        { id: 'e5', source: 'n4', target: 'n6' },
        { id: 'e6', source: 'n5', target: 'n7' },
      ],
    },
  },
  {
    id: 'tpl_pipeline',
    name: '数据流水线',
    description: '多阶段数据处理流水线',
    flow: {
      name: '数据流水线',
      description: '采集 → 清洗 → 分析 → 汇报的四阶段数据处理流水线',
      created: Date.now(),
      nodes: [
        { id: 'n1', type: 'input', label: '数据源', x: 40, y: 180, status: 'idle' },
        { id: 'n2', type: 'template', label: '数据采集', x: 220, y: 170, status: 'idle', config: { template: 'collector' } },
        { id: 'n3', type: 'template', label: '数据清洗', x: 440, y: 170, status: 'idle', config: { template: 'cleaner' } },
        { id: 'n4', type: 'task', label: '统计分析', x: 660, y: 170, status: 'idle', config: { command: 'analyze_stats' } },
        { id: 'n5', type: 'output', label: '分析报告', x: 880, y: 180, status: 'idle' },
      ],
      edges: [
        { id: 'e1', source: 'n1', target: 'n2' },
        { id: 'e2', source: 'n2', target: 'n3' },
        { id: 'e3', source: 'n3', target: 'n4' },
        { id: 'e4', source: 'n4', target: 'n5' },
      ],
    },
  },
  {
    id: 'tpl_ceo_agent',
    name: 'CEO Agent 编排',
    description: 'CEO规划 → Context → Planning → Execution → CEO总结',
    flow: {
      name: 'CEO Agent 编排',
      description: '标准的多Agent流水线：上下文分析→方案设计→代码实现→结果汇总',
      created: Date.now(),
      nodes: [
        { id: 'ceo', type: 'input', label: 'CEO 接收需求', x: 40, y: 60 },
        { id: 'ctx', type: 'agent', label: 'ContextAgent', x: 260, y: 50, agentType: 'context', agentDescription: '分析项目上下文' },
        { id: 'pln', type: 'agent', label: 'PlanningAgent', x: 520, y: 50, agentType: 'planning', agentDescription: '设计架构方案' },
        { id: 'exe', type: 'agent', label: 'ExecutionAgent', x: 780, y: 50, agentType: 'execution', agentDescription: '编写实现代码' },
        { id: 'sum', type: 'output', label: 'CEO 总结报告', x: 1040, y: 60 },
      ],
      edges: [
        { id: 'e1', source: 'ceo', target: 'ctx' },
        { id: 'e2', source: 'ctx', target: 'pln' },
        { id: 'e3', source: 'pln', target: 'exe' },
        { id: 'e4', source: 'exe', target: 'sum' },
      ],
    },
  },
];

export const EMPTY_FLOW: Flow = {
  name: '新建流程',
  description: '',
  created: Date.now(),
  nodes: [],
  edges: [],
};
