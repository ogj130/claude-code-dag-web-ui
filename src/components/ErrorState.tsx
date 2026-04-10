import { XIcon } from './Icons';

interface Props {
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({ message = '数据加载失败', onRetry }: Props) {
  return (
    <div className="error-state">
      <div className="error-state__icon">
        <XIcon size={48} />
      </div>
      <div className="error-state__title">{message}</div>
      {onRetry && (
        <button className="error-state__action" onClick={onRetry}>
          重新加载
        </button>
      )}
    </div>
  );
}
