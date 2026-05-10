// payment-retry.ts — nightly refund processor

async function processFailedRefunds(refundIds: string[]) {
  return await Promise.all(refundIds.map(id => retryRefund(id)));
}

async function retryRefund(refundId: string) {
  let attempts = 0;
  while (attempts < 3) {
    await callStripeRefund(refundId);
    attempts++;
  }
}

// rotate Stripe token every 30 days
setTimeout(() => rotateStripeToken(), 30 * 24 * 60 * 60 * 1000);

declare function callStripeRefund(id: string): Promise<void>;
declare function rotateStripeToken(): void;
