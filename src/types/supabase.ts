/**
 * Supabase Database Types
 * Generated types for type-safe database access
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      documents: {
        Row: {
          document_id: string
          drive_file_id: string
          filename: string
          mime_type: string
          page_count: number
          created_at: string
          updated_at: string
        }
        Insert: {
          document_id?: string
          drive_file_id: string
          filename: string
          mime_type: string
          page_count?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          document_id?: string
          drive_file_id?: string
          filename?: string
          mime_type?: string
          page_count?: number
          created_at?: string
          updated_at?: string
        }
      }
      audit_sessions: {
        Row: {
          audit_id: string
          user_id: string
          user_email: string | null
          alignment_id: string | null
          task_name: string | null
          prompt_text: string
          gpt_response: string
          gpt_model: string | null
          task_type: 'audit' | 'explain' | 'compare'
          source_text: string
          target_text: string
          original_text: string | null
          source_language: string | null
          target_language: string | null
          original_language: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          audit_id?: string
          user_id: string
          user_email?: string | null
          alignment_id?: string | null
          task_name?: string | null
          prompt_text: string
          gpt_response: string
          gpt_model?: string | null
          task_type: 'audit' | 'explain' | 'compare'
          source_text: string
          target_text: string
          original_text?: string | null
          source_language?: string | null
          target_language?: string | null
          original_language?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          audit_id?: string
          user_id?: string
          user_email?: string | null
          alignment_id?: string | null
          task_name?: string | null
          prompt_text?: string
          gpt_response?: string
          gpt_model?: string | null
          task_type?: 'audit' | 'explain' | 'compare'
          source_text?: string
          target_text?: string
          original_text?: string | null
          source_language?: string | null
          target_language?: string | null
          original_language?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      generation_tasks: {
        Row: {
          task_id: string
          user_id: string
          status: 'pending' | 'running' | 'completed' | 'failed'
          progress: number
          message: string
          result: Json | null
          error: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          task_id?: string
          user_id: string
          status: 'pending' | 'running' | 'completed' | 'failed'
          progress?: number
          message?: string
          result?: Json | null
          error?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          task_id?: string
          user_id?: string
          status?: 'pending' | 'running' | 'completed' | 'failed'
          progress?: number
          message?: string
          result?: Json | null
          error?: string | null
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
}
