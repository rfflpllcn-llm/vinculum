/**
 * Task Manager for long-running JSONL generation tasks
 * Stores task state in memory (can be moved to Redis/database later)
 */

import { v4 as uuidv4 } from "uuid";

export type TaskStatus = "pending" | "running" | "completed" | "failed";

export interface GenerationTask {
  taskId: string;
  status: TaskStatus;
  progress: number; // 0-100
  message: string;
  result?: {
    chunks: {
      path: string;
      count: number;
    };
    alignments: Record<
      string,
      {
        path: string;
        count: number;
      }
    >;
  };
  error?: string;
  createdAt: string;
  updatedAt: string;
}

// In-memory task storage (replace with Redis/database in production).
// Use globalThis to survive Next.js dev module reloads.
const globalForTasks = globalThis as typeof globalThis & {
  __generationTasks?: Map<string, GenerationTask>;
};
const tasks = globalForTasks.__generationTasks ?? new Map<string, GenerationTask>();
globalForTasks.__generationTasks = tasks;

/**
 * Create a new task
 */
export function createTask(): GenerationTask {
  const taskId = uuidv4();
  const task: GenerationTask = {
    taskId,
    status: "pending",
    progress: 0,
    message: "Task created",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  tasks.set(taskId, task);
  return task;
}

/**
 * Get task by ID
 */
export function getTask(taskId: string): GenerationTask | null {
  return tasks.get(taskId) || null;
}

/**
 * Update task status
 */
export function updateTask(
  taskId: string,
  updates: Partial<Omit<GenerationTask, "taskId" | "createdAt">>
): GenerationTask | null {
  const task = tasks.get(taskId);
  if (!task) {
    return null;
  }

  const updatedTask: GenerationTask = {
    ...task,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  tasks.set(taskId, updatedTask);
  return updatedTask;
}

/**
 * Delete task
 */
export function deleteTask(taskId: string): boolean {
  return tasks.delete(taskId);
}

/**
 * Clean up old tasks (older than 1 hour)
 */
export function cleanupOldTasks(): number {
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  let deleted = 0;

  for (const [taskId, task] of tasks.entries()) {
    const updatedAt = new Date(task.updatedAt).getTime();
    if (updatedAt < oneHourAgo && (task.status === "completed" || task.status === "failed")) {
      tasks.delete(taskId);
      deleted++;
    }
  }

  return deleted;
}

/**
 * Get all tasks (for debugging)
 */
export function getAllTasks(): GenerationTask[] {
  return Array.from(tasks.values());
}
