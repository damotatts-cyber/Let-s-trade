'use client';

import { useState } from 'react';

export default function ReviewForm({ requestId }: { requestId: string }) {
  const [reason, setReason] = useState('Confirmed decision and noted downstream remediation path.');
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);

  async function submitReview(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage('');

    try {
      const response = await fetch(`/api/requests/${requestId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        setMessage(body?.error ?? 'Unable to record review');
        return;
      }
      setMessage('Review captured without altering the original decision. Reloading…');
      window.location.reload();
    } catch {
      setMessage('Network error while recording review');
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submitReview} className="guardrail-form">
      <label>
        Review reason
        <textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={4} required />
      </label>
      <button type="submit" disabled={pending}>{pending ? 'Saving…' : 'Record human review'}</button>
      {message ? <p className="guardrail-muted">{message}</p> : null}
    </form>
  );
}
