'use client';

import { useTransition } from 'react';

export default function GlobalShipper() {
  const [isPending, startTransition] = useTransition();

  const shipMoney = (formData: FormData) => {
    startTransition(async () => {
      await fetch('/api/bridge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone: formData.get('phone'),
          amount: formData.get('amount'),
          asset: 'BTC_TO_CASH',
        }),
      });
    });
  };

  return (
    <form action={shipMoney} style={{ padding: '1rem', background: '#27272a', borderRadius: '0.75rem' }}>
      <input name="phone" placeholder="+1 Phone Number" style={{ width: '100%', marginBottom: '0.5rem', padding: '0.5rem' }} />
      <input name="amount" placeholder="Amount to Ship" style={{ width: '100%', marginBottom: '0.5rem', padding: '0.5rem' }} />
      <button
        type="submit"
        disabled={isPending}
        style={{ width: '100%', padding: '0.75rem', border: 0, borderRadius: '0.5rem', fontWeight: 700 }}
      >
        {isPending ? 'SHIPPING AT SPEED...' : 'SHIP CASH INSTANTLY'}
      </button>
    </form>
  );
}
