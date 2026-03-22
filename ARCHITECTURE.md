# Architektura aplikacji obczajone.pl

## Stack technologiczny

### Frontend
- **Next.js 13** - React framework z App Router
- **TypeScript** - Typowanie
- **Tailwind CSS** - Stylowanie
- **shadcn/ui** - Komponenty UI
- **date-fns** - Formatowanie dat

### Backend
- **Supabase** - Backend-as-a-Service
  - PostgreSQL - Baza danych
  - Row Level Security - Bezpieczeństwo
  - Edge Functions - Serverless functions
  - Auth - Autentykacja email/hasło

## Schemat bazy danych

### listings
Główna tabela z ogłoszeniami.

| Kolumna | Typ | Opis |
|---------|-----|------|
| id | uuid | Klucz główny |
| listing_id | text | ID z Otomoto/Otodom (unikalny) |
| source | text | 'otomoto' lub 'otodom' |
| url | text | Pełny URL ogłoszenia |
| title | text | Tytuł |
| location | text | Lokalizacja |
| current_price | numeric | Aktualna cena |
| is_active | boolean | Czy ogłoszenie jest aktywne |
| first_seen_at | timestamptz | Kiedy dodano |
| last_checked_at | timestamptz | Ostatnie sprawdzenie |
| created_by | uuid | FK do auth.users |
| created_at | timestamptz | Data utworzenia |

### listing_snapshots
Historia wszystkich zmian w ogłoszeniach.

| Kolumna | Typ | Opis |
|---------|-----|------|
| id | uuid | Klucz główny |
| listing_id | uuid | FK do listings |
| price | numeric | Cena w momencie snapshota |
| title | text | Tytuł w momencie snapshota |
| description | text | Opis (max 5000 znaków) |
| photo_urls | jsonb | Tablica URL-i zdjęć |
| metadata | jsonb | Dodatkowe dane (przebieg, rok, itp.) |
| scraped_at | timestamptz | Kiedy pobrano |

### reviews
Opinie użytkowników o ogłoszeniach.

| Kolumna | Typ | Opis |
|---------|-----|------|
| id | uuid | Klucz główny |
| listing_id | uuid | FK do listings |
| user_id | uuid | FK do auth.users |
| visited_in_person | boolean | Czy był na miejscu |
| rating | integer | Ocena 1-5 |
| price_difference | text | Różnica w cenie |
| condition_difference | text | Różnica w stanie |
| size_mileage_difference | text | Różnica w wielkości/przebiegu |
| equipment_difference | text | Różnica w wyposażeniu |
| photos_difference | text | Różnica w zdjęciach |
| comment | text | Główny komentarz |
| is_approved | boolean | Czy zatwierdzona przez admina |
| is_reported | boolean | Czy zgłoszona |
| created_at | timestamptz | Data utworzenia |
| updated_at | timestamptz | Data aktualizacji |

### review_photos
Zdjęcia dodane do opinii.

| Kolumna | Typ | Opis |
|---------|-----|------|
| id | uuid | Klucz główny |
| review_id | uuid | FK do reviews |
| photo_url | text | URL zdjęcia |
| uploaded_at | timestamptz | Kiedy wgrano |

### reports
Zgłoszenia nieprawidłowych opinii.

| Kolumna | Typ | Opis |
|---------|-----|------|
| id | uuid | Klucz główny |
| review_id | uuid | FK do reviews |
| reported_by | uuid | FK do auth.users |
| reason | text | Powód zgłoszenia |
| created_at | timestamptz | Data zgłoszenia |

### admin_users
Lista administratorów i moderatorów.

| Kolumna | Typ | Opis |
|---------|-----|------|
| user_id | uuid | FK do auth.users (PK) |
| role | text | 'admin' lub 'moderator' |
| created_at | timestamptz | Kiedy dodano |

### rate_limits
System rate limitingu.

| Kolumna | Typ | Opis |
|---------|-----|------|
| id | uuid | Klucz główny |
| user_id | uuid | FK do auth.users |
| action_type | text | Typ akcji |
| created_at | timestamptz | Kiedy wykonano |

## Polityki RLS

### listings
- SELECT: Wszyscy uwierzytelnieni użytkownicy
- INSERT: Tylko utworzone przez siebie

