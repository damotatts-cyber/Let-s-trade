import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { createDefaultPolicyConfig } from '@/lib/guardrail/defaults';
import { evaluateGuardrailDecision } from '@/lib/guardrail/engine';
import { hashValue, sanitizePayload } from '@/lib/guardrail/security';

const fixture = readFileSync(path.join(process.cwd(), 'tests/fixtures/prompt-injection-ja.txt'), 'utf8').trim();

describe('guardrail evaluation', () => {
  it('blocks the adversarial Japanese prompt injection fixture', async () => {
    const result = await evaluateGuardrailDecision({ requestType: 'prompt', prompt: fixture }, createDefaultPolicyConfig());

    expect(result.decision).toBe('block');
    expect(result.riskBreakdown.promptInjection).toBeGreaterThanOrEqual(0.9);
    expect(result.matchedRules.some((rule) => rule.category === 'prompt_injection' || rule.category === 'policy')).toBe(true);
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
