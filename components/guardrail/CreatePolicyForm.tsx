'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function CreatePolicyForm() {
  const router = useRouter();
  const [name, setName] = useState('New draft policy');
  const [message, setMessage] = useState('');

  async function createPolicy(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    const response = await fetch('/api/policies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    const body = (await response.json().catch(() => null)) as { id?: string; error?: string } | null;
    if (!response.ok || !body?.id) {
      setMessage(body?.error ?? 'Unable to create policy');
      return;
    }
    router.push(`/policies/${body.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={createPolicy} className="guardrail-form">
      <label>
        New policy name
        <input value={name} onChange={(event) => setName(event.target.value)} />
      </label>
      <button type="submit">Create draft policy</button>
      {message ? <p className="guardrail-error">{message}</p> : null}
    </form>
  );
}
