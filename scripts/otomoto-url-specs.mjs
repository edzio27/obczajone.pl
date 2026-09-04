/*
  Lustro helpera z supabase/functions/scrape-listing/index.ts, dla skryptów node.
  Edge functions dzialaja w Deno i nie da sie ich zaimportowac tutaj, a ten sam
  podzial sluga musi dawac te same nazwy w backfillu i w scraperze - inaczej
  backfill zalozylby modele, ktorych scraper potem nigdy nie trafi.
*/
const OTOMOTO_BRANDS = [
  ['alfa-romeo', 'Alfa Romeo'], ['aston-martin', 'Aston Martin'],
  ['ds-automobiles', 'DS Automobiles'], ['harley-davidson', 'Harley-Davidson'],
  ['land-rover', 'Land Rover'], ['mercedes-benz', 'Mercedes-Benz'],
  ['great-wall', 'Great Wall'], ['rolls-royce', 'Rolls-Royce'],
  ['abarth', 'Abarth'], ['acura', 'Acura'], ['audi', 'Audi'], ['bentley', 'Bentley'],
  ['bmw', 'BMW'], ['buick', 'Buick'], ['byd', 'BYD'], ['cadillac', 'Cadillac'],
  ['cfmoto', 'CFMoto'], ['chery', 'Chery'], ['chevrolet', 'Chevrolet'],
  ['chrysler', 'Chrysler'], ['citroen', 'Citroën'], ['cupra', 'Cupra'],
  ['dacia', 'Dacia'], ['daewoo', 'Daewoo'], ['daihatsu', 'Daihatsu'],
  ['dodge', 'Dodge'], ['ducati', 'Ducati'], ['ferrari', 'Ferrari'], ['fiat', 'Fiat'],
  ['ford', 'Ford'], ['gmc', 'GMC'], ['honda', 'Honda'], ['hummer', 'Hummer'],
  ['hyundai', 'Hyundai'], ['infiniti', 'Infiniti'], ['isuzu', 'Isuzu'],
  ['iveco', 'Iveco'], ['jaguar', 'Jaguar'], ['jeep', 'Jeep'], ['kawasaki', 'Kawasaki'],
  ['kia', 'Kia'], ['lamborghini', 'Lamborghini'], ['lancia', 'Lancia'],
  ['lexus', 'Lexus'], ['lincoln', 'Lincoln'], ['lotus', 'Lotus'], ['man', 'MAN'],
  ['maserati', 'Maserati'], ['mazda', 'Mazda'], ['mclaren', 'McLaren'], ['mg', 'MG'],
  ['mini', 'MINI'], ['mitsubishi', 'Mitsubishi'], ['nissan', 'Nissan'],
  ['omoda', 'Omoda'], ['opel', 'Opel'], ['peugeot', 'Peugeot'], ['piaggio', 'Piaggio'],
  ['polestar', 'Polestar'], ['pontiac', 'Pontiac'], ['porsche', 'Porsche'],
  ['renault', 'Renault'], ['saab', 'Saab'], ['scania', 'Scania'], ['seat', 'Seat'],
  ['skoda', 'Skoda'], ['smart', 'Smart'], ['ssangyong', 'SsangYong'],
  ['subaru', 'Subaru'], ['suzuki', 'Suzuki'], ['tesla', 'Tesla'], ['toyota', 'Toyota'],
  ['volkswagen', 'Volkswagen'], ['volvo', 'Volvo'], ['xpeng', 'XPeng'],
  ['yamaha', 'Yamaha'],
].sort((a, b) => b[0].length - a[0].length);

/*
  Slug modelu z powrotem na nazwe. Dwa krotkie czlony obok siebie to jedno
  oznaczenie i lacza sie myslnikiem ("cx-3" -> "CX-3", tak jak w bazie stoi
  juz "CX-5" i "MX-5"); czlon dluzszy to slowo i dostaje spacje
  ("a6-avant" -> "A6 Avant", "seria-5" -> "Seria 5").
*/
function modelFromSlug(slug) {
  const parts = slug.split('-').map((w) =>
    w.length <= 3 ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1)
  );
  let out = parts[0];
  for (let i = 1; i < parts.length; i++) {
    const joined = parts[i - 1].length <= 3 && parts[i].length <= 3;
    out += (joined ? '-' : ' ') + parts[i];
  }
  return out;
}

/*
  Marka i model z adresu ogloszenia - zapasowe zrodlo na wypadek, gdy
  __NEXT_DATA__ nie da sie odczytac albo Otomoto zmieni uklad parametrow.

  Nie jest to ozdoba: 955 z 1661 zapisanych ogloszen nie ma marki wlasnie
  dlatego, ze przy ich pobieraniu ta jedna sciezka zawiodla. Bez marki
  ogloszenie wypada ze statystyk obnizek - w bazie bylo 171 realnych obnizek,
  a liczylo sie 41. Adres ma te dane zawsze i przetrwa kazda zmiane strony:
  /osobowe/oferta/<marka-model>-ID<id>.html

  Marki trzymamy jawna lista, bo z samego sluga nie da sie zgadnac, gdzie
  konczy sie marka - "land-rover-range-rover-sport" to Land Rover, nie Land.
  Dlugie marki sprawdzamy pierwsze.
*/
function specsFromUrl(url) {
  const match = url.split('?')[0].match(/\/oferta\/(.+?)-ID[A-Za-z0-9]+\.html/);
  if (!match) return null;
  const slug = match[1].toLowerCase();

  for (const [brandSlug, brandName] of OTOMOTO_BRANDS) {
    if (slug !== brandSlug && !slug.startsWith(brandSlug + '-')) continue;

    let rest = slug.slice(brandSlug.length).replace(/^-/, '');
    // "cupra-cupra-leon-st" - marka bywa powtorzona w czlonie modelu.
    if (rest === brandSlug || rest.startsWith(brandSlug + '-')) {
      rest = rest.slice(brandSlug.length).replace(/^-/, '');
    }
    if (!rest) return null;
    /*
      Sprzedajacy wpychaja w tytul cala specyfikacje, a Otomoto przenosi ja do
      sluga ("man-tgl-12-190-euro-6-kontener-winda-niski-przebieg"). Nazwa
      modelu ma najwyzej trzy czlony; dluzsze to tytul, nie model, i lepiej
      zostawic ogloszenie bez marki niz zalozyc strone modelu dla jednego auta.
    */
    if (rest.split('-').length > 3) return null;

    return { brand: brandName, model: modelFromSlug(rest) };
  }
  return null;
}


export { specsFromUrl };
