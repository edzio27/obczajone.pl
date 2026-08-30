-- Logo pobrane ze strony firmy (jej własny znak z favikony), plik leży
-- w repo pod public/partners/. Wgrywania logo nie ma dziś w żadnym panelu,
-- więc to jedyna droga - do zmiany, gdy dojdzie trzeci partner.
UPDATE partners
SET logo_url = '/partners/autodoradca-szczecin.jpg'
WHERE slug = 'autodoradca-szczecin';

SELECT name, logo_url FROM partners WHERE slug = 'autodoradca-szczecin';
