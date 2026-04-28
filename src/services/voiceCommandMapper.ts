/**
 * voiceCommandMapper — 语音命令识别映射
 *
 * 将用户语音输入映射为可执行的意图命令。
 * 支持中英文命令短语。
 *
 * 使用方式：
 *   import { mapVoiceCommand } from '@/services/voiceCommandMapper';
 *   const cmd = mapVoiceCommand('修复这个 bug');
 *   // { action: 'fix_bug', confidence: 0.9 }
 */

// ── 命令类型 ────────────────────────────────────────────────

export interface VoiceCommand {
  /** 命令动作 */
  action: VoiceAction;
  /** 匹配置信度 (0-1) */
  confidence: number;
  /** 命令参数（从语音中提取的补充信息） */
  params?: string;
  /** 匹配的原始文本 */
  matchedText: string;
}

export type VoiceAction =
  | 'fix_bug'
  | 'switch_model'
  | 'refactor'
  | 'run_tests'
  | 'commit_code'
  | 'explain_code'
  | 'create_file'
  | 'delete_file'
  | 'search'
  | 'undo'
  | 'redo'
  | 'format_code'
  | 'open_terminal'
  | 'toggle_sidebar'
  | 'unknown';

// ── 命令规则表 ──────────────────────────────────────────────

interface CommandRule {
  action: VoiceAction;
  patterns: RegExp[];
  confidence: number;
  extractParams?: (match: RegExpMatchArray) => string | undefined;
}

const COMMAND_RULES: CommandRule[] = [
  {
    action: 'fix_bug',
    patterns: [
      /fix\s+(?:the\s+)?bug/i,
      /修复(?:这个)?(?:bug|错误|问题)/,
      /修一下/,
      /debug(?:\s+this)?/i,
    ],
    confidence: 0.9,
  },
  {
    action: 'switch_model',
    patterns: [
      /switch\s+(?:the\s+)?model/i,
      /切换模型/,
      /换个?模型/,
      /change\s+model/i,
    ],
    confidence: 0.95,
  },
  {
    action: 'refactor',
    patterns: [
      /refactor(?:\s+this)?/i,
      /重构/,
      /优化(?:一下)?代码/,
      /clean\s+up/i,
    ],
    confidence: 0.85,
  },
  {
    action: 'run_tests',
    patterns: [
      /run\s+(?:the\s+)?tests?/i,
      /运行测试/,
      /跑一下测试/,
      /执行测试/,
    ],
    confidence: 0.9,
  },
  {
    action: 'commit_code',
    patterns: [
      /commit(?:\s+(?:the\s+)?(?:code|changes?))?/i,
      /提交(?:代码|变更)?/,
      /git\s+commit/i,
    ],
    confidence: 0.9,
  },
  {
    action: 'explain_code',
    patterns: [
      /explain(?:\s+this)?/i,
      /解释(?:一下)?(?:这段|这个)?代码/,
      /这段代码(?:是什么意思|干什么)/,
      /what\s+does\s+this\s+(?:do|mean)/i,
    ],
    confidence: 0.85,
  },
  {
    action: 'create_file',
    patterns: [
      /create\s+(?:a\s+)?(?:new\s+)?file/i,
      /创建(?:一个)?(?:新)?文件/,
      /新建文件/,
    ],
    confidence: 0.9,
    extractParams: (m) => {
      const idx = m.index ?? 0;
      const after = m.input?.slice(idx + m[0].length).trim();
      return after ? after.split(/\s+/).slice(0, 3).join(' ') : undefined;
    },
  },
  {
    action: 'delete_file',
    patterns: [
      /delete\s+(?:the\s+)?file/i,
      /删除(?:这个)?文件/,
    ],
    confidence: 0.9,
  },
  {
    action: 'search',
    patterns: [
      /search\s+(?:for\s+)?/i,
      /搜索/,
      /查找/,
      /找一?下/,
    ],
    confidence: 0.8,
    extractParams: (m) => {
      const idx = m.index ?? 0;
      const after = m.input?.slice(idx + m[0].length).trim();
      return after || undefined;
    },
  },
  {
    action: 'undo',
    patterns: [
      /\bundo\b/i,
      /撤销/,
    ],
    confidence: 0.95,
  },
  {
    action: 'redo',
    patterns: [
      /\bredo\b/i,
      /重做/,
    ],
    confidence: 0.95,
  },
  {
    action: 'format_code',
    patterns: [
      /format\s+(?:the\s+)?code/i,
      /格式化(?:代码)?/,
      /auto\s*format/i,
    ],
    confidence: 0.9,
  },
  {
    action: 'open_terminal',
    patterns: [
      /open\s+(?:the\s+)?terminal/i,
      /打开终端/,
    ],
    confidence: 0.9,
  },
  {
    action: 'toggle_sidebar',
    patterns: [
      /toggle\s+(?:the\s+)?sidebar/i,
      /切换侧边栏/,
      /关闭侧边栏/,
      /打开侧边栏/,
    ],
    confidence: 0.9,
  },
];

// ── 命令映射函数 ────────────────────────────────────────────

/**
 * 将语音文本映射为命令
 *
 * 按置信度降序匹配，返回最高分结果。
 */
export function mapVoiceCommand(text: string): VoiceCommand {
  const cleaned = text.trim();
  if (!cleaned) {
    return { action: 'unknown', confidence: 0, matchedText: text };
  }

  let bestMatch: VoiceCommand | null = null;

  for (const rule of COMMAND_RULES) {
    for (const pattern of rule.patterns) {
      const match = cleaned.match(pattern);
      if (match) {
        const cmd: VoiceCommand = {
          action: rule.action,
          confidence: rule.confidence,
          matchedText: match[0],
          params: rule.extractParams?.(match),
        };

        if (!bestMatch || cmd.confidence > bestMatch.confidence) {
          bestMatch = cmd;
        }
        break; // 同规则内只取第一个匹配
      }
    }
  }

  return bestMatch ?? { action: 'unknown', confidence: 0, matchedText: text };
}

/**
 * 检测语音文本是否包含可识别命令
 */
export function hasVoiceCommand(text: string): boolean {
  return mapVoiceCommand(text).action !== 'unknown';
}

/**
 * 获取所有可用命令的说明（用于帮助文档）
 */
export function getAvailableCommands(): Array<{ action: VoiceAction; examples: string[] }> {
  return [
    { action: 'fix_bug', examples: ['fix bug', '修复bug', '修一下'] },
    { action: 'switch_model', examples: ['switch model', '切换模型'] },
    { action: 'refactor', examples: ['refactor this', '重构', '优化代码'] },
    { action: 'run_tests', examples: ['run tests', '运行测试'] },
    { action: 'commit_code', examples: ['commit', '提交代码'] },
    { action: 'explain_code', examples: ['explain this', '解释代码'] },
    { action: 'create_file', examples: ['create file', '创建文件'] },
    { action: 'search', examples: ['search for', '搜索'] },
    { action: 'undo', examples: ['undo', '撤销'] },
    { action: 'redo', examples: ['redo', '重做'] },
    { action: 'format_code', examples: ['format code', '格式化代码'] },
    { action: 'open_terminal', examples: ['open terminal', '打开终端'] },
    { action: 'toggle_sidebar', examples: ['toggle sidebar', '切换侧边栏'] },
  ];
}
