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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      versiones_app: {
        Row: {
          activa: boolean
          compilacion_minima: number
          created_at: string
          id: string
          mensaje: string
          novedades: string[]
          numero_compilacion: number
          obligatoria: boolean
          plataforma: string
          publicada_at: string
          titulo: string
          updated_at: string
          url_descarga: string
          version: string
        }
        Insert: {
          activa?: boolean
          compilacion_minima?: number
          created_at?: string
          id?: string
          mensaje?: string
          novedades?: string[]
          numero_compilacion: number
          obligatoria?: boolean
          plataforma: string
          publicada_at?: string
          titulo?: string
          updated_at?: string
          url_descarga: string
          version: string
        }
        Update: {
          activa?: boolean
          compilacion_minima?: number
          created_at?: string
          id?: string
          mensaje?: string
          novedades?: string[]
          numero_compilacion?: number
          obligatoria?: boolean
          plataforma?: string
          publicada_at?: string
          titulo?: string
          updated_at?: string
          url_descarga?: string
          version?: string
        }
        Relationships: []
      }
      usuarios: {
        Row: {
          celular: string | null
          created_at: string
          id: string
          nombre: string
          updated_at: string
        }
        Insert: {
          celular?: string | null
          created_at?: string
          id: string
          nombre: string
          updated_at?: string
        }
        Update: {
          celular?: string | null
          created_at?: string
          id?: string
          nombre?: string
          updated_at?: string
        }
        Relationships: []
      }
      clientes: {
        Row: {
          apellidos: string | null
          celular: string | null
          created_at: string
          estado: string
          id: string
          metodo_pago_preferido: string | null
          nombres: string
          numero_yape_plin: string | null
          observaciones: string | null
          propietario_id: string
          updated_at: string
        }
        Insert: {
          apellidos?: string | null
          celular?: string | null
          created_at?: string
          estado?: string
          id?: string
          metodo_pago_preferido?: string | null
          nombres: string
          numero_yape_plin?: string | null
          observaciones?: string | null
          propietario_id?: string
          updated_at?: string
        }
        Update: {
          apellidos?: string | null
          celular?: string | null
          created_at?: string
          estado?: string
          id?: string
          metodo_pago_preferido?: string | null
          nombres?: string
          numero_yape_plin?: string | null
          observaciones?: string | null
          propietario_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      cuotas_prestamo: {
        Row: {
          created_at: string
          id: string
          monto_programado: number
          numero: number
          prestamo_id: string
          propietario_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          monto_programado: number
          numero: number
          prestamo_id: string
          propietario_id: string
        }
        Update: {
          created_at?: string
          id?: string
          monto_programado?: number
          numero?: number
          prestamo_id?: string
          propietario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cuotas_prestamo_prestamo_id_fkey"
            columns: ["prestamo_id"]
            isOneToOne: false
            referencedRelation: "prestamos"
            referencedColumns: ["id"]
          },
        ]
      }
      eventos_prestamo: {
        Row: {
          created_at: string
          id: string
          monto_caja_revertido: number
          motivo: string
          ocurrido_at: string
          prestamo_id: string
          propietario_id: string
          saldo_afectado: number
          solicitud_id: string
          tipo: string
        }
        Insert: {
          created_at?: string
          id?: string
          monto_caja_revertido?: number
          motivo: string
          ocurrido_at?: string
          prestamo_id: string
          propietario_id: string
          saldo_afectado: number
          solicitud_id: string
          tipo: string
        }
        Update: {
          created_at?: string
          id?: string
          monto_caja_revertido?: number
          motivo?: string
          ocurrido_at?: string
          prestamo_id?: string
          propietario_id?: string
          saldo_afectado?: number
          solicitud_id?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "eventos_prestamo_prestamo_id_fkey"
            columns: ["prestamo_id"]
            isOneToOne: true
            referencedRelation: "prestamos"
            referencedColumns: ["id"]
          },
        ]
      }
      movimientos_caja: {
        Row: {
          created_at: string
          direccion: number
          efecto: number | null
          evento_prestamo_id: string | null
          id: string
          medio: string
          monto: number
          movimiento_revertido_id: string | null
          nota: string | null
          ocurrido_at: string
          prestamo_id: string | null
          propietario_id: string
          solicitud_id: string
          tipo: string
        }
        Insert: {
          created_at?: string
          direccion: number
          efecto?: number | null
          evento_prestamo_id?: string | null
          id?: string
          medio: string
          monto: number
          movimiento_revertido_id?: string | null
          nota?: string | null
          ocurrido_at?: string
          prestamo_id?: string | null
          propietario_id?: string
          solicitud_id: string
          tipo: string
        }
        Update: {
          created_at?: string
          direccion?: number
          efecto?: number | null
          evento_prestamo_id?: string | null
          id?: string
          medio?: string
          monto?: number
          movimiento_revertido_id?: string | null
          nota?: string | null
          ocurrido_at?: string
          prestamo_id?: string | null
          propietario_id?: string
          solicitud_id?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "movimientos_caja_evento_prestamo_id_fkey"
            columns: ["evento_prestamo_id"]
            isOneToOne: true
            referencedRelation: "eventos_prestamo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimientos_caja_movimiento_revertido_id_fkey"
            columns: ["movimiento_revertido_id"]
            isOneToOne: true
            referencedRelation: "movimientos_caja"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimientos_caja_prestamo_id_fkey"
            columns: ["prestamo_id"]
            isOneToOne: false
            referencedRelation: "prestamos"
            referencedColumns: ["id"]
          },
        ]
      }
      prestamos: {
        Row: {
          cliente_id: string
          created_at: string
          estado: string
          fecha_prestamo: string
          id: string
          medio_desembolso: string
          monto_base: number
          monto_desembolsado: number
          monto_interes: number
          nota: string | null
          numero_cuotas: number
          porcentaje_interes: number
          prestamo_origen_id: string | null
          propietario_id: string
          saldo_compensado: number
          solicitud_id: string
          tipo: string
          total_a_cobrar: number
          updated_at: string
        }
        Insert: {
          cliente_id: string
          created_at?: string
          estado?: string
          fecha_prestamo?: string
          id?: string
          medio_desembolso: string
          monto_base: number
          monto_desembolsado: number
          monto_interes: number
          nota?: string | null
          numero_cuotas: number
          porcentaje_interes: number
          prestamo_origen_id?: string | null
          propietario_id: string
          saldo_compensado?: number
          solicitud_id: string
          tipo?: string
          total_a_cobrar: number
          updated_at?: string
        }
        Update: {
          cliente_id?: string
          created_at?: string
          estado?: string
          fecha_prestamo?: string
          id?: string
          medio_desembolso?: string
          monto_base?: number
          monto_desembolsado?: number
          monto_interes?: number
          nota?: string | null
          numero_cuotas?: number
          porcentaje_interes?: number
          prestamo_origen_id?: string | null
          propietario_id?: string
          saldo_compensado?: number
          solicitud_id?: string
          tipo?: string
          total_a_cobrar?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prestamos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prestamos_prestamo_origen_id_fkey"
            columns: ["prestamo_origen_id"]
            isOneToOne: false
            referencedRelation: "prestamos"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cerrar_prestamo: {
        Args: {
          p_motivo: string
          p_prestamo_id: string
          p_solicitud_id: string
          p_tipo: string
        }
        Returns: string
      }
      crear_prestamo: {
        Args: {
          p_cliente_id: string
          p_medio_desembolso: string
          p_monto_base: number
          p_nota: string
          p_numero_cuotas: number
          p_porcentaje_interes: number
          p_solicitud_id: string
        }
        Returns: string
      }
      obtener_caja: { Args: never; Returns: Json }
      obtener_cierre_prestamo: { Args: { p_prestamo_id: string }; Returns: Json }
      obtener_actividad: { Args: { p_limite?: number }; Returns: Json }
      obtener_prestamos: { Args: { p_cliente_id?: string }; Returns: Json }
      registrar_pago: {
        Args: {
          p_medio: string
          p_monto: number
          p_nota: string
          p_pago_total: boolean
          p_prestamo_id: string
          p_solicitud_id: string
          p_trasladar_restante: boolean
        }
        Returns: string
      }
      renovar_prestamo: {
        Args: {
          p_medio_desembolso: string
          p_nota: string
          p_nuevo_monto_base: number
          p_numero_cuotas: number
          p_porcentaje_interes: number
          p_prestamo_anterior_id: string
          p_solicitud_id: string
        }
        Returns: string
      }
      registrar_movimiento_caja: {
        Args: {
          p_medio: string
          p_monto: number
          p_nota: string
          p_solicitud_id: string
          p_tipo: string
        }
        Returns: {
          created_at: string
          direccion: number
          efecto: number | null
          id: string
          medio: string
          monto: number
          movimiento_revertido_id: string | null
          nota: string | null
          ocurrido_at: string
          prestamo_id: string | null
          propietario_id: string
          solicitud_id: string
          tipo: string
        }
        SetofOptions: {
          from: "*"
          to: "movimientos_caja"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      revertir_movimiento_caja: {
        Args: {
          p_motivo: string
          p_movimiento_id: string
          p_solicitud_id: string
        }
        Returns: {
          created_at: string
          direccion: number
          efecto: number | null
          id: string
          medio: string
          monto: number
          movimiento_revertido_id: string | null
          nota: string | null
          ocurrido_at: string
          prestamo_id: string | null
          propietario_id: string
          solicitud_id: string
          tipo: string
        }
        SetofOptions: {
          from: "*"
          to: "movimientos_caja"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      revertir_pago: {
        Args: {
          p_motivo: string
          p_pago_id: string
          p_solicitud_id: string
        }
        Returns: string
      }
    }
    Enums: {
      [_ in never]: never
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
