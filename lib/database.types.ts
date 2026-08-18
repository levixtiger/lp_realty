export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      agents: {
        Row: { id: string; clerk_user_id: string | null; full_name: string; email: string | null; phone: string | null; title: string | null; bio: string | null; photo_url: string | null; license_number: string | null; languages: string[]; active: boolean; created_at: string; updated_at: string };
        Insert: { id?: string; clerk_user_id?: string | null; full_name: string; email?: string | null; phone?: string | null; title?: string | null; bio?: string | null; photo_url?: string | null; license_number?: string | null; languages?: string[]; active?: boolean; created_at?: string; updated_at?: string };
        Update: { id?: string; clerk_user_id?: string | null; full_name?: string; email?: string | null; phone?: string | null; title?: string | null; bio?: string | null; photo_url?: string | null; license_number?: string | null; languages?: string[]; active?: boolean; created_at?: string; updated_at?: string };
        Relationships: [];
      };
      listings: {
        Row: { id: string; slug: string; title: string; address_line_1: string; address_line_2: string | null; city: string; state: string; postal_code: string; property_type: string; asking_price: number; building_area_sqft: number | null; heating: string | null; annual_tax: number | null; common_charge: number | null; description: string | null; open_house: string | null; status: string; assigned_agent_id: string | null; sold_by_agent_id: string | null; sold_at: string | null; image_urls: string[]; source_url: string | null; published: boolean; created_by: string; updated_by: string; created_at: string; updated_at: string; deleted_at: string | null };
        Insert: { id?: string; slug: string; title: string; address_line_1: string; address_line_2?: string | null; city: string; state?: string; postal_code: string; property_type: string; asking_price: number; building_area_sqft?: number | null; heating?: string | null; annual_tax?: number | null; common_charge?: number | null; description?: string | null; open_house?: string | null; status?: string; assigned_agent_id?: string | null; sold_by_agent_id?: string | null; sold_at?: string | null; image_urls?: string[]; source_url?: string | null; published?: boolean; created_by: string; updated_by: string; created_at?: string; updated_at?: string; deleted_at?: string | null };
        Update: Partial<Database["public"]["Tables"]["listings"]["Insert"]>;
        Relationships: [
          { foreignKeyName: "listings_assigned_agent_id_fkey"; columns: ["assigned_agent_id"]; isOneToOne: false; referencedRelation: "agents"; referencedColumns: ["id"] },
          { foreignKeyName: "listings_sold_by_agent_id_fkey"; columns: ["sold_by_agent_id"]; isOneToOne: false; referencedRelation: "agents"; referencedColumns: ["id"] }
        ];
      };
      listing_activity: {
        Row: { id: number; listing_id: string; action: string; from_status: string | null; to_status: string | null; actor_clerk_user_id: string; before_data: Json | null; after_data: Json | null; created_at: string };
        Insert: { listing_id: string; action: string; from_status?: string | null; to_status?: string | null; actor_clerk_user_id: string; before_data?: Json | null; after_data?: Json | null; created_at?: string };
        Update: never;
        Relationships: [];
      };
      leads: {
        Row: { id: string; first_name: string; last_name: string; email: string | null; phone: string | null; source: string | null; status: string; priority: string; assigned_agent_id: string | null; budget_min: number | null; budget_max: number | null; preferred_areas: string[]; property_interest: string | null; notes: string | null; next_follow_up_at: string | null; created_by: string; updated_by: string; created_at: string; updated_at: string; deleted_at: string | null };
        Insert: { id?: string; first_name: string; last_name?: string; email?: string | null; phone?: string | null; source?: string | null; status?: string; priority?: string; assigned_agent_id?: string | null; budget_min?: number | null; budget_max?: number | null; preferred_areas?: string[]; property_interest?: string | null; notes?: string | null; next_follow_up_at?: string | null; created_by: string; updated_by: string; created_at?: string; updated_at?: string; deleted_at?: string | null };
        Update: Partial<Database["public"]["Tables"]["leads"]["Insert"]>;
        Relationships: [{ foreignKeyName: "leads_assigned_agent_id_fkey"; columns: ["assigned_agent_id"]; isOneToOne: false; referencedRelation: "agents"; referencedColumns: ["id"] }];
      };
      lead_interactions: {
        Row: { id: string; lead_id: string; interaction_type: string; direction: string; subject: string | null; notes: string; happened_at: string; actor_clerk_user_id: string; actor_name: string | null; created_at: string };
        Insert: { id?: string; lead_id: string; interaction_type: string; direction?: string; subject?: string | null; notes: string; happened_at?: string; actor_clerk_user_id: string; actor_name?: string | null; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["lead_interactions"]["Insert"]>;
        Relationships: [{ foreignKeyName: "lead_interactions_lead_id_fkey"; columns: ["lead_id"]; isOneToOne: false; referencedRelation: "leads"; referencedColumns: ["id"] }];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
