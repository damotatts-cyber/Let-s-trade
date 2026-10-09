import Link from 'next/link';
import type { ReactNode } from 'react';

export default function AdminShell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <main className="guardrail-shell">
      <header className="guardrail-card" style={{ display: 'grid', gap: '0.75rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div>
            <p className="guardrail-kicker">Guardrail Gate</p>
            <h1 style={{ margin: '0.25rem 0' }}>{title}</h1>
            <p className="guardrail-muted" style={{ margin: 0 }}>{subtitle}</p>
          </div>
          <nav className="guardrail-nav">
            <Link href="/dashboard">Dashboard</Link>
            <Link href="/audit">Audit</Link>
            <Link href="/login">Login</Link>
          </nav>
        </div>
      </header>
      {children}
    </main>
  );
}
