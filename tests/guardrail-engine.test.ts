import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { createDefaultPolicyConfig } from '@/lib/guardrail/defaults';
import { evaluateGuardrailDecision } from '@/lib/guardrail/engine';
import { hashValue, readSessionCookie, sanitizePayload, signSession } from '@/lib/guardrail/security';

const fixture = readFileSync(path.join(process.cwd(), 'tests/fixtures/prompt-injection-ja.txt'), 'utf8').trim();

describe('guardrail evaluation', () => {
  it('blocks the adversarial Japanese prompt injection fixture', async () => {
    const result = await evaluateGuardrailDecision({ requestType: 'prompt', prompt: fixture }, createDefaultPolicyConfig());

    expect(result.decision).toBe('block');
    expect(result.riskBreakdown.promptInjection).toBeGreaterThanOrEqual(0.9);
    expect(result.matchedRules.some((rule) => rule.category === 'prompt_injection' || rule.category === 'policy')).toBe(true);
  });


  it('round-trips signed sessions and rejects tampering', () => {
    process.env.GUARDRAIL_ALLOW_INSECURE_DEV_SESSION = 'true';
    delete process.env.SESSION_SECRET;

    const token = signSession({ email: 'admin@guardrail.local', role: 'ADMIN', authMode: 'cookie', tenantSlug: 'demo-tenant' });
    const parsed = readSessionCookie(`guardrail_gate_session=${token}`);
    const tampered = readSessionCookie(`guardrail_gate_session=${token.slice(0, -1)}x`);

    expect(parsed?.email).toBe('admin@guardrail.local');
    expect(parsed?.tenantSlug).toBe('demo-tenant');
    expect(tampered).toBeNull();
  });

  it('expires stale sessions', () => {
    process.env.GUARDRAIL_ALLOW_INSECURE_DEV_SESSION = 'true';
    delete process.env.SESSION_SECRET;

    const expired = signSession({ email: 'admin@guardrail.local', role: 'ADMIN', authMode: 'cookie', tenantSlug: 'demo-tenant' }, -1000);
    expect(readSessionCookie(`guardrail_gate_session=${expired}`)).toBeNull();
  });

  it('redacts sensitive fields and hashes originals', () => {
    const payload = { authorization: '******', nested: { password: 'top-secret' } };
    const { sanitized, redactions } = sanitizePayload(payload, ['authorization', 'password']);

    expect(sanitized).toEqual({ authorization: '[REDACTED_FIELD]', nested: { password: '[REDACTED_FIELD]' } });
    expect(redactions).toHaveLength(2);
    expect(redactions[0]?.originalHash).toBe(hashValue(JSON.stringify('******')));
    expect(redactions[1]?.originalHash).toBe(hashValue(JSON.stringify('top-secret')));
  });
});
