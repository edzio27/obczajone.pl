const EARTH_RADIUS_KM = 6371;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** Odległość po powierzchni Ziemi w kilometrach (wzór haversine). */
export function distanceKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

export function formatDistance(km: number): string {
  if (km < 10) return 'w tej samej okolicy';
  return `ok. ${Math.round(km / 10) * 10} km od ogłoszenia`;
}

/**
 * Lista województw używana przez filtry katalogu partnerów i formularz
 * zgłoszeniowy. Trzymana w jednym miejscu, bo rozjazd w pisowni (np. "łódzkie"
 * vs "Łódzkie") po cichu wypada z filtrowania po równości.
 */
export const VOIVODESHIPS = [
  'dolnośląskie',
  'kujawsko-pomorskie',
  'lubelskie',
  'lubuskie',
  'łódzkie',
  'małopolskie',
  'mazowieckie',
  'opolskie',
  'podkarpackie',
  'podlaskie',
  'pomorskie',
  'śląskie',
  'świętokrzyskie',
  'warmińsko-mazurskie',
  'wielkopolskie',
  'zachodniopomorskie',
] as const;

/**
 * Współrzędne polskich miast, do wyznaczenia położenia ogłoszenia, gdy nie mamy
 * współrzędnych sprzedawcy - a nie mamy ich przy 87% ogłoszeń.
 *
 * Tablica w kodzie zamiast geokodera: dobór partnera pyta tylko, czy ogłoszenie
 * mieści się w promieniu 200 km, więc błąd rzędu kilku kilometrów jest bez
 * znaczenia. Zewnętrzne API kosztowałoby klucz, limit zapytań i kolejny powód,
 * dla którego strona ogłoszenia mogłaby się nie wyrenderować.
 */
