# Jak promować obczajone.pl

## 1. Google Search Console

### Weryfikacja strony
1. Wejdź na: https://search.google.com/search-console
2. Dodaj swoją domenę: `obczajone.pl`
3. Skopiuj kod weryfikacji
4. Wklej kod w `app/layout.tsx` w miejscu: `google: 'google-site-verification-code'`

### Reindeksacja
1. Prześlij sitemap: `https://obczajone.pl/sitemap.xml`
2. Użyj "URL Inspection" dla głównych stron
3. Kliknij "Request Indexing"

## 2. Facebook / Meta

### Meta Tags (już dodane)
- Open Graph tags są już w kodzie
- Tworzą ładny podgląd gdy ktoś udostępnia link

### Promowanie
1. Utwórz stronę Facebook dla obczajone.pl
2. Regularnie publikuj:
   - Porady jak unikać oszustw
   - Przykłady zweryfikowanych ogłoszeń
   - Statystyki (np. "10 000 ogłoszeń sprawdzonych!")
3. Dołącz do grup:
   - "Kupię/Sprzedam samochód"
   - "Ogłoszenia motoryzacyjne"
   - Grupy kupna/sprzedaży mieszkań
4. Subtelnie linkuj w komentarzach do swoich postów

### Facebook Ads
```
Tytuł: "Sprawdź ogłoszenie przed zakupem!"
Tekst: "Nie daj się oszukać! Sprawdź historię cen i opinie innych kupujących."
Link: https://obczajone.pl
```

## 3. ChatGPT / AI

### Strukturyzowane dane (już dodane)
- JSON-LD schema już w kodzie
- robots.txt zezwala na indeksację przez AI boty
- ai-plugin.json dla wtyczek ChatGPT

### Jak AI znajdzie twoją stronę
1. **Linki zwrotne** - im więcej stron linkuje do obczajone.pl, tym lepiej
2. **Wartościowa treść** - dodawaj bloga z poradami
3. **Aktywność** - regularne aktualizacje = wyższa widoczność

## 4. SEO - Słowa kluczowe (już dodane)

Dodane frazy:
- "otomoto opinie"
- "otodom opinie"
- "historia cen otomoto"
- "historia cen otodom"
- "weryfikacja ogłoszeń"
- "oszustwa otomoto"
- "oszustwa otodom"

## 5. Twitter/X

Stwórz konto i publikuj:
- Przykłady wykrytych oszustw (bez personaliów)
- Porady bezpiecznych zakupów
- Statystyki i ciekawostki
- Używaj hashtagów: #otomoto #otodom #bezpieczeństwo #auto #nieruchomości

## 6. LinkedIn

Publikuj artykuły eksperckie:
- "Jak rozpoznać oszustwo w ogłoszeniu?"
- "5 czerwonych flag przy kupnie samochodu"
- "Historia zmian ceny - dlaczego jest ważna?"

## 7. YouTube / TikTok

Krótkie filmy:
- Tutorial "Jak sprawdzić ogłoszenie?"
- "Top 3 oszustw na Otomoto"
- Screen recording weryfikacji ogłoszenia

## 8. Reddit / Wykop

- r/Polska - podziel się w temacie o zakupach
- Wykop.pl - dodawaj linki do ciekawych przypadków
- Fora motoryzacyjne

## 9. Google Ads

Kampania remarketingowa:
```
Frazy:
- "opinie otomoto"
- "sprawdź ogłoszenie"
- "historia cen samochodu"
- "oszustwa online"
```

## 10. Lokalne SEO

1. Dodaj firmę do Google My Business
2. Kategoria: "Usługi internetowe"
3. Dodaj zdjęcia i opis

## 11. Linki zwrotne (Backlinks)

Kontakt z:
- Blogami motoryzacyjnymi
- Portalami o nieruchomościach
- Forami dyskusyjnymi
- Mediami lokalnymi

Treść mailingowa:
```
Temat: Narzędzie do weryfikacji ogłoszeń - współpraca

Dzień dobry,

Stworzyłem portal obczajone.pl, który pomaga weryfikować
ogłoszenia z Otomoto i Otodom. Użytkownicy mogą sprawdzać
historię cen i czytać opinie innych.

Czy byliby Państwo zainteresowani:
- Artykułem gościnnym na ten temat?
- Wzajemnymi linkami?
- Recenzją portalu?

Pozdrawiam
```

## 12. Email marketing

1. Zbieraj emaile (dodaj newsletter)
2. Wysyłaj cotygodniowy digest:
   - Najciekawsze przypadki
   - Porady
   - Nowości na stronie

## 13. Influencer marketing

Kontakt z YouTuberami motoryzacyjnymi:
- @AutoCentrum
- @ZaStary
- @GarażJarka

Propozycja: "Sprawdźmy razem ogłoszenie na żywo"

## 14. PR i media

Wyślij informację prasową do:
- money.pl
- interia.pl
- onet.pl
- wp.pl

Tytuł: "Nowy portal chroni Polaków przed oszustwami w ogłoszeniach"

## 15. Monitoring efektów

Dodaj Google Analytics:
1. Wejdź na: https://analytics.google.com
2. Utwórz właściwość dla obczajone.pl
3. Skopiuj kod śledzenia
4. Dodaj do `app/layout.tsx`

## Następne kroki techniczne

### Obrazy OG (Open Graph)
Potrzebujesz stworzyć:
- `/public/og-image.png` (1200x630px)
- `/public/logo.png`
- `/public/icon-192.png`
- `/public/icon-512.png`

### Google Analytics
```typescript
// Dodaj w app/layout.tsx w <head>
<script
  async
  src="https://www.googletagmanager.com/gtag/js?id=GA_MEASUREMENT_ID"
/>
<script
  dangerouslySetInnerHTML={{
    __html: `
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', 'GA_MEASUREMENT_ID');
    `,
  }}
/>
```

### Facebook Pixel
```typescript
// Podobnie dla Facebook Pixel
<script
  dangerouslySetInnerHTML={{
    __html: `
      !function(f,b,e,v,n,t,s)
      {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
      n.callMethod.apply(n,arguments):n.queue.push(arguments)};
      if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
      n.queue=[];t=b.createElement(e);t.async=!0;
      t.src=v;s=b.getElementsByTagName(e)[0];
      s.parentNode.insertBefore(t,s)}(window, document,'script',
      'https://connect.facebook.net/en_US/fbevents.js');
      fbq('init', 'YOUR_PIXEL_ID');
      fbq('track', 'PageView');
    `,
  }}
/>
```

## Budget vs Darmowe

### Darmowe (ROI: wysoki)
- SEO optymalizacja ✅ (zrobione)
- Social media organiczny
- Content marketing (blog)
- Forum/Reddit
- Email marketing

### Płatne (ROI: średni)
- Google Ads (10-50 PLN/dzień)
- Facebook Ads (20-100 PLN/dzień)
- Influencer marketing (500-5000 PLN)

## Timeline

### Tydzień 1-2: Podstawy
- Weryfikacja Google Search Console ✅
- Profile social media
- Pierwsze posty

### Tydzień 3-4: Treść
- 5-10 artykułów na blogu
- Aktywność na forach
- Pierwsze filmy

### Miesiąc 2-3: Ekspansja
- Współpraca z influencerami
- Artykuły gościnne
- Pierwsze kampanie płatne

### Miesiąc 4+: Optymalizacja
- Analiza danych
- A/B testing
- Skalowanie działań
