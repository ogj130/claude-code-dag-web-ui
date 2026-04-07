/** 内联 SVG 图标集（统一风格：1.5px 描边，Lucide 风格） */

const S = ({ d, size = 16, ...p }: { d: string; size?: number; [k: string]: unknown }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size} height={size} viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth={1.8}
    strokeLinecap="round" strokeLinejoin="round"
    {...p}
  >
    <path d={d} />
  </svg>
);

// ── 界面图标 ──────────────────────────────────────────────
export const TerminalIcon = ({ size = 15, ...p }: { size?: number; [k: string]: unknown }) =>
  <S size={size} {...p} d="M3 7l7 5-7 5M13 17h6" />;

export const GridIcon = ({ size = 15, ...p }: { size?: number; [k: string]: unknown }) =>
  <S size={size} {...p} d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z" />;

export const SpinnerIcon = ({ size = 12, ...p }: { size?: number; [k: string]: unknown }) =>
  <S size={size} {...p} d="M12 2a10 10 0 0 1 10 10" style={{ animation: 'spin 1s linear infinite', transformOrigin: 'center' }} />;

// ── 工具图标 ──────────────────────────────────────────────
export const BashIcon = ({ size = 12, ...p }: { size?: number; [k: string]: unknown }) =>
  <S size={size} {...p} d="M4 17l6-6-6-6M12 19h8" />;

export const FileIcon = ({ size = 12, ...p }: { size?: number; [k: string]: unknown }) =>
  <S size={size} {...p} d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6" />;

export const EditIcon = ({ size = 12, ...p }: { size?: number; [k: string]: unknown }) =>
  <S size={size} {...p} d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7 M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />;

export const GrepIcon = ({ size = 12, ...p }: { size?: number; [k: string]: unknown }) =>
  <S size={size} {...p} d="M11 11m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0M21 21l-4.35-4.35" />;

export const SearchIcon = ({ size = 12, ...p }: { size?: number; [k: string]: unknown }) =>
  <S size={size} {...p} d="M11 11m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0M21 21l-4.35-4.35" />;

export const AgentIcon = ({ size = 12, ...p }: { size?: number; [k: string]: unknown }) =>
  <S size={size} {...p} d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />;

export const CheckIcon = ({ size = 11, ...p }: { size?: number; [k: string]: unknown }) =>
  <S size={size} {...p} d="M20 6L9 17l-5-5" />;

export const XIcon = ({ size = 11, ...p }: { size?: number; [k: string]: unknown }) =>
  <S size={size} {...p} d="M18 6L6 18M6 6l12 12" />;

export const ChevronRightIcon = ({ size = 12, ...p }: { size?: number; [k: string]: unknown }) =>
  <S size={size} {...p} d="M9 18l6-6-6-6" />;

export const InboxIcon = ({ size = 32, ...p }: { size?: number; [k: string]: unknown }) =>
  <S size={size} {...p} d="M22 12h-6l-2 3h-4l-2-3H2M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />;

/** 获取工具图标组件 */
export function ToolIcon({ tool, size = 12, ...p }: { tool: string; size?: number; [k: string]: unknown }) {
  const t = tool.toLowerCase();
  if (t.includes('bash') || t.includes('shell') || t.includes('exec')) return <BashIcon size={size} {...p} />;
  if (t.includes('read') || t.includes('cat') || t.includes('glob')) return <FileIcon size={size} {...p} />;
  if (t.includes('write') || t.includes('create')) return <EditIcon size={size} {...p} />;
  if (t.includes('edit') || t.includes('patch')) return <EditIcon size={size} {...p} />;
  if (t.includes('grep') || t.includes('search')) return <SearchIcon size={size} {...p} />;
  if (t.includes('agent')) return <AgentIcon size={size} {...p} />;
  return <TerminalIcon size={size} {...p} />;
}
