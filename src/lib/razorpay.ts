export const loadRazorpayScript = () => {
  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => {
      resolve(true);
    };
    script.onerror = () => {
      resolve(false);
    };
    document.body.appendChild(script);
  });
};

export interface RazorpayOptions {
  key: string;
  amount?: number;
  currency?: string;
  name: string;
  description: string;
  order_id?: string;
  subscription_id?: string;
  handler: (response: {
    razorpay_payment_id: string;
    razorpay_order_id?: string;
    razorpay_signature: string;
    razorpay_subscription_id?: string;
  }) => void;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  theme?: {
    color?: string;
  };
  modal?: {
    ondismiss?: () => void;
  };
}

export const openRazorpayCheckout = (options: RazorpayOptions) => {
  const rzp = new (window as any).Razorpay(options);

  rzp.on("payment.failed", function (response: any) {
    console.error("Payment failed", response.error);
    if (options.modal?.ondismiss) {
      options.modal.ondismiss();
    }
  });

  rzp.open();
};
