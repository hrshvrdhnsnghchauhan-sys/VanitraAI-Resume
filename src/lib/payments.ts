// Shared, isomorphic payment types + gateway auto-detection.
// Used by the billing page (client) — safe to import anywhere.
export type PaymentGateway = "razorpay" | "stripe";

export type BillingInterval = "monthly" | "yearly";

export interface Plan {
  id: string;
  name: string;
  /** INR (paise-scale display) prices for Razorpay (India) */
  monthlyPrice: number;
  yearlyPrice: number;
  /** USD prices for Stripe (international) */
  monthlyUsd: number;
  yearlyUsd: number;
  features: string[];
}

export const PLANS: Plan[] = [
  {
    id: "starter",
    name: "Starter",
    monthlyPrice: 999,
    yearlyPrice: 9999,
    monthlyUsd: 12,
    yearlyUsd: 119,
    features: ["1 AI Resume", "Basic ATS Check", "Standard Templates", "Email Support"],
  },
  {
    id: "professional",
    name: "Professional",
    monthlyPrice: 1999,
    yearlyPrice: 19999,
    monthlyUsd: 24,
    yearlyUsd: 239,
    features: [
      "Unlimited Resumes",
      "Advanced ATS Optimization",
      "Job Matching",
      "Priority Support",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    monthlyPrice: 4999,
    yearlyPrice: 49999,
    monthlyUsd: 59,
    yearlyUsd: 589,
    features: ["Everything in Pro", "Interview Prep (AI)", "Career Roadmap", "1-on-1 Mentorship"],
  },
];

/** Free-trial length applied to new subscriptions when enabled. */
export const TRIAL_DAYS = 7;

export const GATEWAY_STORAGE_KEY = "vanitra_payment_gateway";

/**
 * Client-side country detection. Indian users (Asia/Kolkata timezone or an
 * Indian locale) default to Razorpay; everyone else defaults to Stripe.
 * Vercel's x-vercel-ip-country header would be more precise, but this version
 * of TanStack Start doesn't expose request headers inside createServerFn, and
 * the heuristic works identically on localhost, previews and production.
 * The user can always override the choice manually in the billing UI.
 */
export function detectGateway(): PaymentGateway {
  if (typeof window === "undefined") return "stripe";
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    const locale = (navigator.language || "").toLowerCase();
    const isIndianTz = tz === "Asia/Kolkata" || tz.toLowerCase().includes("kolkata");
    const isIndianLocale =
      locale.startsWith("en-in") ||
      locale.startsWith("hi") ||
      locale.startsWith("bn") ||
      locale.startsWith("ta") ||
      locale.startsWith("te") ||
      locale.startsWith("mr") ||
      locale.startsWith("gu") ||
      locale.startsWith("kn") ||
      locale.startsWith("ml") ||
      locale.startsWith("pa") ||
      locale.startsWith("ur");
    return isIndianTz || isIndianLocale ? "razorpay" : "stripe";
  } catch {
    return "stripe";
  }
}

export function getStoredGateway(): PaymentGateway | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(GATEWAY_STORAGE_KEY);
    return stored === "razorpay" || stored === "stripe" ? stored : null;
  } catch {
    return null;
  }
}

export function setStoredGateway(gateway: PaymentGateway) {
  try {
    localStorage.setItem(GATEWAY_STORAGE_KEY, gateway);
  } catch {
    /* ignore */
  }
}

export function planPrice(plan: Plan, gateway: PaymentGateway, interval: BillingInterval): number {
  if (gateway === "stripe") {
    return interval === "yearly" ? plan.yearlyUsd : plan.monthlyUsd;
  }
  return interval === "yearly" ? plan.yearlyPrice : plan.monthlyPrice;
}

export function planCurrency(gateway: PaymentGateway): string {
  return gateway === "stripe" ? "USD" : "INR";
}

export interface CouponResult {
  valid: boolean;
  code?: string;
  percentOff?: number;
  amountOff?: number;
  message?: string;
}
