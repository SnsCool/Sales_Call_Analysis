// Supabaseデータベース型定義

export type UserRole = "admin" | "sales"
export type RecordingStatus =
  | "pending"
  | "downloading"
  | "ready"
  | "transcribing"
  | "transcribed"
  | "analyzing"
  | "completed"
  | "failed"
export type FeedbackStatus = "draft" | "shared"

export interface Profile {
  id: string
  email: string
  full_name: string | null
  role: UserRole
  avatar_url: string | null
  created_at: string
  updated_at: string
}

export interface ZoomAccount {
  id: string
  owner_id: string
  display_name: string
  zoom_user_email: string
  zoom_account_id: string | null
  is_active: boolean
  last_synced_at: string | null
  created_at: string
}

export interface ZoomAccountToken {
  id: string
  zoom_account_id: string
  access_token: string
  refresh_token: string | null
  expires_at: string
  created_at: string
}

export interface Recording {
  id: string
  zoom_account_id: string
  zoom_recording_id: string
  topic: string | null
  start_time: string
  duration: number | null
  video_url: string | null
  file_path: string | null
  status: RecordingStatus
  deleted_at: string | null
  created_at: string
}

export interface KnowledgeRule {
  id: string
  title: string
  category: string | null
  content: string
  prompt_instructions: string | null
  is_active: boolean
  created_at: string
}

export interface TranscriptSegment {
  start: number
  end: number
  text: string
  speaker?: string
}

export interface AnalysisIssue {
  start: number
  end: number
  rule_id: string
  severity: "info" | "warning" | "error"
  reason: string
}

export interface Analysis {
  id: string
  recording_id: string
  transcript_json: TranscriptSegment[] | null
  issues_json: AnalysisIssue[] | null
  summary_text: string | null
  created_at: string
}

export interface Feedback {
  id: string
  recording_id: string
  created_by: string
  target_user_id: string
  clip_url: string | null
  clip_start_ms: number | null
  clip_end_ms: number | null
  content: string
  status: FeedbackStatus
  shared_at: string | null
  created_at: string
}

export interface WebhookEvent {
  id: string
  event_type: string
  payload: Record<string, unknown>
  processed_at: string | null
  created_at: string
}

// Supabase Database型（完全形式）
export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile
        Insert: Partial<Profile> & { id: string; email: string }
        Update: Partial<Profile>
        Relationships: []
      }
      zoom_accounts: {
        Row: ZoomAccount
        Insert: Partial<ZoomAccount> & { owner_id: string; display_name: string; zoom_user_email: string }
        Update: Partial<ZoomAccount>
        Relationships: [
          {
            foreignKeyName: "zoom_accounts_owner_id_fkey"
            columns: ["owner_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      zoom_account_tokens: {
        Row: ZoomAccountToken
        Insert: Partial<ZoomAccountToken> & { zoom_account_id: string; access_token: string; expires_at: string }
        Update: Partial<ZoomAccountToken>
        Relationships: [
          {
            foreignKeyName: "zoom_account_tokens_zoom_account_id_fkey"
            columns: ["zoom_account_id"]
            referencedRelation: "zoom_accounts"
            referencedColumns: ["id"]
          }
        ]
      }
      recordings: {
        Row: Recording
        Insert: Partial<Recording> & { zoom_account_id: string; zoom_recording_id: string; start_time: string }
        Update: Partial<Recording>
        Relationships: [
          {
            foreignKeyName: "recordings_zoom_account_id_fkey"
            columns: ["zoom_account_id"]
            referencedRelation: "zoom_accounts"
            referencedColumns: ["id"]
          }
        ]
      }
      knowledge_rules: {
        Row: KnowledgeRule
        Insert: Partial<KnowledgeRule> & { title: string; content: string }
        Update: Partial<KnowledgeRule>
        Relationships: []
      }
      analyses: {
        Row: Analysis
        Insert: Partial<Analysis> & { recording_id: string }
        Update: Partial<Analysis>
        Relationships: [
          {
            foreignKeyName: "analyses_recording_id_fkey"
            columns: ["recording_id"]
            referencedRelation: "recordings"
            referencedColumns: ["id"]
          }
        ]
      }
      feedbacks: {
        Row: Feedback
        Insert: Partial<Feedback> & { recording_id: string; created_by: string; target_user_id: string; content: string }
        Update: Partial<Feedback>
        Relationships: [
          {
            foreignKeyName: "feedbacks_recording_id_fkey"
            columns: ["recording_id"]
            referencedRelation: "recordings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedbacks_created_by_fkey"
            columns: ["created_by"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedbacks_target_user_id_fkey"
            columns: ["target_user_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      webhook_events: {
        Row: WebhookEvent
        Insert: Partial<WebhookEvent> & { event_type: string; payload: Record<string, unknown> }
        Update: Partial<WebhookEvent>
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      user_role: UserRole
      recording_status: RecordingStatus
      feedback_status: FeedbackStatus
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// ヘルパー型
export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"]
export type InsertTables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"]
export type UpdateTables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"]
