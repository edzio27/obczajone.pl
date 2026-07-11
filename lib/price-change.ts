export function computePriceChangePercent(
  currentPrice: number,
  earliestPrice: number
): number | null {
  if (!earliestPrice || earliestPrice <= 0) return null;
  if (currentPrice === earliestPrice) return 0;
  return ((currentPrice - earliestPrice) / earliestPrice) * 100;
}
