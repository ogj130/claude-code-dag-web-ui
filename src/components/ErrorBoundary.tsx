import { Component, ErrorInfo, ReactNode } from 'react';
import { ErrorFallback } from './ErrorFallback';
import { appendErrorLog } from '../utils/errorLogger';

interface Props {
  children: ReactNode;
  /** 组件名称，用于日志标识 */
  name?: string;
  /** 额外的重置回调 */
  onReset?: () => void;
  /** 是否在组件树中静默错误（不显示 UI，仅记录日志） */
  silent?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // 记录错误到 localStorage
    const componentStack = errorInfo.componentStack;
    appendErrorLog(
      error.message,
      error.stack,
      typeof componentStack === 'string' ? componentStack : undefined
    );

    this.setState({ errorInfo });
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    this.props.onReset?.();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.silent) {
        return null;
      }

      const label = this.props.name ? `${this.props.name} 组件出错` : '组件渲染出错';

      return <ErrorFallback message={label} onReset={this.handleReset} />;
    }

    return this.props.children;
  }
}
