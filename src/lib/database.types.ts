// Hand-maintained to match supabase/migrations. If you change the schema,
// update this file (or regenerate it with `supabase gen types typescript`).

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type MemoryType =
  | "idea"
  | "note"
  | "fact"
  | "decision"
  | "research"
  | "reflection"
  | "meeting"
  | "reference";

export type ProjectStatus = "active" | "paused" | "completed" | "archived";
export type IndexStatus = "pending" | "indexed" | "failed";
export type RelationType = "related" | "supports" | "contradicts" | "follows" | "inspired_by";
export type RelationStatus = "accepted" | "suggested" | "rejected";
export type RelationOrigin = "user" | "ai";
export type MessageRole = "user" | "assistant";

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name?: string | null;
        };
        Update: {
          display_name?: string | null;
        };
        Relationships: [];
      };
      projects: {
        Row: {
          id: string;
          owner_id: string;
          name: string;
          description: string;
          status: ProjectStatus;
          goals: string;
          next_steps: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          name: string;
          description?: string;
          status?: ProjectStatus;
          goals?: string;
          next_steps?: string;
        };
        Update: {
          name?: string;
          description?: string;
          status?: ProjectStatus;
          goals?: string;
          next_steps?: string;
        };
        Relationships: [];
      };
      memories: {
        Row: {
          id: string;
          owner_id: string;
          project_id: string | null;
          title: string;
          content: string;
          type: MemoryType;
          tags: string[];
          source_url: string | null;
          source_notes: string;
          visibility: "private";
          content_hash: string;
          index_status: IndexStatus;
          index_error: string | null;
          indexed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          project_id?: string | null;
          title: string;
          content?: string;
          type?: MemoryType;
          tags?: string[];
          source_url?: string | null;
          source_notes?: string;
          content_hash: string;
        };
        Update: {
          project_id?: string | null;
          title?: string;
          content?: string;
          type?: MemoryType;
          tags?: string[];
          source_url?: string | null;
          source_notes?: string;
          content_hash?: string;
          index_status?: IndexStatus;
          index_error?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "memories_project_id_owner_id_fkey";
            columns: ["project_id", "owner_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id", "owner_id"];
          },
        ];
      };
      memory_chunks: {
        Row: {
          id: number;
          memory_id: string;
          owner_id: string;
          chunk_index: number;
          content: string;
          embedding: string;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      memory_relationships: {
        Row: {
          id: string;
          owner_id: string;
          source_memory_id: string;
          target_memory_id: string;
          relation_type: RelationType;
          status: RelationStatus;
          origin: RelationOrigin;
          reason: string;
          score: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          source_memory_id: string;
          target_memory_id: string;
          relation_type?: RelationType;
          status?: RelationStatus;
          origin?: RelationOrigin;
          reason?: string;
          score?: number | null;
        };
        Update: {
          relation_type?: RelationType;
          status?: RelationStatus;
        };
        Relationships: [];
      };
      conversations: {
        Row: {
          id: string;
          owner_id: string;
          project_id: string | null;
          title: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          project_id?: string | null;
          title?: string;
        };
        Update: {
          title?: string;
          project_id?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      conversation_messages: {
        Row: {
          id: string;
          conversation_id: string;
          owner_id: string;
          role: MessageRole;
          content: string;
          citations: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          owner_id: string;
          role: MessageRole;
          content: string;
          citations?: Json;
        };
        Update: never;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      match_memory_chunks: {
        Args: {
          query_embedding: string;
          match_count?: number;
          filter_project_id?: string | null;
          min_similarity?: number;
        };
        Returns: {
          chunk_id: number;
          memory_id: string;
          chunk_index: number;
          content: string;
          similarity: number;
          title: string;
          type: MemoryType;
          tags: string[];
          project_id: string | null;
          memory_created_at: string;
          memory_updated_at: string;
        }[];
      };
      keyword_search_memories: {
        Args: {
          query_text: string;
          match_count?: number;
          filter_project_id?: string | null;
        };
        Returns: {
          memory_id: string;
          title: string;
          content: string;
          type: MemoryType;
          tags: string[];
          project_id: string | null;
          rank: number;
          memory_created_at: string;
          memory_updated_at: string;
        }[];
      };
      similar_memories: {
        Args: { p_memory_id: string; match_count?: number; min_similarity?: number };
        Returns: { memory_id: string; title: string; type: MemoryType; similarity: number }[];
      };
      replace_memory_chunks: {
        Args: { p_memory_id: string; p_content_hash: string; p_chunks: Json };
        Returns: boolean;
      };
      delete_own_account: {
        Args: Record<string, never>;
        Returns: undefined;
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];
export type Memory = Tables<"memories">;
export type Project = Tables<"projects">;
export type MemoryRelationship = Tables<"memory_relationships">;
export type Conversation = Tables<"conversations">;
export type ConversationMessage = Tables<"conversation_messages">;
