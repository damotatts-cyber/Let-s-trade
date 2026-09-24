'use client';

import { useState } from 'react';
import BalanceDisplay from '@/components/BalanceDisplay';
import { DIT_Bridge } from '@/lib/ditBridge';
import { useTokenBalance } from '@/lib/useTokenBalance';

export default function InstantExchange() {
  const { balance } = useTokenBalance();
  const [message, setMessage] = useState('');

  const handleInstantCashOut = async (amount: number, coin: string) => {
    const transaction = await DIT_Bridge.execute({
      amount,
      from: coin,
      to: 'USD_REAL_MONEY',
      destination: 'USER_DEBIT_CARD',
      instant: true,
    });

    if (transaction.success) {
      setMessage('Money is in your bank account now.');
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        padding: '1.5rem',
        borderRadius: '1rem',
        background: '#18181b',
      }}
    >
      <h2 style={{ margin: 0 }}>Your Assets</h2>
      <BalanceDisplay value={balance.total} />
      <button
        type="button"
        onClick={() => handleInstantCashOut(balance.total, 'ALL')}
        style={{
          border: 0,
          padding: '0.9rem 1rem',
          borderRadius: '9999px',
          fontWeight: 700,
          background: '#22c55e',
          color: '#000',
          cursor: 'pointer',
        }}
      >
        FLIP TO CASH INSTANTLY
      </button>
      {message && <p style={{ margin: 0 }}>{message}</p>}
    </div>
  );
}
