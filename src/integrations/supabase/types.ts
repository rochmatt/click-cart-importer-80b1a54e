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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      admin_products: {
        Row: {
          brand: string
          catalog_ref: string | null
          category: string
          created_at: string
          custom_attributes: Json
          description: string
          dimensions: string
          id: string
          images: string[]
          links: Json
          price: number
          rating: number
          reviews: number
          sale_price: number | null
          seo_description: string
          seo_title: string
          size_options: string[]
          status: string
          stock: number
          title: string
          updated_at: string
          variations: Json
          warranty_duration: string
          warranty_status: string
          weight: string
        }
        Insert: {
          brand?: string
          catalog_ref?: string | null
          category?: string
          created_at?: string
          custom_attributes?: Json
          description?: string
          dimensions?: string
          id?: string
          images?: string[]
          links?: Json
          price?: number
          rating?: number
          reviews?: number
          sale_price?: number | null
          seo_description?: string
          seo_title?: string
          size_options?: string[]
          status?: string
          stock?: number
          title?: string
          updated_at?: string
          variations?: Json
          warranty_duration?: string
          warranty_status?: string
          weight?: string
        }
        Update: {
          brand?: string
          catalog_ref?: string | null
          category?: string
          created_at?: string
          custom_attributes?: Json
          description?: string
          dimensions?: string
          id?: string
          images?: string[]
          links?: Json
          price?: number
          rating?: number
          reviews?: number
          sale_price?: number | null
          seo_description?: string
          seo_title?: string
          size_options?: string[]
          status?: string
          stock?: number
          title?: string
          updated_at?: string
          variations?: Json
          warranty_duration?: string
          warranty_status?: string
          weight?: string
        }
        Relationships: []
      }
      cart_items: {
        Row: {
          created_at: string
          id: string
          image: string
          price: string
          product_ref: string
          qty: number
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          image?: string
          price?: string
          product_ref: string
          qty?: number
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          image?: string
          price?: string
          product_ref?: string
          qty?: number
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          image: string
          line_total: number
          order_id: string
          product_ref: string
          quantity: number
          title: string
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          image?: string
          line_total?: number
          order_id: string
          product_ref: string
          quantity?: number
          title: string
          unit_price?: number
        }
        Update: {
          created_at?: string
          id?: string
          image?: string
          line_total?: number
          order_id?: string
          product_ref?: string
          quantity?: number
          title?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          courier: string | null
          created_at: string
          customer_email: string
          destination_city: string | null
          discount: number
          eta_date: string | null
          id: string
          last_update: string | null
          notes: string
          notified_status: string
          notify_level: string
          notify_status_updates: boolean
          notify_updated_at: string | null
          order_number: string
          payment_method: string
          product_name: string
          promo_code: string
          quantity: number
          shipping_address: string
          shipping_fee: number
          shipping_name: string
          shipping_phone: string
          shipping_postal_code: string
          status: string
          subtotal: number
          total: number
          tracking_number: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          courier?: string | null
          created_at?: string
          customer_email?: string
          destination_city?: string | null
          discount?: number
          eta_date?: string | null
          id?: string
          last_update?: string | null
          notes?: string
          notified_status?: string
          notify_level?: string
          notify_status_updates?: boolean
          notify_updated_at?: string | null
          order_number: string
          payment_method?: string
          product_name: string
          promo_code?: string
          quantity?: number
          shipping_address?: string
          shipping_fee?: number
          shipping_name?: string
          shipping_phone?: string
          shipping_postal_code?: string
          status?: string
          subtotal?: number
          total?: number
          tracking_number?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          courier?: string | null
          created_at?: string
          customer_email?: string
          destination_city?: string | null
          discount?: number
          eta_date?: string | null
          id?: string
          last_update?: string | null
          notes?: string
          notified_status?: string
          notify_level?: string
          notify_status_updates?: boolean
          notify_updated_at?: string | null
          order_number?: string
          payment_method?: string
          product_name?: string
          promo_code?: string
          quantity?: number
          shipping_address?: string
          shipping_fee?: number
          shipping_name?: string
          shipping_phone?: string
          shipping_postal_code?: string
          status?: string
          subtotal?: number
          total?: number
          tracking_number?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string
          created_at: string
          display_name: string
          id: string
          phone: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string
          created_at?: string
          display_name?: string
          id: string
          phone?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string
          created_at?: string
          display_name?: string
          id?: string
          phone?: string
          updated_at?: string
        }
        Relationships: []
      }
      sales_events: {
        Row: {
          clicks: number
          created_at: string
          event_date: string
          id: string
          marketplace: string
          orders: number
          product_ref: string
          revenue: number
          views: number
        }
        Insert: {
          clicks?: number
          created_at?: string
          event_date: string
          id?: string
          marketplace: string
          orders?: number
          product_ref: string
          revenue?: number
          views?: number
        }
        Update: {
          clicks?: number
          created_at?: string
          event_date?: string
          id?: string
          marketplace?: string
          orders?: number
          product_ref?: string
          revenue?: number
          views?: number
        }
        Relationships: []
      }
      wishlist_items: {
        Row: {
          created_at: string
          id: string
          image: string
          price: string
          product_ref: string
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          image?: string
          price?: string
          product_ref: string
          title?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          image?: string
          price?: string
          product_ref?: string
          title?: string
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
