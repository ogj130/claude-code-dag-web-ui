import { InboxIcon } from './Icons';

export type EmptyStateType = 'no-session' | 'no-history';

interface Props {
  type: EmptyStateType;
  onAction?: () => void;
}

const MESSAGES: Record<EmptyStateType, { icon: JSX.Element; title: string; subtitle: string; actionLabel?: string }> = {
  'no-session': {
    icon: <InboxIcon size={48} />,
    title: '暂无会话',
    subtitle: '点击下方按钮开始新会话',
    actionLabel: '+ 新建会话',
  },
  'no-history': {
    icon: <InboxIcon size={48} />,
    title: '暂无历史记录',
    subtitle: '您的会话历史将显示在这里',
  },
};

export function EmptyState({ type, onAction }: Props) {
  const msg = MESSAGES[type];

  return (
    <div className="empty-state">
      <div className="empty-state__icon">{msg.icon}</div>
      <div className="empty-state__title">{msg.title}</div>
      <div className="empty-state__subtitle">{msg.subtitle}</div>
      {msg.actionLabel && onAction && (
        <button className="empty-state__action" onClick={onAction}>
          {msg.actionLabel}
        </button>
      )}
    </div>
  );
}
