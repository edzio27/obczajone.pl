import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/*
  Termin na żądanie z przeglądarki.

  supabase-js nie ma własnego timeoutu, a `fetch` czeka bez końca. Gdy API
  przyjmuje połączenie i milczy - a tak wygląda tutejsza awaria - zapytanie
  nie kończy się ani sukcesem, ani błędem. `RecentListings` ma stan błędu
  i komunikat dla czytelnika, ale nigdy się nie włączał: nie było błędu, było
  czekanie. Odwiedzający widział wirujący spinner bez końca, przez trzy dni
  awarii z 28 września.

  Dwanaście sekund: więcej niż potrzeba zdrowemu API (dziesiątki milisekund)
  i mniej, niż człowiek jest gotów patrzeć na kręcące się kółko. Po tym czasie
  leci błąd, a komponent pokazuje to, co ma przygotowane.

  Ta sama decyzja co w lib/supabase-server.ts, tyle że dla przeglądarki.
*/
function fetchZLimitem(wejscie: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  if (init?.signal) return fetch(wejscie, init);
  return fetch(wejscie, { ...init, signal: AbortSignal.timeout(12_000) });
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { fetch: fetchZLimitem },
});

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
