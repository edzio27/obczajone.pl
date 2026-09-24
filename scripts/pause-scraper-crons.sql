/*
  Wyłącza wszystkie zadania cykliczne uderzające w bazę.

  Do użycia, gdy baza przestaje odpowiadać: dopóki crony chodzą, każda próba
  ratowania konkuruje z ich zapytaniami. Zdjęcie obciążenia jest pierwszym
  krokiem, a nie ostatecznością.

  Co wyłączamy i co to znaczy:

    price-scraper-sweep  co godzinę o :07  — ceny pojedynczych ogłoszeń
    model-sweep          3:20 i 15:20      — przelot po modelach Otomoto
    otodom-sweep         co godzinę o :50  — przelot po Otodomie

  Nic z tego nie jest pilne w skali godzin. Ceny nie zmieniają się co godzinę,
  a mail o obniżce wysłany dzień później nadal jest na czas. Historia cen
  zostaje nietknięta - to tylko przerwa w dopisywaniu do niej.

  UWAGA: to nie jest zmiana schematu, tylko przełącznik. Skrypt przywracający
  harmonogram leży obok, w resume-scraper-crons.sql, z tymi samymi godzinami.
*/

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'price-scraper-sweep';
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'model-sweep';
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'otodom-sweep';

-- Kontrola: po wykonaniu ta lista powinna być pusta.
SELECT jobid, jobname, schedule, active FROM cron.job ORDER BY jobname;
