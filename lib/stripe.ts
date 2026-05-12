import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  // Allow build without key, but server-side calls will fail loudly.
  console.warn("STRIPE_SECRET_KEY is not set");
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "", {
  apiVersion: "2024-10-28.acacia",
  typescript: true,
});

export function appUrl(): string {
  return process.env.APP_URL ?? "http://localhost:3000";
}
