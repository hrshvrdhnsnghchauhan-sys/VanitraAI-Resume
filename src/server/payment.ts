import { createServerFn } from "@tanstack/react-start";
import Razorpay from "razorpay";
import Stripe from "stripe";
import crypto from "crypto";

// ---------------------------------------------------------------------------
// Gateway client helpers (server-side only)
// ---------------------------------------------------------------------------

function getRazorpay(): Razorpay | null {
  const keyId = process.env.RAZORPAY_KEY_ID || "";
  const keySecret = process.env.RAZORPAY_KEY_SECRET || "";
  if (!keyId || !keySecret || keyId.includes("placeholder")) return null;
  return new Razorpay({ key_id: keyId, key_secret: keySecret });
}

function getStripe(): Stripe | null {
  const secretKey = process.env.STRIPE_SECRET_KEY || "";
  if (!secretKey || secretKey.includes("placeholder")) return null;
  return new Stripe(secretKey);
}

function isDemoKeys(): boolean {
  const rzp = process.env.RAZORPAY_KEY_ID || "";
  const rzpSecret = process.env.RAZORPAY_KEY_SECRET || "";
  const stripeKey = process.env.STRIPE_SECRET_KEY || "";
  const rzpConfigured = !!(rzp && rzpSecret && !rzp.includes("placeholder"));
  const stripeConfigured = !!(stripeKey && !stripeKey.includes("placeholder"));
  return !rzpConfigured && !stripeConfigured;
}

// ---------------------------------------------------------------------------
// Razorpay (India — primary)
// ---------------------------------------------------------------------------

export const createRazorpayOrderFn = createServerFn({ method: "POST" })
  .validator((data: { amount: number; plan: string; isYearly: boolean }) => data)
  .handler(async ({ data }) => {
    try {
      const razorpay = getRazorpay();
      // Demo mode: only when NO gateway keys are configured at all. If some
      // gateway is configured but Razorpay specifically isn't, fail closed.
      if (!razorpay) {
        if (isDemoKeys()) {
          return {
            success: true,
            orderId: `order_demo_${Date.now()}`,
            amount: Math.round(data.amount * 100),
            isDemo: true,
          };
        }
        return { success: false, error: "Razorpay is not configured for this plan." };
      }

      const options = {
        amount: Math.round(data.amount * 100),
        currency: "INR",
        receipt: `receipt_${Date.now()}`,
        notes: {
          plan: data.plan,
          billing_cycle: data.isYearly ? "yearly" : "monthly",
        },
      };

      const order = await razorpay.orders.create(options);
      return { success: true, orderId: order.id, amount: order.amount };
    } catch (error: any) {
      // Fail closed when real keys are configured: never silently downgrade a
      // real payment attempt to demo mode.
      console.warn("Razorpay order creation failed:", error);
      return { success: false, error: "Failed to create payment order. Please try again." };
    }
  });

export const createRazorpaySubscriptionFn = createServerFn({ method: "POST" })
  .validator(
    (data: { planId: string; totalCount?: number; couponId?: string; trialDays?: number }) => data,
  )
  .handler(async ({ data }) => {
    try {
      const razorpay = getRazorpay();
      // Demo mode: only when NO gateway keys are configured at all. If some
      // gateway is configured but Razorpay specifically isn't, fail closed.
      if (!razorpay) {
        if (isDemoKeys()) {
          return { success: true, subscriptionId: `sub_demo_${Date.now()}`, isDemo: true };
        }
        return { success: false, error: "Razorpay is not configured for this plan." };
      }

      const envKey = `RAZORPAY_PLAN_${data.planId.toUpperCase()}`;
      const rzpPlanId = process.env[envKey];

      if (!rzpPlanId) {
        return { success: false, error: "Subscription plan is not configured for this plan." };
      }

      const options: any = {
        plan_id: rzpPlanId,
        total_count: data.totalCount || 1200,
        customer_notify: 1,
      };

      // Free trial: delay the first charge by pushing start_at into the future.
      if (data.trialDays && data.trialDays > 0) {
        options.start_at = Math.floor(Date.now() / 1000) + data.trialDays * 24 * 60 * 60;
      }

      // Coupon code: applied at subscription creation.
      if (data.couponId) {
        options.coupon_id = data.couponId;
      }

      const subscription: any = await razorpay.subscriptions.create(options);
      return { success: true, subscriptionId: subscription.id };
    } catch (error: any) {
      // Fail closed when real keys are configured.
      console.warn("Razorpay subscription creation failed:", error);
      return { success: false, error: "Failed to create subscription. Please try again." };
    }
  });

