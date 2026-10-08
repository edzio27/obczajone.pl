/*
  Nowy kanał pochodzenia: "alert".

  Po sześciu tygodniach pilotażu partnerskiego mamy 27 kliknięć w partnerów
  i zero wypełnionych formularzy. Mechanizm działa - sprawdzone zapisem przez
  klucz publiczny, odpowiedź 201 - więc problemem jest brak intencji, nie błąd.

  Odwiedzający trafiają dziś na stronę główną z wyszukiwania po nazwie i nie
  mają w głowie konkretnego auta. Jedyny moment, w którym wiemy, że ktoś patrzy
  na konkretną ofertę i właśnie dostał powód do działania, to mail alertowy
  "cena spadła o X zł". Do dziś ten mail nie zawierał ani słowa o oględzinach.

  Bez tej wartości w CHECK nie dałoby się odróżnić leada z alertu od leada ze
  strony partnerów - a cały sens tego kroku polega na tym, żeby za dwa tygodnie
  dało się powiedzieć, czy kanał cokolwiek przyniósł, zamiast zgadywać.
*/

ALTER TABLE partner_clicks DROP CONSTRAINT IF EXISTS partner_clicks_context_check;
ALTER TABLE partner_clicks ADD CONSTRAINT partner_clicks_context_check
  CHECK (context = ANY (ARRAY['listing_cta', 'homepage', 'partners_page', 'alert']));

ALTER TABLE partner_leads DROP CONSTRAINT IF EXISTS partner_leads_context_check;
ALTER TABLE partner_leads ADD CONSTRAINT partner_leads_context_check
  CHECK (context = ANY (ARRAY['partner_page', 'listing_cta', 'partners_page', 'alert']));
