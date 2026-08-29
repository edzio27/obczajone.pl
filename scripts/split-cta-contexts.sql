/*
  Rozdzielenie lejków: przycisk przy ogłoszeniu vs sekcja pod opinią AI.

  Dziś oba miejsca raportują się jako `listing_cta`, bo tylko taką wartość
  dopuszcza CHECK na obu tabelach. Dopóki ruch jest zerowy, jedna wartość
  wystarcza - liczy się, czy ktokolwiek kliknie. Gdy zacznie klikać, to jest
  migracja, która pozwoli porównać oba miejsca.

  Po uruchomieniu zmień `context="listing_cta"` na `context="listing_dialog"`
  w components/partner/inspection-cta-button.tsx i rozszerz typ w
  components/partner/partner-picker.tsx.

  Uruchomić w Supabase → SQL Editor.
*/

BEGIN;

ALTER TABLE partner_clicks DROP CONSTRAINT IF EXISTS partner_clicks_context_check;
ALTER TABLE partner_clicks ADD CONSTRAINT partner_clicks_context_check
  CHECK (context IN ('listing_cta', 'listing_dialog', 'homepage', 'partners_page'));

ALTER TABLE partner_leads DROP CONSTRAINT IF EXISTS partner_leads_context_check;
ALTER TABLE partner_leads ADD CONSTRAINT partner_leads_context_check
  CHECK (context IN ('partner_page', 'listing_cta', 'listing_dialog', 'partners_page'));

COMMIT;
