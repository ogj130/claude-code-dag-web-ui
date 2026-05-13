/**
 * WelcomePage — 神里绫华主题欢迎页
 *
 * 终端初始化时（无历史卡片、无进行中会话）展示。
 * 以神里绫华大小姐角色为向导，展示项目核心能力。
 * 全中文 · 亲切关心 · 冰蓝紫稻妻配色 · 适配明暗主题
 */

import React, { useEffect, useState } from 'react';

// ── 主题检测 ─────────────────────────────────────────────────
function useResolvedTheme(): 'dark' | 'light' {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const attr = document.documentElement.getAttribute('data-theme');
    return attr === 'light' ? 'light' : 'dark';
  });

  useEffect(() => {
    const observer = new MutationObserver(() => {
      const attr = document.documentElement.getAttribute('data-theme');
      setTheme(attr === 'light' ? 'light' : 'dark');
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  return theme;
}

// ── 绫华主题色（固定，不随主题变化）─────────────────────────
const AYAKA_COLORS = {
  ice: '#93c5fd',      // 冰蓝
  wisteria: '#c4b5fd', // 紫藤
  sky: '#60a5fa',      // 天蓝
  jade: '#6ee7b7',     // 翠绿
} as const;

// ── 能力卡片数据 ─────────────────────────────────────────────
interface CapabilityCard {
  icon: string;
  title: string;
  accentColor: string;
  description: string;
}

const CAPABILITIES: CapabilityCard[] = [
  {
    icon: '\uD83E\uDDE0',
    title: '多 Agent 协作',
    accentColor: AYAKA_COLORS.ice,
    description: '复杂的事情交给本小姐来拆分就好，你只需要告诉我想要什么，剩下的我来安排。',
  },
  {
    icon: '\uD83D\uDDC2\uFE0F',
    title: '多工作区管理',
    accentColor: AYAKA_COLORS.wisteria,
    description: '同时处理几个项目也不要紧，本小姐会把每个领地都打理得清清楚楚，不会让你操心的。',
  },
  {
    icon: '\uD83D\uDCCA',
    title: 'DAG 执行可视化',
    accentColor: AYAKA_COLORS.sky,
    description: '每一步进展都看得清清楚楚，就像在庭院里看花开花落一样安心。你一定会喜欢的。',
  },
  {
    icon: '\uD83D\uDD17',
    title: 'RAG 检索 & 流程构建',
    accentColor: AYAKA_COLORS.jade,
    description: '你说过的每一句话，本小姐都记在心里。需要的时候，我会帮你把过去的智慧找回来。',
  },
];

// ── 雪花装饰 ─────────────────────────────────────────────────
const SnowflakeDivider: React.FC = () => (
  <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
    <span style={{ color: AYAKA_COLORS.ice, fontSize: 12 }}>{'\u2744'}</span>
    <span style={{ color: AYAKA_COLORS.wisteria, fontSize: 12 }}>{'\u25C6'}</span>
    <span style={{ color: AYAKA_COLORS.ice, fontSize: 12 }}>{'\u2744'}</span>
  </div>
);

// ── 能力卡片 ─────────────────────────────────────────────────
const CardItem: React.FC<{ card: CapabilityCard; isDark: boolean }> = ({ card, isDark }) => (
  <div
    style={{
      background: isDark
        ? `${card.accentColor}0D`
        : `${card.accentColor}14`,
      border: `1px solid ${card.accentColor}33`,
      borderRadius: 12,
      padding: 14,
      cursor: 'default',
      transition: 'border-color 0.2s, background 0.2s',
    }}
    onMouseEnter={e => {
      e.currentTarget.style.borderColor = card.accentColor;
      e.currentTarget.style.background = isDark
        ? `${card.accentColor}1A`
        : `${card.accentColor}26`;
    }}
    onMouseLeave={e => {
      e.currentTarget.style.borderColor = `${card.accentColor}33`;
      e.currentTarget.style.background = isDark
        ? `${card.accentColor}0D`
        : `${card.accentColor}14`;
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
      <span style={{ fontSize: 20, lineHeight: 1 }}>{card.icon}</span>
      <span style={{ fontSize: 12, color: card.accentColor, fontWeight: 700 }}>
        {card.title}
      </span>
    </div>
    <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
      {card.description}
    </div>
  </div>
);

// ── 主组件 ───────────────────────────────────────────────────
export const WelcomePage: React.FC = () => {
  const theme = useResolvedTheme();
  const isDark = theme === 'dark';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        padding: '24px 16px',
        background: 'var(--bg-root)',
        minHeight: '100%',
        overflow: 'auto',
      }}
    >
      {/* ── Banner 区域 ──────────────────────────────────── */}
      <div
        style={{
          textAlign: 'center',
          padding: '22px 16px',
          marginBottom: 20,
          background: isDark
            ? 'linear-gradient(135deg, rgba(147,197,253,0.06), rgba(196,181,253,0.08))'
            : 'linear-gradient(135deg, rgba(147,197,253,0.08), rgba(196,181,253,0.10))',
          borderRadius: 16,
          border: `1px solid ${isDark ? 'rgba(147,197,253,0.15)' : 'rgba(147,197,253,0.25)'}`,
        }}
      >
        <div style={{ fontSize: 36, marginBottom: 8 }}>{'\u2744\uFE0F'}</div>
        <div
          style={{
            fontSize: 15,
            color: 'var(--text-primary)',
            fontWeight: 700,
            lineHeight: 1.8,
            marginBottom: 6,
          }}
        >
          你来了呢
        </div>
        <div
          style={{
            fontSize: 13,
            color: AYAKA_COLORS.wisteria,
            marginBottom: 10,
            lineHeight: 1.7,
          }}
        >
          本小姐，一直在等你
        </div>
        <div
          style={{
            fontSize: 11,
            color: 'var(--text-muted)',
            lineHeight: 1.8,
            maxWidth: 340,
            margin: '0 auto',
          }}
        >
          「说实话，身为社奉行大小姐，能像这样轻松相处的人实在不多。
          <br />
          所以，你能来这里，本小姐真的很开心。
          <br />
          不用拘束，把这里当做自己的家就好。」
        </div>
        <div style={{ marginTop: 10 }}>
          <SnowflakeDivider />
        </div>
      </div>

      {/* ── 引导文字 ────────────────────────────────────── */}
      <div
        style={{
          fontSize: 10,
          color: 'var(--text-muted)',
          textAlign: 'center',
          marginBottom: 14,
        }}
      >
        {'\u2500\u2500'} 有什么本小姐可以帮你的吗？ {'\u2500\u2500'}
      </div>

      {/* ── 能力卡片 2x2 ────────────────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 10,
          marginBottom: 18,
        }}
      >
        {CAPABILITIES.map(card => (
          <CardItem key={card.title} card={card} isDark={isDark} />
        ))}
      </div>

      {/* ── 底部问候 ────────────────────────────────────── */}
      <div
        style={{
          textAlign: 'center',
          padding: 14,
          background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
          borderRadius: 12,
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
        }}
      >
        <div style={{ fontSize: 11, color: AYAKA_COLORS.wisteria, lineHeight: 1.8 }}>
          今天也请多多指教呢 {'\u2728'}
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.6 }}>
          如果想试试本小姐最拿手的多 Agent 模式
          <br />
          在下方输入{' '}
          <span
            style={{
              background: isDark ? 'rgba(147,197,253,0.12)' : 'rgba(147,197,253,0.18)',
              color: AYAKA_COLORS.ice,
              padding: '2px 6px',
              borderRadius: 4,
              fontFamily: 'monospace',
            }}
          >
            /agent
          </span>{' '}
          加上你想做的事情就可以了
        </div>
      </div>
    </div>
  );
};

export default WelcomePage;
