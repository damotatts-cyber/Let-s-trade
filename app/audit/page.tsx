import AdminShell from '@/components/guardrail/AdminShell';
import { requireAdminSession } from '@/lib/guardrail/auth';
import { getGuardrailRepository } from '@/lib/guardrail/repository';

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ eventType?: string }> }) {
  const { tenant } = await requireAdminSession();
  const { eventType } = await searchParams;
  const repository = getGuardrailRepository();
  const events = await repository.listAudit(tenant.tenantId, eventType);

  return (
    <AdminShell title="Audit" subtitle="Every decision, matched rule, policy change, and human review writes an immutable audit event.">
      <section className="guardrail-card" style={{ display: 'grid', gap: '1rem' }}>
        <form className="guardrail-inline-form" method="GET">
          <label>
            Event type
            <input name="eventType" defaultValue={eventType ?? ''} placeholder="REQUEST_DECISION" />
          </label>
          <button type="submit">Filter</button>
          <a href={`/api/audit/export${eventType ? `?eventType=${encodeURIComponent(eventType)}` : ''}`}>Export CSV</a>
        </form>
        {events.length === 0 ? (
          <p className="guardrail-muted">No audit events match the current filter.</p>
        ) : (
          <table className="guardrail-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Type</th>
                <th>Entity</th>
                <th>Actor</th>
                <th>Payload</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id}>
                  <td>{new Date(event.createdAt).toLocaleString()}</td>
                  <td>{event.eventType}</td>
                  <td>{event.entityType}:{event.entityId}</td>
                  <td>{event.actorEmail ?? 'system'}</td>
                  <td><pre className="guardrail-pre" style={{ margin: 0 }}>{JSON.stringify(event.payload, null, 2)}</pre></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </AdminShell>
  );
}
