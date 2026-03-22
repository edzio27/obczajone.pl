# Instrukcja wdrożenia obczajone.pl

## Deployment aplikacji

### Opcja 1: Vercel (Zalecane)

Vercel jest najlepszą opcją dla aplikacji Next.js - oferuje darmowy plan i automatyczny deployment.

#### Kroki:

1. **Utwórz konto na Vercel**
   - Wejdź na https://vercel.com
   - Zarejestruj się (najlepiej przez GitHub)

2. **Podłącz repozytorium**
   - Kliknij "New Project"
   - Zaimportuj repozytorium z kodem
   - Vercel automatycznie wykryje Next.js

3. **Dodaj zmienne środowiskowe**
   W ustawieniach projektu dodaj:
   ```
   NEXT_PUBLIC_SUPABASE_URL=twój_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=twój_supabase_anon_key
   ```

4. **Deploy**
   - Kliknij "Deploy"
   - Po 2-3 minutach aplikacja będzie dostępna pod adresem `twoja-nazwa.vercel.app`

#### Automatyczne aktualizacje:
- Każdy push do brancha `main` automatycznie wdroży nową wersję

### Opcja 2: Netlify

Alternatywa dla Vercel, również z darmowym planem.

#### Kroki:

1. **Utwórz konto na Netlify**
   - Wejdź na https://netlify.com
   - Zarejestruj się

2. **Utwórz nową stronę**
   - Kliknij "Add new site" → "Import an existing project"
   - Wybierz repozytorium

3. **Konfiguracja build**
   ```
   Build command: npm run build
   Publish directory: .next
   ```

4. **Dodaj zmienne środowiskowe**
   W Site settings → Environment variables:
   ```
   NEXT_PUBLIC_SUPABASE_URL=twój_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=twój_supabase_anon_key
   ```

5. **Deploy**
   - Netlify automatycznie zbuduje i wdroży aplikację

### Opcja 3: VPS (dla zaawansowanych)

Jeśli chcesz mieć pełną kontrolę, możesz użyć VPS (np. DigitalOcean, Hetzner).

#### Wymagania:
- Ubuntu 22.04 lub nowszy
- Node.js 18+
- nginx
- PM2

#### Konfiguracja:
```bash
# Zainstaluj Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Zainstaluj PM2
sudo npm install -g pm2

# Sklonuj repozytorium
git clone twoje-repo
cd obczajone

# Zainstaluj zależności
npm install

# Zbuduj aplikację
npm run build

# Uruchom z PM2
pm2 start npm --name "obczajone" -- start
pm2 save
pm2 startup

# Skonfiguruj nginx jako reverse proxy
```

## Zakup domeny

### Gdzie kupić domenę .pl:

1. **home.pl** - https://home.pl
   - Domena .pl: ~49 zł/rok
   - Polskie wsparcie
   - Łatwy panel zarządzania

2. **OVH** - https://ovh.pl
   - Domena .pl: ~39 zł/rok
   - Duży dostawca europejski
   - Dobre ceny

3. **nazwa.pl** - https://nazwa.pl
   - Domena .pl: ~59 zł/rok
   - Polski rejestr domen
   - Profesjonalna obsługa

### Podłączenie domeny do Vercel:

1. **W panelu rejestratora domen:**
   Dodaj rekordy DNS:
   ```
   Type: A
   Name: @
   Value: 76.76.21.21

   Type: CNAME
   Name: www
   Value: cname.vercel-dns.com
   ```

2. **W Vercel:**
   - Wejdź w Settings projektu
   - Domains → Add Domain
   - Wpisz `obczajone.pl`
   - Vercel zweryfikuje i podpowie jak ustawić DNS

3. **Certyfikat SSL:**
   - Vercel automatycznie wygeneruje darmowy certyfikat SSL (Let's Encrypt)
   - Po 5-10 minutach strona będzie dostępna przez HTTPS

### Podłączenie domeny do Netlify:

1. **W panelu rejestratora domen:**
   Dodaj nameservery Netlify lub rekordy A:
   ```
   Type: A
   Name: @
   Value: 75.2.60.5

   Type: CNAME
   Name: www
   Value: twoja-nazwa.netlify.app
   ```

2. **W Netlify:**
   - Domain settings → Add custom domain
   - Wpisz `obczajone.pl`
   - Netlify automatycznie skonfiguruje SSL

## Supabase - konfiguracja produkcyjna

### Zabezpieczenie bazy danych:

1. **Dodaj pierwszego administratora:**
   ```sql
   INSERT INTO admin_users (user_id, role)
   VALUES ('TWÓJ_USER_ID', 'admin');
   ```

2. **Sprawdź ustawienia RLS:**
   - Wszystkie tabele mają RLS włączone ✓
   - Polityki są restrykcyjne ✓

3. **Skonfiguruj email dla autentykacji:**
   - W Supabase Dashboard → Authentication → Email Templates
   - Możesz dostosować szablony emaili

4. **Opcjonalnie - własna domena email:**
   - W Supabase Dashboard → Project Settings → Custom SMTP
   - Podłącz Gmail, SendGrid lub własny serwer SMTP

### Monitoring i backup:

1. **W Supabase Dashboard:**
   - Database → Backups - automatyczne codzienne backupy
   - Logs - sprawdzaj logi aplikacji

2. **Cron job dla cleanup:**
   W Supabase SQL Editor:
   ```sql
   -- Usuwa stare wpisy rate limit co 24h
   SELECT cron.schedule(
     'cleanup-rate-limits',
     '0 2 * * *',
     $$SELECT cleanup_old_rate_limits()$$
   );
   ```

## Koszt miesięczny (przybliżony)

### Minimalna konfiguracja:
- **Domena .pl**: ~4 zł/miesiąc (49 zł/rok)
- **Vercel Free**: 0 zł (wystarczy dla startu)
- **Supabase Free**: 0 zł (500 MB bazy, 2 GB transferu)
- **SUMA**: ~4 zł/miesiąc

### Konfiguracja dla większego ruchu:
- **Domena .pl**: ~4 zł/miesiąc
- **Vercel Pro**: ~80 zł/miesiąc ($20)
- **Supabase Pro**: ~100 zł/miesiąc ($25)
- **SUMA**: ~184 zł/miesiąc

## Checklist przed uruchomieniem

- [ ] Utworzono konto Vercel/Netlify
- [ ] Dodano zmienne środowiskowe
- [ ] Zakupiono domenę
- [ ] Skonfigurowano DNS
- [ ] Potwierdzono działanie SSL
- [ ] Dodano pierwszego admina do bazy
- [ ] Przetestowano formularz dodawania ogłoszeń
- [ ] Przetestowano dodawanie opinii
- [ ] Sprawdzono panel admina
- [ ] Skonfigurowano monitoring w Supabase
- [ ] Ustawiono cron job dla cleanup

## Wsparcie

Jeśli napotkasz problemy:

1. **Vercel:**
   - Dokumentacja: https://vercel.com/docs
   - Community: https://github.com/vercel/next.js/discussions

2. **Supabase:**
   - Dokumentacja: https://supabase.com/docs
   - Discord: https://discord.supabase.com

3. **Next.js:**
   - Dokumentacja: https://nextjs.org/docs

## Następne kroki po wdrożeniu

1. Dodaj Google Analytics lub Plausible do śledzenia ruchu
2. Skonfiguruj monitoring błędów (Sentry)
3. Dodaj sitemap.xml dla SEO
4. Rozważ CDN dla zdjęć (Cloudinary, Uploadcare)
5. Zaimplementuj newsletter
6. Dodaj integrację z social media
