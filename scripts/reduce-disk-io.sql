/*
  Schodzi z trzech godzinnych przeliczeń na dobowe.

  28 września 2026 instancja przeszła w stan Unhealthy i nie wstała przez
  dwadzieścia godzin. Supabase przysłał powód wprost: "utilizing more Disk IO
  than what your compute add-on can effectively manage", a dalej - "your
  instance may become unresponsive". Tak to się skończyło.

  Skąd się wzięło to zapotrzebowanie. W ciągu dziewięciu dni doszły trzy
  zadania odświeżające snapshoty - :35, :45 i :55, każde CO GODZINĘ. Powstały,
  żeby zdjąć liczenie median ze stron (i to zrobiły: /dla-mediow i strony miast
  przestały wywalać deploy), ale przeniosły tę pracę na crona, nie usunęły jej.
  Samo `refresh_model_trends_snapshot` to pięć przebiegów po ogłoszeniach
  z czterema percentylami. Siedemdziesiąt dwa takie przeloty na dobę na
  t4g.nano to więcej IO, niż ta maszyna ma budżetu.

  Daty pasują: snapshoty doszły 16, 18 i 25 września, ciężkie awarie przyszły
  26 i 28.

  Dlaczego doba wystarczy. Te liczby opisują trendy rynkowe - mediana obniżki
  w modelu, cena metra w mieście, udział taniejących ofert. Takie wielkości nie
  zmieniają się w godzinę na tyle, żeby ktokolwiek to zauważył, a strony i tak
  mają `revalidate = 3600`, więc godzinne odświeżanie snapshotu nie miało nawet
  jak dotrzeć do czytelnika szybciej.

  Godziny rozsunięte i wybrane na noc, poza przelotami scrapera (:07 i :50),
  żeby nie schodziły się na jednym połączeniu ani na jednym kawałku budżetu IO.

  Uruchamiać PO tym, jak baza wróci i ustabilizuje się:
    node scripts/run-sql.mjs scripts/reduce-disk-io.sql
*/

SELECT cron.unschedule(jobid) FROM cron.job
WHERE jobname IN ('refresh-report-snapshot', 'refresh-model-trends', 'refresh-city-prices');

SELECT cron.schedule(
  'refresh-report-snapshot',
  '35 2 * * *',
  $cron$ SELECT refresh_report_snapshot(); $cron$
);

SELECT cron.schedule(
  'refresh-model-trends',
  '45 4 * * *',
  $cron$ SELECT refresh_model_trends_snapshot(); $cron$
);

SELECT cron.schedule(
  'refresh-city-prices',
  '55 5 * * *',
  $cron$ SELECT refresh_city_prices_snapshot(); $cron$
);

-- Kontrola: te trzy mają mieć w harmonogramie konkretną godzinę, nie gwiazdkę.
SELECT jobname, schedule, active FROM cron.job ORDER BY jobname;
