export function normalizeSellerName(name: string, city: string): string {
  let normalized = name.trim().toLowerCase();
  const cityLower = city.trim().toLowerCase();
  if (cityLower && normalized.endsWith(cityLower)) {
    normalized = normalized.slice(0, normalized.length - cityLower.length).trim();
  }
  return normalized.replace(/\s+/g, ' ');
}

export type SellerBranch = {
  id: string;
  name: string;
  city: string;
};

export function findOtherBranches<T extends SellerBranch>(current: T, candidates: T[]): T[] {
  const currentNormalized = normalizeSellerName(current.name, current.city);
  return candidates.filter(
    (candidate) =>
      candidate.id !== current.id &&
      candidate.city !== current.city &&
      normalizeSellerName(candidate.name, candidate.city) === currentNormalized
  );
}
