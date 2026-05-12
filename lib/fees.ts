const DEFAULT_FEE_BPS = 1500; // 15%

export function platformFeeBps(): number {
  const raw = process.env.PLATFORM_FEE_BPS;
  if (!raw) return DEFAULT_FEE_BPS;
  const n = parseInt(raw, 10);
  if (Number.isNaN(n) || n < 0 || n > 10_000) return DEFAULT_FEE_BPS;
  return n;
}

export function platformFeeCents(priceCents: number): number {
  if (priceCents <= 0) return 0;
  return Math.round((priceCents * platformFeeBps()) / 10_000);
}

export function priceForMinutes(hourlyRateCents: number, minutes: number): number {
  return Math.round((hourlyRateCents * minutes) / 60);
}