export const verifyRazorpaySignatureFn = createServerFn({ method: "POST" })
  .validator(
    (data: {
      razorpay_payment_id: string;
      razorpay_order_id?: string;
      razorpay_subscription_id?: string;
      razorpay_signature: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    try {
      // Demo ids/signatures are ONLY accepted when no gateway keys are
      // configured — with real keys, a crafted demo signature must never pass
      // verification (defense in depth on top of the owner-scoped Firestore
      // writes).
      if (
        isDemoKeys() &&
        (data.razorpay_subscription_id?.startsWith("sub_demo_") ||
          data.razorpay_order_id?.startsWith("order_demo_") ||
          data.razorpay_signature === "demo_signature")
      ) {
        return { success: true, isDemo: true };
      }
      const secret = process.env.RAZORPAY_KEY_SECRET || "";

      // Without either an order or subscription id there is nothing to verify
      // against — fail closed rather than silently accepting the payment.
      let payload = "";
      if (data.razorpay_subscription_id) {
        payload = data.razorpay_payment_id + "|" + data.razorpay_subscription_id;
      } else if (data.razorpay_order_id) {
        payload = data.razorpay_order_id + "|" + data.razorpay_payment_id;
      } else {
        return { success: false, error: "Missing payment identifiers for verification." };
      }

      const generated_signature = crypto.createHmac("sha256", secret).update(payload).digest("hex");

      if (generated_signature === data.razorpay_signature) {
        return { success: true };
      } else {
        return { success: false, error: "Invalid signature" };
      }
    } catch (error: any) {
      // Fail closed: a verification error must never be treated as success.
      console.warn("Razorpay verification failed:", error);
      return { success: false, error: "Payment verification failed." };
    }
  });

export const cancelRazorpaySubscriptionFn = createServerFn({ method: "POST" })
  .validator((data: { subscriptionId: string }) => data)
  .handler(async ({ data }) => {
    try {
      const razorpay = getRazorpay();
      if (!razorpay) {
        return isDemoKeys()
          ? { success: true, isDemo: true }
          : { success: false, error: "Razorpay is not configured." };
      }
      await razorpay.subscriptions.cancel(data.subscriptionId);
      return { success: true };
    } catch (error: any) {
      console.warn("Razorpay subscription cancel failed:", error);
      return { success: false, error: "Failed to cancel subscription. Please try again." };
    }
  });

// ---------------------------------------------------------------------------
// Stripe (International — secondary)
// ---------------------------------------------------------------------------

export const createStripeCheckoutSessionFn = createServerFn({ method: "POST" })
  .validator(
    (data: {
      planId: string;
      interval: "monthly" | "yearly";
      userId: string;
      email: string;
      name: string;
      origin: string;
      couponId?: string;
      trialDays?: number;
    }) => data,
  )
  .handler(async ({ data }) => {
    try {
      const stripe = getStripe();
      // Demo mode: only when NO gateway keys are configured at all. If some
      // gateway is configured but Stripe specifically isn't, fail closed.
      if (!stripe) {
        if (isDemoKeys()) {
          return { success: true, sessionId: `cs_demo_${Date.now()}`, isDemo: true };
        }
        return { success: false, error: "Stripe is not configured for this plan." };
      }

      // Stripe prices live in the Stripe dashboard; the env var follows the
      // same convention as Razorpay plans (STRIPE_PRICE_<PLAN>_<INTERVAL>).
      const envKey = `STRIPE_PRICE_${data.planId.toUpperCase()}_${data.interval.toUpperCase()}`;
      const priceId = process.env[envKey];
      if (!priceId) {
        return { success: false, error: "Stripe price is not configured for this plan." };
      }

      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        customer_email: data.email,
        metadata: {
          userId: data.userId,
          plan: data.planId,
          interval: data.interval,
          trialDays: String(data.trialDays ?? 0),
        },
        subscription_data: {
          trial_period_days: data.trialDays && data.trialDays > 0 ? data.trialDays : undefined,
        },
        discounts: data.couponId ? [{ coupon: data.couponId }] : undefined,
        success_url: `${data.origin}/dashboard/billing?session_id={CHECKOUT_SESSION_ID}&gateway=stripe`,
        cancel_url: `${data.origin}/dashboard/billing?gateway=stripe&canceled=1`,
        allow_promotion_codes: false,
      });

      return { success: true, sessionId: session.id, checkoutUrl: session.url };
    } catch (error: any) {
      // Fail closed when real keys are configured.
      console.warn("Stripe checkout session creation failed:", error);
      return { success: false, error: "Failed to create checkout session. Please try again." };
    }
  });

