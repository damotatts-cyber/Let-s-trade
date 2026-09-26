import { notFound } from 'next/navigation';

import AdminShell from '@/components/guardrail/AdminShell';
import ReviewForm from '@/components/guardrail/ReviewForm';
import { requireAdminSession } from '@/lib/guardrail/auth';
import { getGuardrailRepository } from '@/lib/guardrail/repository';

export default async function RequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { tenant } = await requireAdminSession();
  const { id } = await params;
  const repository = getGuardrailRepository();
  const request = await repository.getRequest(tenant.tenantId, id);

  if (!request) {
    notFound();
  }

  const matchedRules = Array.isArray(request.matchedRules) ? request.matchedRules : [];
  const detectors = Array.isArray(request.detectorResults) ? request.detectorResults : [];

  return (
    <AdminShell title={`Request ${request.requestId}`} subtitle={`Decision ${request.decision} · ${request.reviewStatus === 'reviewed' ? 'reviewed' : 'awaiting review'} · hashed + sanitized persistence only.`}>
      <section className="guardrail-grid">
        <article className="guardrail-card" style={{ display: 'grid', gap: '1rem' }}>
          <div>
            <h2 style={{ marginTop: 0 }}>Risk explanation</h2>
            <p className="guardrail-muted">Preview: {request.inputPreview}</p>
            <pre className="guardrail-pre">{JSON.stringify(request.riskBreakdown, null, 2)}</pre>
          </div>
          <div>
            <h3>Matched rules</h3>
            {matchedRules.length === 0 ? <p className="guardrail-muted">No matched rules.</p> : <pre className="guardrail-pre">{JSON.stringify(matchedRules, null, 2)}</pre>}
          </div>
          <div>
            <h3>Detectors</h3>
            <pre className="guardrail-pre">{JSON.stringify(detectors, null, 2)}</pre>
          </div>
        </article>

        <article className="guardrail-card" style={{ display: 'grid', gap: '1rem' }}>
          <div>
            <h2 style={{ marginTop: 0 }}>Redaction preview</h2>
            {request.redactions.length === 0 ? (
              <p className="guardrail-muted">No sensitive fields required redaction.</p>
            ) : (
              <ul className="guardrail-list">
                {request.redactions.map((redaction) => (
                  <li key={redaction.id}>
                    <span>{redaction.jsonPath}</span>
                    <span>{redaction.replacement}</span>
                    <span>{redaction.reason}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <h3>Sanitized payload</h3>
            <pre className="guardrail-pre">{JSON.stringify(request.sanitizedPayload, null, 2)}</pre>
          </div>
          <div>
            <h3>Human review</h3>
            <ReviewForm requestId={request.id} />
          </div>
        </article>
      </section>
    </AdminShell>
  );
}