const CITY_COORDS: Record<string, [number, number]> = {
  warszawa: [52.2297, 21.0122], krakow: [50.0647, 19.945], lodz: [51.7592, 19.456],
  wroclaw: [51.1079, 17.0385], poznan: [52.4064, 16.9252], gdansk: [54.352, 18.6466],
  szczecin: [53.4285, 14.5528], bydgoszcz: [53.1235, 18.0084], lublin: [51.2465, 22.5684],
  bialystok: [53.1325, 23.1688], katowice: [50.2649, 19.0238], gdynia: [54.5189, 18.5305],
  czestochowa: [50.7971, 19.1204], radom: [51.4027, 21.1471], torun: [53.0138, 18.5984],
  sosnowiec: [50.2863, 19.104], rzeszow: [50.0413, 21.999], kielce: [50.8661, 20.6286],
  gliwice: [50.2945, 18.6714], zabrze: [50.3249, 18.7857], olsztyn: [53.7784, 20.4801],
  'bielsko-biala': [49.8224, 19.0584], bytom: [50.3483, 18.9157], 'zielona gora': [51.9356, 15.5062],
  rybnik: [50.0971, 18.5416], 'ruda slaska': [50.2585, 18.8556], opole: [50.6751, 17.9213],
  tychy: [50.1372, 18.9662], 'gorzow wielkopolski': [52.7368, 15.2288],
  'dabrowa gornicza': [50.3217, 19.1875], elblag: [54.1522, 19.4088], plock: [52.5463, 19.7065],
  walbrzych: [50.7846, 16.2843], wloclawek: [52.6483, 19.0678], tarnow: [50.0121, 20.9858],
  chorzow: [50.3057, 18.9542], koszalin: [54.1943, 16.1722], kalisz: [51.7611, 18.091],
  legnica: [51.207, 16.1553], grudziadz: [53.4837, 18.7536], jaworzno: [50.205, 19.2731],
  slupsk: [54.4641, 17.0287], 'jastrzebie-zdroj': [49.955, 18.57], 'nowy sacz': [49.6216, 20.6971],
  'jelenia gora': [50.9044, 15.7194], siedlce: [52.1677, 22.2902], myslowice: [50.2074, 19.1665],
  konin: [52.2231, 18.2513], pila: [53.1515, 16.7383], 'piotrkow trybunalski': [51.4053, 19.703],
  inowroclaw: [52.7986, 18.2611], lubin: [51.4007, 16.2015], 'ostrow wielkopolski': [51.6493, 17.8137],
  suwalki: [54.1116, 22.9309], stargard: [53.3364, 15.0499], gniezno: [52.5348, 17.5826],
  'ostrowiec swietokrzyski': [50.9294, 21.3853], glogow: [51.664, 16.0844],
  pabianice: [51.6644, 19.3549], leszno: [51.841, 16.5748], zory: [50.0447, 18.7008],
  zamosc: [50.723, 23.2518], pruszkow: [52.1705, 20.811], lomza: [53.1781, 22.0592],
  elk: [53.828, 22.3647], 'tomaszow mazowiecki': [51.5313, 20.0084], chelm: [51.1431, 23.4716],
  mielec: [50.2872, 21.4239], 'kedzierzyn-kozle': [50.3497, 18.2262], przemysl: [49.7838, 22.7679],
  'stalowa wola': [50.5826, 22.0533], 'tarnowskie gory': [50.4457, 18.8615],
  ostroleka: [53.0857, 21.5758], raciborz: [50.0918, 18.219], starachowice: [51.0499, 21.0714],
  wejherowo: [54.6053, 18.236], zgierz: [51.8556, 19.4062], piaseczno: [52.081, 21.0244],
  swidnica: [50.8438, 16.489], skierniewice: [51.9546, 20.1461],
  'starogard gdanski': [53.9686, 18.5303], legionowo: [52.4022, 20.9276],
  wrzesnia: [52.326, 17.5654], kutno: [52.2307, 19.3644], zary: [51.6421, 15.1385],
  sopot: [54.4418, 18.5601], rumia: [54.571, 18.389], tczew: [54.0921, 18.7772],
  malbork: [54.0359, 19.0266], nysa: [50.474, 17.3333], brzeg: [50.8607, 17.4676],
  krosno: [49.6884, 21.7706], sanok: [49.5556, 22.2064], debica: [50.0516, 21.4111],
  jaroslaw: [49.98, 22.677], 'biala podlaska': [52.0324, 23.1165], pulawy: [51.4166, 21.9694],
  swinoujscie: [53.91, 14.247], kolobrzeg: [54.1757, 15.583], boleslawiec: [51.265, 15.569],
  olesnica: [51.21, 17.38], olawa: [50.945, 17.292], trzebnica: [51.31, 17.065],
  'sroda wielkopolska': [52.228, 17.276], srem: [52.089, 17.015], krotoszyn: [51.698, 17.436],
  turek: [52.018, 18.5], kolo: [52.2, 18.638], mlawa: [53.113, 20.386],
  ciechanow: [52.881, 20.61], sochaczew: [52.229, 20.238], 'grodzisk mazowiecki': [52.109, 20.626],
  otwock: [52.105, 21.261], wolomin: [52.341, 21.244], 'minsk mazowiecki': [52.179, 21.572],
  'ostrow mazowiecka': [52.796, 21.893], ostrzeszow: [51.42, 17.93], 'nowy tomysl': [52.32, 16.13],
  // Miejscowości podmiejskie, które w ogłoszeniach pojawiają się częściej niż
  // niejedno miasto powiatowe - bo tam stoją komisy. Współrzędne przybliżone do
  // środka miejscowości, co przy promieniu 200 km nie robi żadnej różnicy.
  'konstancin-jeziorna': [52.087, 21.118], marki: [52.32, 21.105], zawiercie: [50.4877, 19.432],
  dlugoleka: [51.167, 17.2], 'bielany wroclawskie': [51.0355, 16.967], brzeziny: [51.8, 19.75],
  zbaszyn: [52.25, 15.92], swadzim: [52.44, 16.77], jawczyce: [52.21, 20.83],
  nieborowice: [50.22, 18.63], pozowice: [50.0, 19.6], wegrzce: [50.1350, 19.9800],
  'nowy dwor mazowiecki': [52.4333, 20.7167], jozefow: [52.14, 21.24], lomianki: [52.3333, 20.8833],
  raszyn: [52.15, 20.9], zabki: [52.29, 21.1], sulejowek: [52.25, 21.27],
  bochnia: [49.969, 20.43], wieliczka: [49.987, 20.055], skawina: [49.975, 19.83],
  myslenice: [49.834, 19.939], oswiecim: [50.038, 19.222], chrzanow: [50.135, 19.401],
  olkusz: [50.28, 19.565], andrychow: [49.855, 19.34], wadowice: [49.883, 19.493],
  cieszyn: [49.75, 18.633], zywiec: [49.685, 19.192], pszczyna: [49.978, 18.945],
  mikolow: [50.17, 18.9], knurow: [50.219, 18.665], czeladz: [50.317, 19.083],
  bedzin: [50.326, 19.126], swietochlowice: [50.296, 18.918], piekary: [50.38, 18.95],
  lubliniec: [50.667, 18.683], klodzko: [50.435, 16.66], dzierzoniow: [50.727, 16.65],
  strzelin: [50.78, 17.065], srodawielkopolska: [52.228, 17.276], wagrowiec: [52.808, 17.2],
  swarzedz: [52.408, 17.083], lubon: [52.345, 16.885], mosina: [52.24, 16.845],
  kostrzyn: [52.393, 17.228], oborniki: [52.647, 16.812], szamotuly: [52.611, 16.578],
  grodzisk: [52.222, 16.363], tarnowo: [52.463, 16.688],
};

/** Bez ogonków i wielkości liter - w ogłoszeniach bywa "Zielona Gora" i "zielona góra". */
function normalizeCity(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ł/g, 'l')
    .replace(/Ł/g, 'L')
    .toLowerCase()
    .trim();
}

/**
 * Współrzędne z tekstowej lokalizacji ogłoszenia. `null`, gdy miasta nie ma w
 * tablicy - wtedy wołający zachowuje się jak dotąd i pokazuje wszystkich
 * partnerów, więc ta funkcja może tylko poprawić dopasowanie, nigdy je pogorszyć.
 */
export function coordsFromLocation(location: string | null | undefined) {
  if (!location) return null;
  const hit = CITY_COORDS[normalizeCity(location)];
  return hit ? { lat: hit[0], lng: hit[1] } : null;
}