### listing_snapshots
- SELECT: Wszyscy uwierzytelnieni użytkownicy
- INSERT: Wszyscy (dla systemu scrapowania)

### reviews
- SELECT: Tylko zatwierdzone (is_approved=true) lub własne
- INSERT: Tylko uwierzytelnieni
- UPDATE: Tylko własne lub admini
- DELETE: Tylko admini

### review_photos
- SELECT: Jak review
- INSERT: Tylko do własnych review

### reports
- INSERT: Tylko uwierzytelnieni
- SELECT/DELETE: Tylko admini

### admin_users
- SELECT: Tylko admini

## Edge Functions

### scrape-listing

**Endpoint:** `/functions/v1/scrape-listing`

**Metoda:** POST

**Body:**
```json
{
  "listingId": "uuid-ogłoszenia"
}
```

**Funkcjonalność:**
1. Pobiera dane ogłoszenia z tabeli listings
2. W zależności od source (otomoto/otodom) wywołuje odpowiedni scraper
3. Parsuje HTML strony ogłoszenia
4. Zapisuje dane w tabeli listing_snapshots
5. Aktualizuje rekord w listings

**Zwraca:**
```json
{
  "success": true,
  "data": {
    "title": "...",
    "price": 50000,
    "location": "Warszawa",
    "description": "...",
    "photoUrls": ["url1", "url2"],
    "metadata": {}
  }
}
```

## Rate Limiting

Limity są sprawdzane przed wykonaniem akcji:

| Akcja | Limit | Okno czasowe |
|-------|-------|--------------|
| add_listing | 5 | 60 minut |
| add_review | 3 | 60 minut |
| report_review | 10 | 60 minut |

Implementacja:
- Przed akcją: `checkRateLimit(userId, actionType, maxActions, timeWindow)`
- Po akcji: `recordAction(userId, actionType)`

## Przepływ użytkownika

### Dodawanie ogłoszenia
1. Użytkownik wkleja URL w formularzu
2. System wyciąga listing_id z URL
3. Sprawdza czy ogłoszenie już istnieje
4. Jeśli nie - tworzy nowy rekord w `listings`
5. Wywołuje Edge Function `scrape-listing`
6. Edge Function pobiera dane i tworzy pierwszy snapshot
7. Użytkownik przekierowywany do strony ogłoszenia

### Dodawanie opinii
1. Użytkownik wypełnia formularz opinii
2. System sprawdza rate limit
3. Tworzy rekord w `reviews` z `is_approved=false`
4. Opinia czeka na zatwierdzenie przez admina
5. Po zatwierdzeniu pojawia się publicznie

### Moderacja
1. Admin loguje się i przechodzi do /admin
2. Widzi listę niezatwierdzonych opinii
3. Może zatwierdzić lub usunąć opinię
4. Może przeglądać zgłoszenia i je rozpatrywać

## Funkcje pomocnicze

### is_admin()
Sprawdza czy zalogowany użytkownik jest adminem.

```sql
SELECT is_admin(); -- true/false
```

Używana w politykach RLS do ograniczenia dostępu.

### check_rate_limit()
Sprawdza czy użytkownik nie przekroczył limitu.

```sql
SELECT check_rate_limit(
  'user-id',
  'add_listing',
  5,  -- max działań
  60  -- w ciągu minut
);
```

### cleanup_old_rate_limits()
Czyści stare wpisy (starsze niż 24h).

```sql
SELECT cleanup_old_rate_limits();
```

Można ustawić jako cron job w Supabase.

## Deployment

### Wymagania
- Konto Supabase
- Node.js 18+
- npm lub yarn

### Kroki
1. Sklonuj repozytorium
2. Skopiuj zmienne środowiskowe z Supabase do `.env.local`
3. `npm install`
4. Migracje zostały już zastosowane
5. Edge Function została wdrożona
6. Dodaj pierwszego admina SQL-em
7. Gotowe!

## Następne kroki

1. Dodać cron job do codziennego sprawdzania ogłoszeń
2. Dodać powiadomienia email
3. Dodać więcej metadanych (rok produkcji, przebieg, itp.)
4. Poprawić scraping - obecnie używa prostego regex
5. Dodać cache dla często sprawdzanych ogłoszeń
