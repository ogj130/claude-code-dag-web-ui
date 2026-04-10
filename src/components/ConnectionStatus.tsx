import type { ConnectionState } from '../hooks/useWebSocketState';
import './ConnectionStatus.css';

interface ConnectionStatusProps {
  /** 当前连接状态 */
  state: ConnectionState;
  /** 当前重试次数（0-based） */
  retryCount: number;
  /** 手动重连回调 */
  onReconnect: () => void;
}

const MAX_RETRIES = 3;

const STATE_LABEL: Record<ConnectionState, string> = {
  disconnected: 'Disconnected',
  connecting: 'Connecting...',
  connected: 'Connected',
  reconnecting: 'Reconnecting...',
  failed: 'Connection Failed',
};

export function ConnectionStatus({ state, retryCount, onReconnect }: ConnectionStatusProps) {
  const isManualReconnectable = state === 'disconnected' || state === 'failed';

  return (
    <div className="connection-status" data-state={state}>
      <span className="connection-status__dot" />
      <span className="connection-status__label">
        {STATE_LABEL[state]}
        {state === 'reconnecting' && ` (${retryCount + 1}/${MAX_RETRIES})`}
      </span>
      {isManualReconnectable && (
        <button
          className="connection-status__reconnect-btn"
          onClick={onReconnect}
          title="Reconnect"
        >
          Reconnect
        </button>
      )}
    </div>
  );
}