export const verifyStripeSessionFn = createServerFn({ method: "POST" })
  .validator(
    (data: { sessionId: string; userId: string; plan?: string; interval?: "monthly" | "yearly" }) =>
      data,
  )
  .handler(async ({ data }) => {
    try {
      const stripe = getStripe();
      if (!stripe) {
        // Demo mode — accept demo session ids so local testing still works.
        if (isDemoKeys() && data.sessionId.startsWith("cs_demo_")) {
          return { success: true, isDemo: true };
        }
        return { success: false, error: "Stripe is not configured." };
      }

      const session = await stripe.checkout.sessions.retrieve(data.sessionId);

      // Fail closed: only a fully-paid session may activate a subscription.
      if (session.payment_status !== "paid") {
        return { success: false, error: "Payment has not been completed." };
      }

      // Fail closed: the session must carry the requesting user's uid in its
      // metadata (set server-side at creation). A missing or mismatched uid
      // rejects the activation so a session can't be replayed across accounts.
      if (session.metadata?.userId !== data.userId) {
        return { success: false, error: "Session does not belong to this account." };
      }

      const subscriptionId =
        typeof session.subscription === "string" ? session.subscription : session.subscription?.id;

      return {
        success: true,
        plan: session.metadata?.plan || data.plan || "professional",
        interval:
          (session.metadata?.interval as "monthly" | "yearly") || data.interval || "monthly",
        subscriptionId: subscriptionId || null,
        amountTotal: session.amount_total || 0,
        currency: session.currency || "usd",
        trialDays: Number(session.metadata?.trialDays) || 0,
      };
    } catch (error: any) {
      console.warn("Stripe session verification failed:", error);
      return { success: false, error: "Failed to verify payment session. Please try again." };
    }
  });

export const cancelStripeSubscriptionFn = createServerFn({ method: "POST" })
  .validator((data: { subscriptionId: string }) => data)
  .handler(async ({ data }) => {
    try {
      const stripe = getStripe();
      if (!stripe) {
        return isDemoKeys()
          ? { success: true, isDemo: true }
          : { success: false, error: "Stripe is not configured." };
      }
      // Cancel at the end of the billing period by default (graceful).
      await stripe.subscriptions.update(data.subscriptionId, { cancel_at_period_end: true });
      return { success: true };
    } catch (error: any) {
      console.warn("Stripe subscription cancel failed:", error);
      return { success: false, error: "Failed to cancel subscription. Please try again." };
    }
  });

// ---------------------------------------------------------------------------
// Coupon validation (both gateways)
// ---------------------------------------------------------------------------

export const validateCouponFn = createServerFn({ method: "POST" })
  .validator((data: { gateway: "razorpay" | "stripe"; code: string }) => data)
  .handler(async ({ data }) => {
    const rawCode = (data.code || "").trim();
    if (!rawCode) return { valid: false, message: "Enter a coupon code." };

    try {
      if (data.gateway === "razorpay") {
        // Razorpay coupon codes are conventionally uppercase.
        const code = rawCode.toUpperCase();
        const razorpay = getRazorpay();
        if (!razorpay) {
          // Demo coupons so the flow is testable without live keys.
          const demo = ["WELCOME10", "FIRST20", "SAVE15"].includes(code);
          return demo
            ? {
                valid: true,
                code,
                percentOff: code === "FIRST20" ? 20 : code === "SAVE15" ? 15 : 10,
              }
            : { valid: false, message: "Invalid coupon code." };
        }
        const coupon: any = await (razorpay as any).coupons.fetch(code);
        if (!coupon || coupon.state === "expired") {
          return { valid: false, message: "Invalid or expired coupon code." };
        }
        return {
          valid: true,
          code: coupon.id,
          percentOff: coupon.percent_off || undefined,
          amountOff: coupon.amount_off || undefined,
        };
      }

      // Stripe coupon IDs are case-sensitive and conventionally lowercase —
      // try the exact input first, then the uppercased variant.
      const stripe = getStripe();
      if (!stripe) {
        const code = rawCode.toUpperCase();
        const demo = ["WELCOME10", "FIRST20", "SAVE15"].includes(code);
        return demo
          ? { valid: true, code, percentOff: code === "FIRST20" ? 20 : code === "SAVE15" ? 15 : 10 }
          : { valid: false, message: "Invalid coupon code." };
      }
      let coupon;
      try {
        coupon = await stripe.coupons.retrieve(rawCode);
      } catch {
        coupon = await stripe.coupons.retrieve(rawCode.toUpperCase());
      }
      if (!coupon || coupon.valid !== true) {
        return { valid: false, message: "Invalid or expired coupon code." };
      }
      return {
        valid: true,
        code: coupon.id,
        percentOff: coupon.percent_off || undefined,
        amountOff: coupon.amount_off || undefined,
      };
    } catch (error: any) {
      console.warn("Coupon validation failed:", error);
      return { valid: false, message: "Invalid coupon code." };
    }
  });
