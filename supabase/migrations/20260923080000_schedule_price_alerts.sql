/*
  # Uruchomienie alertów cenowych

  Funkcja `send-price-alerts` jest wdrożona od 27 sierpnia, RESEND_API_KEY
  ustawiony tego samego dnia, formularz na stronach ogłoszeń zbiera adresy.
  Brakowało jedynej rzeczy, która sprawia, że to działa: wpisu w cron.job.

  Efekt: siedem zapisów między 2 a 19 września, `last_notified_price` NULL
  u wszystkich - nikt nie dostał ani jednej wiadomości. Jedna osoba zapisała
  się tego samego dnia na cztery ogłoszenia, czyli dokładnie ten przypadek,
  dla którego ta funkcja powstała.

  ## Raz dziennie, nie co godzinę

  Ceny odświeżają się co godzinę, ale obniżka auta nie jest zdarzeniem, o którym
  trzeba wiedzieć w ciągu godziny - a przelot działający całą dobę wysyłałby
  maile również w nocy. 7:15 UTC to 9:15 czasu polskiego latem i 8:15 zimą:
  rano, po przelocie cen o :07, w minucie, której nie zajmuje żadne inne zadanie.

  Próg 2% siedzi w samej funkcji (MIN_DROP_PERCENT) i zostaje tam, gdzie jest -
  to decyzja o tym, co jest warte maila, a nie o harmonogramie.

  Wywołanie skopiowane z `model-sweep`, łącznie z kluczem z vault: funkcja ma
  verify_jwt = true, więc bez nagłówka Authorization odpowiedziałaby 401.
*/

SELECT cron.schedule(
  'send-price-alerts',
  '15 7 * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://tumyxmvbytwizmyqnvgc.supabase.co/functions/v1/send-price-alerts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE((
        SELECT decrypted_secret FROM vault.decrypted_secrets
        WHERE name = 'daily_scraper_invoke_key'
        LIMIT 1
      ), '')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  )
  $cron$
);
