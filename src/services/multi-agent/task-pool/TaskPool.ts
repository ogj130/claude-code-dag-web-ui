import { nanoid } from 'nanoid';
import type {
  TaskMetadata,
  CreateTaskInput,
  UpdateTaskInput,
  TaskTreeNode,
  TaskStatusEnum,
} from '@/types/multi-agent/task-pool';
import { CircularDependencyError, TaskNotFoundError } from '@/types/multi-agent/task-pool';

/**
 * TaskPool - Manages tasks with dependency tracking
 * 
 * Features:
 * - DAG-based dependency management
 * - Circular dependency detection
 * - Task status tracking
 * - Tree traversal for subtasks
 */
export class TaskPool {
  private tasks: Map<string, TaskMetadata> = new Map();

  /**
   * Create a new task
   */
  addTask(input: CreateTaskInput): string {
    const id = nanoid(10);
    const now = Date.now();
    
    const task: TaskMetadata = {
      id,
      type: input.type,
      description: input.description,
      status: 'pending',
      dependencies: input.dependencies || [],
      parentId: input.parentId,
      priority: input.priority || 0,
      createdAt: now,
      updatedAt: now,
      toolCallCount: 0,
      retryCount: 0,
      reflections: 0,
    };

    // Validate dependencies exist
    for (const depId of task.dependencies) {
      if (!this.tasks.has(depId)) {
        // We'll allow pending dependencies - they might be added later
      }
    }

    this.tasks.set(id, task);
    return id;
  }

  /**
   * Update a task
   */
  updateTask(id: string, updates: UpdateTaskInput): void {
    const task = this.tasks.get(id);
    if (!task) {
      throw new TaskNotFoundError(id);
    }

    // Check for circular dependencies if adding new ones
    if (updates.dependencies) {
      this.validateNoCircularDependencies(id, updates.dependencies);
    }

    Object.assign(task, updates, { updatedAt: Date.now() });
  }

  /**
   * Update task status with proper transitions
   */
  updateStatus(id: string, status: TaskStatusEnum): void {
    const task = this.tasks.get(id);
    if (!task) {
      throw new TaskNotFoundError(id);
    }

    // Validate status transition
    const validTransitions: Record<TaskStatusEnum, TaskStatusEnum[]> = {
      pending: ['running', 'failed', 'blocked'],
      running: ['completed', 'failed', 'blocked'],
      completed: [],  // Terminal state
      failed: ['pending'],  // Can retry
      blocked: ['pending'],  // Can unblock
    };

    if (!validTransitions[task.status].includes(status)) {
      console.warn(`Invalid status transition: ${task.status} -> ${status}`);
    }

    task.status = status;
    task.updatedAt = Date.now();

    // If task completed or failed, check dependent tasks
    if (status === 'completed' || status === 'failed') {
      this.updateDependentTasks(id, status);
    }
  }

  /**
   * Get a task by ID
   */
  getTask(id: string): TaskMetadata | undefined {
    return this.tasks.get(id);
  }

  /**
   * Get all tasks
   */
  getAllTasks(): TaskMetadata[] {
    return Array.from(this.tasks.values());
  }

  /**
   * Get tasks that are ready to execute (all dependencies completed)
   */
  getReadyTasks(): TaskMetadata[] {
    return Array.from(this.tasks.values()).filter(task => {
      if (task.status !== 'pending') return false;
      
      // Check all dependencies are completed
      return task.dependencies.every(depId => {
        const dep = this.tasks.get(depId);
        return dep?.status === 'completed';
      });
    });
  }

  /**
   * Get tasks assigned to a specific worker
   */
  getWorkerTasks(workerId: string): TaskMetadata[] {
    return Array.from(this.tasks.values()).filter(
      task => task.assignedTo === workerId
    );
  }

  /**
   * Get task tree (all descendants)
   */
  getTaskTree(rootId: string): TaskTreeNode[] {
    const root = this.tasks.get(rootId);
    if (!root) throw new TaskNotFoundError(rootId);

    const buildTree = (task: TaskMetadata, depth: number): TaskTreeNode => {
      const children = Array.from(this.tasks.values())
        .filter(t => t.parentId === task.id)
        .map(child => buildTree(child, depth + 1));

      return { task, children, depth };
    };

    return [buildTree(root, 0)];
  }

  /**
   * Get all descendant task IDs
   */
  getDescendantIds(taskId: string): string[] {
    const descendants: string[] = [];
    
    const collect = (id: string) => {
      Array.from(this.tasks.values())
        .filter(t => t.parentId === id)
        .forEach(child => {
          descendants.push(child.id);
          collect(child.id);
        });
    };
    
    collect(taskId);
    return descendants;
  }

  /**
   * Remove a task
   */
  removeTask(id: string): void {
    if (!this.tasks.has(id)) {
      throw new TaskNotFoundError(id);
    }

    // Remove from any dependency lists
    this.tasks.forEach(task => {
      task.dependencies = task.dependencies.filter(depId => depId !== id);
    });

    this.tasks.delete(id);
  }

  /**
   * Track tool call for a task
   */
  trackToolCall(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (task) {
      task.toolCallCount = (task.toolCallCount || 0) + 1;
      task.updatedAt = Date.now();
    }
  }

  /**
   * Track retry for a task
   */
  trackRetry(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (task) {
      task.retryCount = (task.retryCount || 0) + 1;
      task.updatedAt = Date.now();
    }
  }

  /**
   * Track reflection for a task
   */
  trackReflection(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (task) {
      task.reflections = (task.reflections || 0) + 1;
      task.updatedAt = Date.now();
    }
  }

  /**
   * Get tasks by status
   */
  getTasksByStatus(status: TaskStatusEnum): TaskMetadata[] {
    return Array.from(this.tasks.values()).filter(t => t.status === status);
  }

  /**
   * Clear all completed tasks (cleanup)
   */
  clearCompleted(): number {
    const completedIds = Array.from(this.tasks.values())
      .filter(t => t.status === 'completed')
      .map(t => t.id);

    completedIds.forEach(id => this.tasks.delete(id));
    return completedIds.length;
  }

  // Private helpers

  /**
   * Validate no circular dependencies would be introduced
   */
  private validateNoCircularDependencies(taskId: string, newDeps: string[]): void {
    const visited = new Set<string>();
    
    const dfs = (id: string, path: string[]): void => {
      if (id === taskId) {
        throw new CircularDependencyError([...path, id]);
      }
      if (visited.has(id)) return;
      visited.add(id);

      const task = this.tasks.get(id);
      if (task) {
        for (const depId of task.dependencies) {
          dfs(depId, [...path, id]);
        }
      }
    };

    for (const depId of newDeps) {
      dfs(depId, []);
    }
  }

  /**
   * Update tasks that depend on a completed/failed task
   */
  private updateDependentTasks(completedId: string, status: TaskStatusEnum): void {
    Array.from(this.tasks.values()).forEach(task => {
      if (task.dependencies.includes(completedId)) {
        if (status === 'failed') {
          // Mark dependent tasks as blocked if dependency failed
          task.status = 'blocked';
          task.updatedAt = Date.now();
        }
      }
    });
  }
}

// Singleton instance
let taskPoolInstance: TaskPool | null = null;

export function getTaskPool(): TaskPool {
  if (!taskPoolInstance) {
    taskPoolInstance = new TaskPool();
  }
  return taskPoolInstance;
}

export function resetTaskPool(): void {
  taskPoolInstance = new TaskPool();
}
