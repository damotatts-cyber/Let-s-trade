import Link from 'next/link';

import AdminShell from '@/components/guardrail/AdminShell';
import CreatePolicyForm from '@/components/guardrail/CreatePolicyForm';
import { requireAdminSession } from '@/lib/guardrail/auth';
import { getGuardrailRepository } from '@/lib/guardrail/repository';

export default async function DashboardPage() {
  const { tenant } = await requireAdminSession();
  const repository = getGuardrailRepository();
  const summary = await repository.getDashboardSummary(tenant.tenantId);

  return (
    <AdminShell title="Dashboard" subtitle={`Tenant ${summary.tenant.tenantSlug} · existing Let-s-trade flows remain untouched while Guardrail Gate runs alongside them.`}>
      <section className="guardrail-metric-grid">
        <article className="guardrail-metric"><strong>Blocked</strong><span>{summary.blockedCount}</span></article>
        <article className="guardrail-metric"><strong>Redacted</strong><span>{summary.redactedCount}</span></article>
        <article className="guardrail-metric"><strong>Pending review</strong><span>{summary.pendingReviews}</span></article>
      </section>

      <section className="guardrail-grid">
        <article className="guardrail-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start' }}>
            <div>
              <h2 style={{ marginTop: 0 }}>Policies</h2>
              <p className="guardrail-muted">Draft, publish, and test policy behavior without adding a bypass path.</p>
            </div>
          </div>
          {summary.policies.length === 0 ? (
            <p className="guardrail-muted">No tenant policies exist yet.</p>
          ) : (
            <ul className="guardrail-list">
              {summary.policies.map((policy) => (
                <li key={policy.id}>
                  <Link href={`/policies/${policy.id}`}>{policy.name}</Link>
                  <span>{policy.status}</span>
                  <span>v{policy.version}</span>
                </li>
              ))}
            </ul>
          )}
          <CreatePolicyForm />
        </article>

        <article className="guardrail-card">
          <h2 style={{ marginTop: 0 }}>Review queue</h2>
          {summary.recentRequests.length === 0 ? (
            <p className="guardrail-muted">No gateway decisions yet. Use the policy test action or call the proxy endpoint.</p>
          ) : (
            <ul className="guardrail-list">
              {summary.recentRequests.map((request) => (
                <li key={request.id}>
                  <Link href={`/requests/${request.id}`}>{request.requestId}</Link>
                  <span>{request.decision}</span>
                  <span>risk {request.riskScore.toFixed(2)}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="guardrail-muted" style={{ marginBottom: 0 }}>
            Review entries preserve the original decision and create an immutable audit trail instead of overriding safety rules.
          </p>
        </article>
      </section>
    </AdminShell>
  );
}
