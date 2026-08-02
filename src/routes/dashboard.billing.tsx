import { useState, useEffect, useRef } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { PageHeader, DashCard } from "@/components/dashboard/ui";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Check,
  Download,
  CreditCard,
  AlertCircle,
  Loader2,
  BadgePercent,
  Globe,
  IndianRupee,
  Sparkles,
  X,
} from "lucide-react";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  setDoc,
  orderBy,
} from "firebase/firestore";
import { db } from "@/services/firebase";
import { useAuth } from "@/lib/auth";
import {
  createRazorpaySubscriptionFn,
  verifyRazorpaySignatureFn,
  cancelRazorpaySubscriptionFn,
  createStripeCheckoutSessionFn,
  verifyStripeSessionFn,
  cancelStripeSubscriptionFn,
  validateCouponFn,
} from "@/server/payment";
import { loadRazorpayScript, openRazorpayCheckout } from "@/lib/razorpay";
import { generateInvoicePDF } from "@/lib/invoice";
import {
  PLANS,
  TRIAL_DAYS,
  detectGateway,
  getStoredGateway,
  setStoredGateway,
  planPrice,
  planCurrency,
  type PaymentGateway,
  type BillingInterval,
  type CouponResult,
} from "@/lib/payments";

export const Route = createFileRoute("/dashboard/billing")({
  component: BillingPage,
});

const INR_GST_RATE = 18; // Indian GST on SaaS subscriptions

function formatMoney(amount: number, gateway: PaymentGateway) {
  const currency = planCurrency(gateway);
  if (currency === "INR") return `₹${amount.toLocaleString("en-IN")}`;
  return `$${amount.toFixed(2)}`;
}

