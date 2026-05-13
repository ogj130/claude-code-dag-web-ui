/**
 * WorkspaceTerminalPane — 工作区页容器
 *
 * 分层结构：历史区（可滚动） + 当前工作台（固定底部）
 */

interface WorkspaceTerminalPaneProps {
  historyCards?: React.ReactNode;
  previousCard?: React.ReactNode;
  currentCard?: React.ReactNode;
  summaryContent?: React.ReactNode;
  terminalNode?: React.ReactNode;
  inputNode?: React.ReactNode;
}

export function WorkspaceTerminalPane({
  historyCards,
  previousCard,
  currentCard,
  summaryContent,
  terminalNode,
  inputNode,
}: WorkspaceTerminalPaneProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
      }}
    >
      {/* 历史区：可滚动 */}
      <div
        data-testid="workspace-history-region"
        style={{
          flex: 1,
          overflowY: 'auto',
          minHeight: 0,
          padding: '4px 8px',
        }}
      >
        {historyCards}
        {previousCard}
      </div>

      {/* 当前工作台：固定底部 */}
      <div
        data-testid="workspace-current-workbench"
        style={{
          flexShrink: 0,
          borderTop: '1px solid var(--border)',
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {currentCard}
        {summaryContent}
        {terminalNode}
        {inputNode}
      </div>
    </div>
  );
}
