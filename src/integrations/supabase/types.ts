export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          client_intro_text: string
          company_name: string
          id: string
          link_expiry_days: number
          logo_data: string | null
          privacy_text: string
          updated_at: string
          whatsapp_message: string
        }
        Insert: {
          client_intro_text?: string
          company_name?: string
          id?: string
          link_expiry_days?: number
          logo_data?: string | null
          privacy_text?: string
          updated_at?: string
          whatsapp_message?: string
        }
        Update: {
          client_intro_text?: string
          company_name?: string
          id?: string
          link_expiry_days?: number
          logo_data?: string | null
          privacy_text?: string
          updated_at?: string
          whatsapp_message?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          details: Json | null
          entity: string | null
          entity_id: string | null
          id: string
          ip_address: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          entity?: string | null
          entity_id?: string | null
          id?: string
          ip_address?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          entity?: string | null
          entity_id?: string | null
          id?: string
          ip_address?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      clients: {
        Row: {
          apelido: string | null
          bairro: string | null
          cep: string | null
          cidade: string | null
          codigo: string
          complemento: string | null
          cpf: string
          created_at: string
          created_by: string | null
          endereco: string | null
          id: string
          name: string
          notes: string | null
          orgao_expedidor: string | null
          pais: string
          phone: string
          photo_path: string | null
          rg: string | null
          signed_at: string | null
          status: Database["public"]["Enums"]["sign_status"]
          tipo_pessoa: string
          uf: string | null
          updated_at: string
        }
        Insert: {
          apelido?: string | null
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          codigo: string
          complemento?: string | null
          cpf: string
          created_at?: string
          created_by?: string | null
          endereco?: string | null
          id?: string
          name: string
          notes?: string | null
          orgao_expedidor?: string | null
          pais?: string
          phone: string
          photo_path?: string | null
          rg?: string | null
          signed_at?: string | null
          status?: Database["public"]["Enums"]["sign_status"]
          tipo_pessoa?: string
          uf?: string | null
          updated_at?: string
        }
        Update: {
          apelido?: string | null
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          codigo?: string
          complemento?: string | null
          cpf?: string
          created_at?: string
          created_by?: string | null
          endereco?: string | null
          id?: string
          name?: string
          notes?: string | null
          orgao_expedidor?: string | null
          pais?: string
          phone?: string
          photo_path?: string | null
          rg?: string | null
          signed_at?: string | null
          status?: Database["public"]["Enums"]["sign_status"]
          tipo_pessoa?: string
          uf?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          id: string
          name: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id: string
          name?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      sign_attempts: {
        Row: {
          created_at: string
          id: string
          ip_address: string
          success: boolean
          token_hash: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          ip_address: string
          success?: boolean
          token_hash?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          ip_address?: string
          success?: boolean
          token_hash?: string | null
        }
        Relationships: []
      }
      signature_documents: {
        Row: {
          content_type: string
          created_at: string
          file_name: string
          file_size: number
          id: string
          signature_id: string
          storage_path: string
        }
        Insert: {
          content_type: string
          created_at?: string
          file_name: string
          file_size: number
          id?: string
          signature_id: string
          storage_path: string
        }
        Update: {
          content_type?: string
          created_at?: string
          file_name?: string
          file_size?: number
          id?: string
          signature_id?: string
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "signature_documents_signature_id_fkey"
            columns: ["signature_id"]
            isOneToOne: false
            referencedRelation: "signatures"
            referencedColumns: ["id"]
          },
        ]
      }
      signatures: {
        Row: {
          client_id: string
          created_at: string
          description: string | null
          expires_at: string | null
          id: string
          ip_address: string | null
          photo_path: string | null
          require_photo: boolean
          signature_path: string | null
          signed_at: string | null
          signer_cpf: string | null
          signer_document: string | null
          signer_name: string | null
          status: Database["public"]["Enums"]["sign_status"]
          title: string
          token: string
          token_hash: string
          user_agent: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          description?: string | null
          expires_at?: string | null
          id?: string
          ip_address?: string | null
          photo_path?: string | null
          require_photo?: boolean
          signature_path?: string | null
          signed_at?: string | null
          signer_cpf?: string | null
          signer_document?: string | null
          signer_name?: string | null
          status?: Database["public"]["Enums"]["sign_status"]
          title?: string
          token: string
          token_hash: string
          user_agent?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          description?: string | null
          expires_at?: string | null
          id?: string
          ip_address?: string | null
          photo_path?: string | null
          require_photo?: boolean
          signature_path?: string | null
          signed_at?: string | null
          signer_cpf?: string | null
          signer_document?: string | null
          signer_name?: string | null
          status?: Database["public"]["Enums"]["sign_status"]
          title?: string
          token?: string
          token_hash?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "signatures_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
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
      app_role: "admin"
      sign_status: "PENDENTE" | "ASSINADO" | "CANCELADO"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin"],
      sign_status: ["PENDENTE", "ASSINADO", "CANCELADO"],
    },
  },
} as const
