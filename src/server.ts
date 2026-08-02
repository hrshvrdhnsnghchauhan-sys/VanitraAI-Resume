import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

import crypto from "crypto";

// Lazy-loaded Stripe instance (server-side only).
let stripeInstance: any = null;
let stripeModulePromise: Promise<any> | undefined;
async function getStripe(): Promise<any> {
  const secretKey = process.env.STRIPE_SECRET_KEY || "";
  if (!secretKey || secretKey.includes("placeholder")) return null;
  if (!stripeInstance) {
    if (!stripeModulePromise) {
      // Dynamic import keeps the Node-only dependency out of any client path.
      stripeModulePromise = import("stripe").then((m) => m.default ?? m);
    }
    const Stripe = await stripeModulePromise;
    stripeInstance = new Stripe(secretKey);
  }
  return stripeInstance;
}

async function handleStripeWebhook(request: Request): Promise<Response> {
  try {
    const secret = process.env.STRIPE_WEBHOOK_SECRET || "";
    const signature = request.headers.get("stripe-signature");

    if (!signature) {
      return new Response("Missing signature", { status: 400 });
    }

    const bodyText = await request.text();
    const stripe = await getStripe();
    if (!stripe || !secret) {
      // Signature cannot be verified — fail closed, never treat as success.
      return new Response("Webhook not configured", { status: 400 });
    }

    let event: any;
    try {
      event = stripe.webhooks.constructEvent(bodyText, signature, secret);
    } catch (err: any) {
      console.warn("Stripe webhook signature verification failed:", err?.message || err);
      return new Response("Invalid signature", { status: 400 });
    }

    console.log("Stripe webhook received:", event.type);

    // Payment fulfillment is handled on the success_url return flow (the
    // client verifies the session server-side and writes Firestore as the
    // authenticated owner). Webhooks are verified + logged here for audit and
    // can be extended to write via Firebase Admin when a service account is
    // configured in the console.
    switch (event.type) {
      case "checkout.session.completed":
      case "invoice.paid":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        // Logged above; extension point for admin-sdk writes.
        break;
      default:
        break;
    }

    return new Response(JSON.stringify({ status: "ok" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (err) {
    console.error("Stripe webhook processing failed:", err);
    return new Response("Internal Server Error", { status: 500 });
  }
}

async function handleRazorpayWebhook(request: Request): Promise<Response> {
  try {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET || "";
    const signature = request.headers.get("x-razorpay-signature");

    if (!signature) {
      return new Response("Missing signature", { status: 400 });
    }

    const bodyText = await request.text();

    const expectedSignature = crypto.createHmac("sha256", secret).update(bodyText).digest("hex");

    if (expectedSignature !== signature) {
      return new Response("Invalid signature", { status: 400 });
    }

    const event = JSON.parse(bodyText);
    console.log("Webhook received:", event.event);

    return new Response(JSON.stringify({ status: "ok" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (err) {
    console.error("Webhook processing failed:", err);
    return new Response("Internal Server Error", { status: 500 });
  }
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const url = new URL(request.url);
      if (url.pathname === "/api/webhooks/razorpay" && request.method === "POST") {
        return await handleRazorpayWebhook(request);
      }
      if (url.pathname === "/api/webhooks/stripe" && request.method === "POST") {
        return await handleStripeWebhook(request);
      }

      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
