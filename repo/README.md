# obczajone.pl

Platforma do sprawdzania historii ogłoszeń z Otomoto i Otodom oraz dzielenia się opiniami o obejrzanych nieruchomościach i samochodach.

## Funkcjonalności

### Dla użytkowników
- Dodawanie ogłoszeń przez wklejenie linku z Otomoto lub Otodom
- Przeglądanie historii zmian cen w ogłoszeniach
- Dodawanie opinii i recenzji po obejrzeniu nieruchomości/pojazdu
- System ocen 1-5 gwiazdek
- Zgłaszanie nieprawidłowych opinii

### Dla administratorów
- Panel moderacji opinii
- Zatwierdzanie i usuwanie recenzji
- Przeglądanie zgłoszeń użytkowników

## Struktura bazy danych

### Tabele
- `listings` - Ogłoszenia z Otomoto/Otodom
- `listing_snapshots` - Historia zmian w ogłoszeniach
- `reviews` - Opinie użytkowników
- `review_photos` - Zdjęcia dodane do opinii
- `reports` - Zgłoszenia nieprawidłowych opinii
- `admin_users` - Lista administratorów
- `rate_limits` - System limitowania działań

## Bezpieczeństwo

### Row Level Security (RLS)
Wszystkie tabele mają włączone RLS z restrykcyjnymi politykami:
- Użytkownicy widzą tylko zatwierdzone opinie
- Tylko autorzy mogą edytować swoje opinie
- Administratorzy mają pełny dostęp do moderacji

### Rate Limiting
- Dodawanie ogłoszeń: max 5 na godzinę
- Dodawanie opinii: max 3 na godzinę
- Zgłaszanie opinii: max 10 na godzinę

## Scraper

Edge Function `scrape-listing` pobiera dane z Otomoto i Otodom:
- Tytuł ogłoszenia
- Cena
- Lokalizacja
- Opis
- Zdjęcia (do 10)
- Metadata

## Struktura projektu

```
/app
  /admin - Panel administratora
  /listing/[id] - Strona szczegółów ogłoszenia
  page.tsx - Strona główna

/components
  /auth - Komponenty autentykacji
  /ui - Komponenty UI (shadcn/ui)
  header.tsx - Główny header
  listing-url-form.tsx - Formularz dodawania ogłoszeń
  review-form.tsx - Formularz dodawania opinii
  review-list.tsx - Lista opinii
  price-history.tsx - Historia cen
  recent-listings.tsx - Ostatnio dodane ogłoszenia

/lib
  supabase.ts - Klient Supabase
  auth-context.tsx - Context autentykacji
  rate-limit.ts - System rate limitingu

/supabase/functions
  /scrape-listing - Edge Function do scrapowania
```

## Instrukcje użycia

### Pierwsze uruchomienie
1. Aplikacja korzysta z Supabase - baza danych jest już skonfigurowana
2. Migracje zostały automatycznie zastosowane
3. Edge Function jest wdrożona

### Dodanie pierwszego administratora
Wykonaj w konsoli Supabase:
```sql
INSERT INTO admin_users (user_id, role)
VALUES ('YOUR_USER_ID', 'admin');
```

### Testowanie aplikacji
1. Zarejestruj nowe konto
2. Wklej link do ogłoszenia z Otomoto lub Otodom
3. Sprawdź historię i dodaj opinię
4. Jeśli jesteś adminem, przejdź do /admin

## Wsparcie dla portali

### Otomoto
Przykładowy URL:
```
https://www.otomoto.pl/oferta/audi-a4-ID12345
```

### Otodom
Przykładowy URL:
```
https://www.otodom.pl/pl/oferta/mieszkanie-2-pokoje-ID67890
```

## Moderacja

Wszystkie opinie wymagają zatwierdzenia przez moderatora przed publikacją. Panel moderacji dostępny pod adresem `/admin` dla użytkowników z rolą w tabeli `admin_users`.

## Roadmap

- [ ] Dodanie powiadomień email o nowych opiniach
- [ ] System reputacji użytkowników
- [ ] Możliwość dodawania zdjęć do opinii
- [ ] API publiczne dla deweloperów
- [ ] Integracja z dodatkowymi portalami (OLX, Allegro)
- [ ] Automatyczne codzienne sprawdzanie zmian w ogłoszeniach