function BillingPage() {
  const { user } = useAuth();
  // Auto-detect: Indian users → Razorpay, international → Stripe. The manual
  // toggle below lets anyone override the detected choice.
  const [gateway, setGateway] = useState<PaymentGateway>(
    () => getStoredGateway() ?? detectGateway(),
  );
  const [isYearly, setIsYearly] = useState(false);
  const [trialEnabled, setTrialEnabled] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeSubscription, setActiveSubscription] = useState<any>(null);
  const [paymentHistory, setPaymentHistory] = useState<any[]>([]);
  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<CouponResult | null>(null);
  const [validatingCoupon, setValidatingCoupon] = useState(false);
  const [verifyingReturn, setVerifyingReturn] = useState(false);
  const stripeReturnHandled = useRef(false);

  const switchGateway = (g: PaymentGateway) => {
    setGateway(g);
    setStoredGateway(g);
    // A coupon validated against one gateway isn't guaranteed on the other.
    setAppliedCoupon(null);
    setCouponInput("");
  };

  // trialDays is passed explicitly (never read from state) so the Stripe
  // return flow — which runs on a freshly remounted page after the hosted
  // checkout redirect — records the trial exactly as it was configured at
  // checkout time, not the remount-time default.
  const writeSubscriptionRecords = async (
    planId: string,
    interval: BillingInterval,
    gateway: PaymentGateway,
    paymentId: string,
    gatewaySubscriptionId: string | null | undefined,
    status: "active" | "cancelled",
    amount: number,
    trialDays: number,
  ) => {
    const now = new Date();
    const expiryDate = new Date(now);
    if (trialDays > 0) {
      expiryDate.setDate(expiryDate.getDate() + trialDays);
    }
    expiryDate.setMonth(expiryDate.getMonth() + (interval === "yearly" ? 12 : 1));

    const subData = {
      userId: user!.uid,
      plan: planId,
      interval,
      gateway,
      status,
      expiryDate: expiryDate.toISOString(),
      autoRenew: status === "active",
      trialDays,
      updatedAt: now.toISOString(),
      ...(gateway === "razorpay" ? { razorpaySubscriptionId: gatewaySubscriptionId } : {}),
      ...(gateway === "stripe" ? { stripeSubscriptionId: gatewaySubscriptionId } : {}),
    };
    const paymentData = {
      userId: user!.uid,
      plan: planId,
      interval,
      gateway,
      amount,
      currency: planCurrency(gateway),
      gstRate: gateway === "razorpay" ? INR_GST_RATE : undefined,
      paymentId,
      status: "success",
      timestamp: now.toISOString(),
      method: gateway,
    };

    try {
      if (db) {
        await setDoc(doc(db, "subscriptions", user!.uid), subData);
        await setDoc(doc(db, "payments", paymentId), paymentData);
        await setDoc(doc(db, "transactions", paymentId), paymentData);
        await setDoc(doc(db, "billingHistory", paymentId), paymentData);
        await setDoc(doc(db, "paymentLogs", paymentId), paymentData);
      }
    } catch (err) {
      console.warn("Cloud subscription save fallback:", err);
    }
    localStorage.setItem(`subscription_${user!.uid}`, JSON.stringify(subData));
    setActiveSubscription(subData);
    setPaymentHistory((prev) => [paymentData, ...prev]);
  };

  // ------------------------------------------------------------------
  // Stripe hosted-checkout return flow: the user is redirected back to
  // /dashboard/billing?session_id=...&gateway=stripe after payment.
  // The session is verified server-side (never trust the URL alone).
  // ------------------------------------------------------------------
  useEffect(() => {
    if (!user?.uid) return;
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("session_id");
    const gatewayParam = params.get("gateway");
    const canceled = params.get("canceled");

    if (canceled) {
      toast.info("Payment was cancelled — no charge was made.");
      window.history.replaceState({}, "", "/dashboard/billing");
    }

    if (sessionId && gatewayParam === "stripe" && !stripeReturnHandled.current) {
      stripeReturnHandled.current = true;
      setVerifyingReturn(true);
      verifyStripeSessionFn({ data: { sessionId, userId: user.uid } })
        .then(async (res) => {
          if (res.success) {
            const plan = PLANS.find((p) => p.id === res.plan) ?? PLANS[1];
            const interval = res.interval ?? "monthly";
            const amount = (res.amountTotal ?? 0) / 100;
            await writeSubscriptionRecords(
              plan.id,
              interval,
              "stripe",
              `pay_${sessionId}`,
              res.subscriptionId,
              "active",
              amount > 0 ? amount : planPrice(plan, "stripe", interval),
              res.trialDays ?? 0,
            );
            // Only clear the session id on success so a transient failure keeps
            // the URL and a refresh can retry verification.
            window.history.replaceState({}, "", "/dashboard/billing");
            toast.success("Payment successful! Subscription activated.");
          } else {
            toast.error(res.error || "Payment verification failed.");
          }
        })
        .catch(() => toast.error("Failed to verify payment. Please contact support."))
        .finally(() => setVerifyingReturn(false));
    }
    // writeSubscriptionRecords is intentionally stable-in-behavior here (it
    // only depends on user.uid and setState fns); re-running the verification
    // is guarded by the stripeReturnHandled ref, so we key only on user.uid.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) return;
    const localSub = localStorage.getItem(`subscription_${user.uid}`);
    if (localSub) {
      try {
        setActiveSubscription(JSON.parse(localSub));
      } catch (e) {
        // Corrupt local cache — ignore and let the cloud fetch decide.
      }
    }
    if (!db) return;
    const fetchData = async () => {
      try {
        const subDoc = await getDoc(doc(db!, "subscriptions", user.uid));
        if (subDoc.exists()) {
          setActiveSubscription(subDoc.data());
          localStorage.setItem(`subscription_${user.uid}`, JSON.stringify(subDoc.data()));
        }

        const paymentsQuery = query(
          collection(db!, "payments"),
          where("userId", "==", user.uid),
          orderBy("timestamp", "desc"),
        );
        const paymentsSnap = await getDocs(paymentsQuery);
        const history = paymentsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setPaymentHistory(history);
      } catch (err) {
        console.warn("Failed to load billing from cloud, using local fallback:", err);
      }
    };
    fetchData();
  }, [user]);

  const applyCoupon = async () => {
    const code = couponInput.trim();
    if (!code) return;
    setValidatingCoupon(true);
    try {
      const res = await validateCouponFn({ data: { gateway, code } });
      if (res.valid) {
        setAppliedCoupon(res);
        toast.success(`Coupon applied${res.percentOff ? ` — ${res.percentOff}% off` : ""}!`);
      } else {
        setAppliedCoupon(null);
        toast.error(res.message || "Invalid coupon code.");
      }
    } catch {
      toast.error("Could not validate coupon right now.");
    } finally {
      setValidatingCoupon(false);
    }
  };

  const cancelExistingGatewaySubscription = async () => {
    const sub = activeSubscription;
    if (!sub?.status) return;
    if (sub.gateway === "razorpay" && sub.razorpaySubscriptionId) {
      await cancelRazorpaySubscriptionFn({
        data: { subscriptionId: sub.razorpaySubscriptionId },
      }).catch(() => {});
    } else if (sub.gateway === "stripe" && sub.stripeSubscriptionId) {
      await cancelStripeSubscriptionFn({
        data: { subscriptionId: sub.stripeSubscriptionId },
      }).catch(() => {});
    }
  };

  const handleSubscribe = async (plan: (typeof PLANS)[0]) => {
    if (!user) return toast.error("Please login first");
    setIsProcessing(true);

    const interval: BillingInterval = isYearly ? "yearly" : "monthly";
    const amount = planPrice(plan, gateway, interval);
    const planId = `${plan.id}_${interval}`;
    const trialDays = trialEnabled ? TRIAL_DAYS : 0;

    try {
      // Upgrade/downgrade: cancel the existing gateway subscription first so
      // the customer is never double-billed across plans OR across billing
      // intervals (monthly → yearly on the same plan must cancel too).
      if (
        activeSubscription?.status === "active" &&
        (activeSubscription.plan !== plan.id || activeSubscription.interval !== interval)
      ) {
        await cancelExistingGatewaySubscription();
      }

      // ---- Stripe (international) --------------------------------------
      if (gateway === "stripe") {
        const res = await createStripeCheckoutSessionFn({
          data: {
            planId: plan.id,
            interval,
            userId: user.uid,
            email: user.email,
            name: user.name,
            origin: window.location.origin,
            couponId: appliedCoupon?.code,
            trialDays,
          },
        });

        if (!res.success) {
          toast.error(res.error || "Failed to create checkout session.");
          setIsProcessing(false);
          return;
        }

        if (res.isDemo) {
          // Demo mode — no Stripe keys configured. Simulate activation.
          await writeSubscriptionRecords(
            plan.id,
            interval,
            "stripe",
            `pay_demo_${Date.now()}`,
            `sub_demo_${Date.now()}`,
            "active",
            amount,
            trialDays,
          );
          toast.success(`Demo Mode: Upgraded to ${plan.name} Plan successfully!`);
          setIsProcessing(false);
          return;
        }

        // Hosted Checkout redirect — Stripe handles cards/UPI/wallets.
        if (res.checkoutUrl) {
          window.location.href = res.checkoutUrl;
        } else {
          toast.error("Checkout URL missing. Please try again.");
          setIsProcessing(false);
        }
        return;
      }

      // ---- Razorpay (India) --------------------------------------------
      const subResponse = await createRazorpaySubscriptionFn({
        data: {
          planId,
          couponId: appliedCoupon?.code,
          trialDays,
        },
      });

      if (!subResponse.success) {
        toast.error(subResponse.error || "Failed to create subscription.");
        setIsProcessing(false);
        return;
      }

      if (subResponse.isDemo) {
        await writeSubscriptionRecords(
          plan.id,
          interval,
          "razorpay",
          `pay_demo_${Date.now()}`,
          `sub_demo_${Date.now()}`,
          "active",
          amount,
          trialDays,
        );
        toast.success(`Demo Mode: Upgraded to ${plan.name} Plan successfully!`);
        setIsProcessing(false);
        return;
      }

      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        toast.error("Payment gateway failed to load. Please try again.");
        setIsProcessing(false);
        return;
      }

      openRazorpayCheckout({
        key: import.meta.env.VITE_RAZORPAY_KEY_ID || "",
        name: "Vanitra AI Resume",
        description: `${plan.name} Plan (${isYearly ? "Yearly" : "Monthly"})`,
        subscription_id: subResponse.subscriptionId!,
        prefill: {
          name: user.name,
          email: user.email,
        },
        theme: {
          color: "#3F64FF",
        },
        modal: {
          ondismiss: () => {
            toast.info("Payment cancelled");
            setIsProcessing(false);
          },
        },
        handler: async function (response: any) {
          try {
            toast.loading("Verifying subscription...");
            const verifyRes = await verifyRazorpaySignatureFn({
              data: {
                razorpay_subscription_id: response.razorpay_subscription_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              },
            });

            if (verifyRes.success) {
              await writeSubscriptionRecords(
                plan.id,
                interval,
                "razorpay",
                response.razorpay_payment_id,
                response.razorpay_subscription_id,
                "active",
                amount,
                trialDays,
              );
              toast.dismiss();
              toast.success("Payment successful! Subscription activated.");
            } else {
              toast.dismiss();
              toast.error("Payment verification failed.");
            }
          } catch (err) {
            toast.dismiss();
            toast.error("An error occurred during verification.");
            console.error(err);
          } finally {
            setIsProcessing(false);
          }
        },
      });
    } catch (error) {
      console.error(error);
      toast.error("An unexpected error occurred");
      setIsProcessing(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!user) return;
    setIsProcessing(true);
    try {
      await cancelExistingGatewaySubscription();
      const subData = {
        ...activeSubscription,
        autoRenew: false,
        status: "cancelled",
        updatedAt: new Date().toISOString(),
      };
      if (db) {
        await setDoc(doc(db!, "subscriptions", user.uid), subData, { merge: true });
      }
      localStorage.setItem(`subscription_${user.uid}`, JSON.stringify(subData));
      setActiveSubscription(subData);
      toast.success("Subscription cancelled successfully.");
    } catch (e) {
      toast.error("Failed to cancel subscription.");
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadInvoice = (payment: any) => {
    generateInvoicePDF({
      invoiceNumber: payment.paymentId || payment.id,
      date: payment.timestamp,
      customerName: user?.name || "Customer",
      customerEmail: user?.email || "",
      planName: PLANS.find((p) => p.id === payment.plan)?.name || payment.plan,
      amount: payment.amount,
      currency: payment.currency,
      gstRate: payment.currency === "INR" ? INR_GST_RATE : undefined,
    });
  };

  const activePlan = PLANS.find((p) => p.id === activeSubscription?.plan);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Billing & Subscription"
        description="Choose your payment method, manage plans, coupons and invoices."
      />

      {/* Payment method (gateway) selector */}
      <DashCard title="Payment Method">
        <div className="mb-1 flex items-center gap-2 text-sm text-muted-foreground">
          <Sparkles className="h-4 w-4 text-primary" />
          Recommended gateway chosen automatically from your region — you can switch anytime.
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => switchGateway("razorpay")}
            className={`flex items-start gap-3 rounded-xl border p-4 text-left transition-all ${
              gateway === "razorpay"
                ? "border-primary bg-accent/50 ring-2 ring-primary/30"
                : "border-border hover:border-primary/40"
            }`}
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-primary text-primary-foreground">
              <IndianRupee className="h-5 w-5" />
            </span>
            <span className="flex-1">
              <span className="flex items-center gap-2 font-semibold">
                Razorpay
                <Badge className="bg-primary/10 text-primary hover:bg-primary/20">India</Badge>
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                UPI, cards, netbanking & wallets — ₹ INR pricing, GST invoice.
              </span>
            </span>
            {gateway === "razorpay" && <Check className="h-5 w-5 text-primary" />}
          </button>

          <button
            type="button"
            onClick={() => switchGateway("stripe")}
            className={`flex items-start gap-3 rounded-xl border p-4 text-left transition-all ${
              gateway === "stripe"
                ? "border-primary bg-accent/50 ring-2 ring-primary/30"
                : "border-border hover:border-primary/40"
            }`}
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-primary text-primary-foreground">
              <Globe className="h-5 w-5" />
            </span>
            <span className="flex-1">
              <span className="flex items-center gap-2 font-semibold">
                Stripe
                <Badge className="bg-primary/10 text-primary hover:bg-primary/20">
                  International
                </Badge>
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                Cards, Apple/Google Pay & wallets — $ USD pricing worldwide.
              </span>
            </span>
            {gateway === "stripe" && <Check className="h-5 w-5 text-primary" />}
          </button>
        </div>

        {/* Trial + coupon */}
        <div className="mt-5 flex flex-col gap-4 border-t border-border pt-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-center gap-3">
            <Switch id="trial" checked={trialEnabled} onCheckedChange={setTrialEnabled} />
            <div>
              <Label htmlFor="trial" className="cursor-pointer">
                {TRIAL_DAYS}-day free trial
              </Label>
              <p className="text-xs text-muted-foreground">First charge happens after the trial.</p>
            </div>
          </div>

          <div className="flex w-full gap-2 sm:w-auto">
            <div className="relative flex-1 sm:w-56">
              <BadgePercent className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={couponInput}
                onChange={(e) => setCouponInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), applyCoupon())}
                placeholder="Coupon code"
                className="pl-9"
              />
            </div>
            <Button
              variant="outline"
              onClick={applyCoupon}
              disabled={validatingCoupon || !couponInput.trim()}
            >
              {validatingCoupon ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply"}
            </Button>
          </div>
        </div>

        {appliedCoupon && (
          <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-success/30 bg-success/10 px-3 py-1 text-sm font-medium text-success">
            <BadgePercent className="h-4 w-4" />
            {appliedCoupon.code}
            {appliedCoupon.percentOff ? ` — ${appliedCoupon.percentOff}% off` : ""}
            {appliedCoupon.amountOff
              ? ` — ${formatMoney((appliedCoupon.amountOff ?? 0) / 100, gateway)} off`
              : ""}
            <button
              onClick={() => {
                setAppliedCoupon(null);
                setCouponInput("");
              }}
              className="ml-1 text-success/70 hover:text-success"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </DashCard>

      {verifyingReturn && (
        <DashCard className="p-10 text-center text-muted-foreground">
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
          <p className="mt-3 text-sm">Verifying your payment…</p>
        </DashCard>
      )}

      {/* Current Plan Section */}
      <DashCard title="Current Subscription">
        {activeSubscription && activeSubscription.status === "active" ? (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between rounded-xl border border-border p-6 bg-card/50">
            <div>
              <h3 className="text-xl font-bold capitalize text-primary-foreground">
                {activeSubscription.plan} Plan
                <span className="ml-2 text-xs font-medium normal-case text-muted-foreground">
                  via {activeSubscription.gateway === "stripe" ? "Stripe" : "Razorpay"}
                </span>
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                {activeSubscription.trialDays
                  ? `${activeSubscription.trialDays}-day free trial active — `
                  : ""}
                {activeSubscription.expiryDate
                  ? `Billing starts ${new Date(activeSubscription.expiryDate).toLocaleDateString()}`
                  : "Active"}
              </p>
              {activeSubscription.autoRenew ? (
                <span className="inline-flex items-center gap-1 mt-3 px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                  <Check className="h-3 w-3" /> Auto-renews
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 mt-3 px-2.5 py-0.5 rounded-full text-xs font-medium bg-destructive/10 text-destructive">
                  <AlertCircle className="h-3 w-3" /> Cancelled
                </span>
              )}
            </div>
            <div className="mt-4 sm:mt-0 flex gap-3">
              {activeSubscription.autoRenew ? (
                <Button
                  variant="outline"
                  onClick={handleCancelSubscription}
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Cancel Subscription"
                  )}
                </Button>
              ) : (
                activePlan && (
                  <Button
                    variant="outline"
                    onClick={() => handleSubscribe(activePlan)}
                    disabled={isProcessing}
                  >
                    Renew
                  </Button>
                )
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-border p-6 bg-card/50 flex items-center gap-4">
            <div className="p-3 bg-muted rounded-full">
              <CreditCard className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium">Free Plan</p>
              <p className="text-sm text-muted-foreground">Upgrade to unlock premium features.</p>
            </div>
          </div>
        )}
      </DashCard>

      {/* Pricing Plans */}
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-xl font-bold">Upgrade Plan</h2>
          <div className="flex items-center gap-2">
            <Label>Monthly</Label>
            <Switch checked={isYearly} onCheckedChange={setIsYearly} />
            <Label>
              Yearly <span className="text-primary text-xs font-semibold ml-1">Save 20%</span>
            </Label>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {PLANS.map((plan) => {
            const isActive =
              activeSubscription?.plan === plan.id && activeSubscription?.status === "active";
            const price = planPrice(plan, gateway, isYearly ? "yearly" : "monthly");
            let effective = price;
            if (appliedCoupon?.percentOff)
              effective = Math.round(price * (1 - appliedCoupon.percentOff / 100));
            else if (appliedCoupon?.amountOff)
              // Stripe/Razorpay report amount_off in minor units (cents/paise) —
              // convert to the major unit used by plan prices for display only.
              effective = Math.max(0, price - (appliedCoupon.amountOff ?? 0) / 100);
            const discounted = effective !== price;

            return (
              <DashCard
                key={plan.id}
                className={`relative flex flex-col ${isActive ? "border-primary shadow-lg shadow-primary/10" : ""}`}
              >
                {isActive && (
                  <div className="absolute top-0 right-0 transform translate-x-2 -translate-y-2">
                    <span className="bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full">
                      Current
                    </span>
                  </div>
                )}
                <div className="mb-4">
                  <h3 className="text-lg font-bold">{plan.name}</h3>
                  <div className="mt-2 flex items-baseline gap-1">
                    {discounted && (
                      <span className="text-lg font-medium text-muted-foreground line-through">
                        {formatMoney(price, gateway)}
                      </span>
                    )}
                    <span className="text-3xl font-extrabold">
                      {formatMoney(discounted ? effective : price, gateway)}
                    </span>
                    <span className="text-muted-foreground text-sm">/{isYearly ? "yr" : "mo"}</span>
                  </div>
                  {trialEnabled && (
                    <span className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary">
                      <Sparkles className="h-3 w-3" /> Try free for {TRIAL_DAYS} days
                    </span>
                  )}
                </div>
                <ul className="space-y-3 mb-8 flex-1">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-center gap-3 text-sm text-muted-foreground">
                      <Check className="h-4 w-4 text-primary" /> {feature}
                    </li>
                  ))}
                </ul>
                <Button
                  variant={isActive ? "outline" : "hero"}
                  className="w-full"
                  disabled={isProcessing || isActive}
                  onClick={() => handleSubscribe(plan)}
                >
                  {isProcessing ? "Processing..." : isActive ? "Current Plan" : "Upgrade"}
                </Button>
              </DashCard>
            );
          })}
        </div>
      </div>

      {/* Payment History */}
      <DashCard title="Payment History">
        {paymentHistory.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No payment history found.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/50 rounded-t-lg">
                <tr>
                  <th className="px-4 py-3 rounded-tl-lg">Invoice</th>
                  <th className="px-4 py-3">Plan</th>
                  <th className="px-4 py-3">Method</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right rounded-tr-lg">Action</th>
                </tr>
              </thead>
              <tbody>
                {paymentHistory.map((payment) => (
                  <tr key={payment.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 font-medium">
                      {(payment.paymentId || payment.id || "").slice(0, 12)}...
                    </td>
                    <td className="px-4 py-3 capitalize">{payment.plan}</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="capitalize">
                        {payment.gateway || payment.method || "—"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      {payment.currency === "USD"
                        ? `$${(payment.amount || 0).toFixed(2)}`
                        : `₹${(payment.amount || 0).toLocaleString("en-IN")}`}
                      {payment.currency === "INR" && (
                        <span className="text-xs text-muted-foreground"> (incl. GST)</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {payment.timestamp
                        ? new Date(payment.timestamp).toLocaleDateString()
                        : "Recently"}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-500">
                        {payment.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" size="sm" onClick={() => downloadInvoice(payment)}>
                        <Download className="h-4 w-4 mr-2" /> PDF
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DashCard>
    </div>
  );
}
