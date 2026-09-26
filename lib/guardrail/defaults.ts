import type { PolicyConfig } from '@/lib/guardrail/types';

export const DEMO_TENANT_SLUG = 'demo-tenant';
export const DEMO_TENANT_NAME = 'Guardrail Gate Demo Tenant';
export const DEMO_ADMIN_EMAIL = 'admin@guardrail.local';
export const SESSION_COOKIE_NAME = 'guardrail_gate_session';
export const MAX_BODY_BYTES = 64 * 1024;
export const MAX_PROMPT_CHARS = 8_000;
export const MAX_TOOL_ARGS_CHARS = 16_000;

export function createDefaultPolicyConfig(): PolicyConfig {
  return {
    thresholds: {
      promptInjection: 0.75,
      dataLeak: 0.6,
      unsafeTool: 0.7,
    },
    actions: {
      promptInjection: 'block',
      dataLeak: 'redact',
      unsafeTool: 'block',
      unknownTool: 'block',
    },
    rules: {
      blockedPromptPatterns: [
        'ignore previous instructions',
        'reveal system prompt',
        'disable safety',
        '前の指示を無視',
        'システムプロンプト',
        '安全対策を解除',
      ],
      hardBlockPromptPatterns: ['exfiltrate', 'send secrets', '秘密情報', 'api key'],
      blockedToolPatterns: ['shell', 'exec', 'delete', 'drop', 'curl', 'wget', 'exfiltrate'],
      allowedTools: ['quote-prices', 'lookup-balance', 'ticket-status'],
      sensitiveFields: ['password', 'token', 'secret', 'authorization', 'apiKey', 'sessionCookie'],
    },
  };
}
