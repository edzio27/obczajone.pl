-- Cena odniesienia z Otomoto zapisana, zanim funkcja nauczyla sie odrzucac
-- przypadki o innej podstawie podatkowej. Taki wiersz ma cene "przed" NIZSZA
-- od biezacej, wiec nie opisuje zadnej obnizki i jako dana kontrolna jest
-- gorszy niz brak danej. Procent zostawiamy - jest wyliczony przez Otomoto
-- wewnetrznie spojnie i to on jest tu wlasciwym sygnalem.
UPDATE listing_snapshots
SET source_price_before = NULL
WHERE source_price_before IS NOT NULL
  AND source_price_before <= price;
