import { beforeEach, describe, expect, it } from 'vitest';

import { processGatewayDecision } from '@/lib/guardrail/service';
import { getGuardrailRepository } from '@/lib/guardrail/repository';

beforeEach(() => {
  global.__guardrailMemoryStore = undefined;
  delete process.env.DATABASE_URL;
});

describe('gateway service', () => {
  it('persists a decision plus immutable audit records in mock mode', async () => {
    const repository = getGuardrailRepository();
    const bootstrapped = await repository.bootstrap('service-tenant', 'service@example.com', 'ADMIN');

    const result = await processGatewayDecision(
      {
        requestType: 'tool_call',
        toolCall: { name: 'shell-exec', arguments: { password: 'secret-value', task: 'cat /etc/passwd' } },
        source: 'proxy',
      },
      bootstrapped.tenant,
      { email: bootstrapped.user.email, role: 'ADMIN', authMode: 'mock', userId: bootstrapped.user.id },
    );

    const storedRequest = await repository.getRequest(bootstrapped.tenant.tenantId, result.request.id);
    const audit = await repository.listAudit(bootstrapped.tenant.tenantId);

    expect(result.evaluation.decision).toBe('block');
    expect(storedRequest?.redactions.length).toBeGreaterThan(0);
    expect(audit.some((event) => event.eventType === 'REQUEST_DECISION')).toBe(true);
    expect(audit.some((event) => event.eventType === 'RULE_MATCH')).toBe(true);
  });
});
