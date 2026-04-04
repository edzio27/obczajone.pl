import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Database = {
  public: {
    Tables: {
      listings: {
        Row: {
          id: string;
          listing_id: string;
          source: 'otomoto' | 'otodom';
          url: string;
          title: string;
          location: string;
          current_price: number;
          is_active: boolean;
          first_seen_at: string;
          last_checked_at: string;
          created_by: string;
          created_at: string;
        };
        Insert: {
          listing_id: string;
          source: 'otomoto' | 'otodom';
          url: string;
          title?: string;
          location?: string;
          current_price?: number;
          is_active?: boolean;
          created_by: string;
        };
      };
      listing_snapshots: {
        Row: {
          id: string;
          listing_id: string;
          price: number;
          title: string;
          description: string;
          photo_urls: string[];
          metadata: Record<string, any>;
          scraped_at: string;
        };
        Insert: {
          listing_id: string;
          price: number;
          title: string;
          description: string;
          photo_urls: string[];
          metadata?: Record<string, any>;
        };
      };
      reviews: {
        Row: {
          id: string;
          listing_id: string;
          user_id: string;
          visited_in_person: boolean;
          rating: number;
          price_difference: string;
          condition_difference: string;
          size_mileage_difference: string;
          equipment_difference: string;
          photos_difference: string;
          comment: string;
          is_approved: boolean;
          is_reported: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          listing_id: string;
          user_id: string;
          visited_in_person: boolean;
          rating: number;
          price_difference?: string;
          condition_difference?: string;
          size_mileage_difference?: string;
          equipment_difference?: string;
          photos_difference?: string;
          comment?: string;
        };
      };
      review_photos: {
        Row: {
          id: string;
          review_id: string;
          photo_url: string;
          uploaded_at: string;
        };
        Insert: {
          review_id: string;
          photo_url: string;
        };
      };
      reports: {
        Row: {
          id: string;
          review_id: string;
          reported_by: string;
          reason: string;
          created_at: string;
        };
        Insert: {
          review_id: string;
          reported_by: string;
          reason: string;
        };
      };
    };
  };
};
