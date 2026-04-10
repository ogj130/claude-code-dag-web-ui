/** 骨架屏组件，支持 Session（会话列表）和 DAG（执行图）两种模式 */

export type SkeletonType = 'session' | 'dag';

interface Props {
  type: SkeletonType;
}

// ── Session 骨架屏 ─────────────────────────────────────────
function SessionSkeleton() {
  return (
    <div className="skeleton-session">
      {[80, 65, 75, 60, 70].map((w, i) => (
        <div key={i} className="skeleton-session__item">
          <div className="skeleton-line" style={{ width: `${w}%`, height: 14 }} />
        </div>
      ))}
    </div>
  );
}

// ── DAG 骨架屏 ────────────────────────────────────────────
function DAGSkeleton() {
  return (
    <div className="skeleton-dag">
      {/* 顶部 agent 节点 */}
      <div className="skeleton-dag__agent" />
      {/* 连接线 */}
      <div className="skeleton-dag__connector" />
      {/* 两层 query 链 */}
      <div className="skeleton-dag__chain">
        <div className="skeleton-dag__query" />
        <div className="skeleton-dag__tools">
          <div className="skeleton-dag__tool" />
          <div className="skeleton-dag__tool" />
          <div className="skeleton-dag__tool" />
        </div>
        <div className="skeleton-dag__summary" />
      </div>
      <div className="skeleton-dag__chain">
        <div className="skeleton-dag__query" />
        <div className="skeleton-dag__tools">
          <div className="skeleton-dag__tool" />
          <div className="skeleton-dag__tool" />
        </div>
        <div className="skeleton-dag__summary" />
      </div>
    </div>
  );
}

export function LoadingSkeleton({ type }: Props) {
  if (type === 'dag') return <DAGSkeleton />;
  return <SessionSkeleton />;
}
