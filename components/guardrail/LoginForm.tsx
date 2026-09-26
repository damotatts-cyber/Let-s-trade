'use client';

import { useState } from 'react';

import { DEMO_ADMIN_EMAIL, DEMO_TENANT_SLUG } from '@/lib/guardrail/defaults';

export default function LoginForm() {
  const [tenantSlug, setTenantSlug] = useState(DEMO_TENANT_SLUG);
  const [email, setEmail] = useState(DEMO_ADMIN_EMAIL);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError('');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantSlug, email }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? 'Login failed');
        return;
      }

      window.location.href = '/dashboard';
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="guardrail-card guardrail-form">
      <div>
        <h1 style={{ marginBottom: '0.5rem' }}>Guardrail Gate admin login</h1>
        <p className="guardrail-muted" style={{ marginTop: 0 }}>
          Local mock auth is enabled when Clerk credentials are absent. Use the seeded tenant to inspect policies, the review queue,
          and audit logs.
        </p>
      </div>
      <label>
        Tenant slug
        <input value={tenantSlug} onChange={(event) => setTenantSlug(event.target.value)} name="tenantSlug" required />
      </label>
      <label>
        Email
        <input value={email} onChange={(event) => setEmail(event.target.value)} name="email" type="email" required />
      </label>
      <button type="submit" disabled={pending}>
        {pending ? 'Signing in…' : 'Open admin console'}
      </button>
      {error ? <p className="guardrail-error">{error}</p> : null}
    </form>
  );
}
