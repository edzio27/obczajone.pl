-- Logo GCC Sprawdzenie Auta. Plik leży w repo pod public/partners/, więc
-- musi zostać zacommitowany i wypchnięty ZANIM ten UPDATE pójdzie do bazy -
-- inaczej profil pokaże złamany obrazek zamiast dzisiejszej ikony zastępczej.
-- Wgrywania logo nadal nie ma w żadnym panelu; to trzeci partner z rzędu
-- ustawiany ręcznie i pierwszy kandydat do dodania w panelu admina.
UPDATE partners
SET logo_url = '/partners/gcc-sprawdzenie-auta.jpg'
WHERE slug = 'gcc-sprawdzenie-auta';

SELECT name, logo_url FROM partners WHERE slug = 'gcc-sprawdzenie-auta';
