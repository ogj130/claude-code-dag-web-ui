// Re-export TaskMetadata as Task for backwards compatibility
export type Task = TaskMetadata;

// Task status enum
export type TaskStatus = TaskStatusEnum;
export type TaskStatusEnum = 'pending' | 'running' | 'completed' | 'failed' | 'blocked';

// Task type - free string for flexibility
export type TaskType = string;

// Task with full metadata
export interface TaskMetadata {
  id: string;
  type: TaskType;
  description: string;
  status: TaskStatusEnum;
  dependencies: string[];  // Task IDs this task depends on
  parentId?: string;       // Parent task ID for tree structure
  priority: number;        // Higher = more important
  assignedTo?: string;     // Worker ID
  result?: unknown;        // Task execution result
  error?: string;          // Error message if failed
  createdAt: number;
  updatedAt: number;
  // Execution tracking
  toolCallCount?: number;
  retryCount?: number;
  reflections?: number;
  startTime?: number;
  endTime?: number;
}

// Task creation input (without auto-generated fields)
export interface CreateTaskInput {
  type: TaskType;
  description: string;
  dependencies?: string[];
  parentId?: string;
  priority?: number;
}

// Task update input
export interface UpdateTaskInput {
  status?: TaskStatusEnum;
  dependencies?: string[];  // Added this missing field
  assignedTo?: string;
  result?: unknown;
  error?: string;
  toolCallCount?: number;
  retryCount?: number;
  reflections?: number;
  startTime?: number;
  endTime?: number;
}

// Task tree node for visualization
export interface TaskTreeNode {
  task: TaskMetadata;
  children: TaskTreeNode[];
  depth: number;
}

// Dependency edge for graph visualization
export interface DependencyEdge {
  from: string;  // Source task ID
  to: string;     // Target task ID (depends on from)
}

// Circular dependency error
export class CircularDependencyError extends Error {
  constructor(public cycle: string[]) {
    super(`Circular dependency detected: ${cycle.join(' -> ')}`);
    this.name = 'CircularDependencyError';
  }
}

// Task not found error
export class TaskNotFoundError extends Error {
  constructor(public taskId: string) {
    super(`Task not found: ${taskId}`);
    this.name = 'TaskNotFoundError';
  }
}
