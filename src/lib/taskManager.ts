import "server-only";

/**
 * Task Manager for long-running JSONL generation tasks
 * Stores task state in Supabase for persistence across instances
 */

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { Database, Json } from "@/types/supabase";

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

type TaskRow = Database["public"]["Tables"]["generation_tasks"]["Row"];

function mapTask(row: TaskRow): GenerationTask {
  return {
    taskId: row.task_id,
    status: row.status,
    progress: row.progress,
    message: row.message,
    result: row.result as GenerationTask["result"] | undefined,
    error: row.error ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Create a new task
 */
export async function createTask(userId: string): Promise<GenerationTask> {
  const { data, error } = await supabaseAdmin
    .from("generation_tasks")
    .insert({
      user_id: userId,
      status: "pending",
      progress: 0,
      message: "Task created",
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Failed to create task");
  }

  return mapTask(data);
}

/**
 * Get task by ID
 */
export async function getTask(
  taskId: string,
  userId: string
): Promise<GenerationTask | null> {
  const { data, error } = await supabaseAdmin
    .from("generation_tasks")
    .select("*")
    .eq("task_id", taskId)
    .eq("user_id", userId)
    .single();

  if (error || !data) {
    return null;
  }

  return mapTask(data);
}

/**
 * Update task status
 */
export async function updateTask(
  taskId: string,
  updates: Partial<Omit<GenerationTask, "taskId" | "createdAt">>
): Promise<GenerationTask | null> {
  const payload: Database["public"]["Tables"]["generation_tasks"]["Update"] = {
    updated_at: new Date().toISOString(),
  };

  if (updates.status) {
    payload.status = updates.status;
  }
  if (typeof updates.progress === "number") {
    payload.progress = updates.progress;
  }
  if (typeof updates.message === "string") {
    payload.message = updates.message;
  }
  if (updates.result !== undefined) {
    payload.result = updates.result as Json;
  }
  if (updates.error !== undefined) {
    payload.error = updates.error ?? null;
  }

  const { data, error } = await supabaseAdmin
    .from("generation_tasks")
    .update(payload)
    .eq("task_id", taskId)
    .select()
    .single();

  if (error || !data) {
    return null;
  }

  return mapTask(data);
}

/**
 * Delete task
 */
export async function deleteTask(taskId: string, userId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("generation_tasks")
    .delete()
    .eq("task_id", taskId)
    .eq("user_id", userId)
    .select("task_id");

  if (error) {
    return false;
  }

  return Array.isArray(data) && data.length > 0;
}

/**
 * Clean up old tasks (older than 1 hour)
 */
export async function cleanupOldTasks(retentionHours = 1): Promise<number> {
  const cutoff = new Date(
    Date.now() - Math.max(retentionHours, 0) * 60 * 60 * 1000
  ).toISOString();
  const { data, error } = await supabaseAdmin
    .from("generation_tasks")
    .delete()
    .lt("updated_at", cutoff)
    .in("status", ["completed", "failed"])
    .select("task_id");

  if (error || !data) {
    return 0;
  }

  return data.length;
}

/**
 * Get all tasks (for debugging)
 */
export async function getAllTasks(): Promise<GenerationTask[]> {
  const { data, error } = await supabaseAdmin
    .from("generation_tasks")
    .select("*")
    .order("created_at", { ascending: false });

  if (error || !data) {
    return [];
  }

  return data.map(mapTask);
}
