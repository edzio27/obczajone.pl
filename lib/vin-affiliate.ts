/*
  Program partnerski konfigurujemy zmiennymi, a nie w kodzie, bo link zawiera
  identyfikator konta i bywa zmieniany bez udziału programisty. Dopóki nie są
  ustawione, przyciski płatne w ogóle się nie renderują - lepiej nie pokazać nic
  niż pokazać przycisk prowadzący donikąd.

  Trzymane w jednym miejscu, bo link stoi w dwóch: przy cenie ogłoszenia
  i w karcie o VIN-ie niżej.
*/
export const VIN_AFFILIATE_URL = process.env.NEXT_PUBLIC_VIN_AFFILIATE_URL;
export const VIN_AFFILIATE_NAME = process.env.NEXT_PUBLIC_VIN_AFFILIATE_NAME;
export const VIN_AFFILIATE_PROVIDER = process.env.NEXT_PUBLIC_VIN_AFFILIATE_PROVIDER;
/*
  Kod rabatowy jest opcjonalny. Program może go nie dawać albo cofnąć, a link
  działa bez niego, więc brak tych zmiennych chowa tylko wzmiankę o kodzie.
*/
export const VIN_AFFILIATE_DISCOUNT_CODE = process.env.NEXT_PUBLIC_VIN_AFFILIATE_DISCOUNT_CODE;
export const VIN_AFFILIATE_DISCOUNT_PERCENT = process.env.NEXT_PUBLIC_VIN_AFFILIATE_DISCOUNT_PERCENT;

export const hasVinAffiliate = Boolean(
  VIN_AFFILIATE_URL && VIN_AFFILIATE_NAME && VIN_AFFILIATE_PROVIDER
);
