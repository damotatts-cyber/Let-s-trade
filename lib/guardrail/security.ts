import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

import { SESSION_COOKIE_NAME } from '@/lib/guardrail/defaults';
import type { ActorContext, RedactionRecordInput } from '@/lib/guardrail/types';

const SECRET_NAME_PATTERN = /(api[-_ ]?key|password|secret|token|authorization|cookie)/i;
const SECRET_VALUE_PATTERNS = [
  /sk-[a-zA-Z0-9_-]{10,}/g,
  /Bearer\s+[A-Za-z0-9._-]{8,}/g,
  /AKIA[0-9A-Z]{16}/g,
  /-----BEGIN [A-Z ]+-----[\s\S]+?-----END [A-Z ]+-----/g,
];

function getSessionSecret(): string {
  if (process.env.SESSION_SECRET) {
    return process.env.SESSION_SECRET;
  }

  if (process.env.NODE_ENV !== 'production' && process.env.GUARDRAIL_ALLOW_INSECURE_DEV_SESSION === 'true') {
    return 'guardrail-gate-dev-secret';
  }

  throw new Error('SESSION_SECRET is required unless GUARDRAIL_ALLOW_INSECURE_DEV_SESSION=true in non-production mode');
}

export function hashValue(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right));
  return `{${entries.map(([key, nested]) => `${JSON.stringify(key)}:${stableStringify(nested)}`).join(',')}}`;
}

function shouldRedactField(fieldName: string, sensitiveFields: string[]): boolean {
  return sensitiveFields.some((field) => field.toLowerCase() === fieldName.toLowerCase()) || SECRET_NAME_PATTERN.test(fieldName);
}

function redactStringValue(value: string, jsonPath: string): { value: string; redactions: RedactionRecordInput[] } {
  let next = value;
  const redactions: RedactionRecordInput[] = [];

  for (const pattern of SECRET_VALUE_PATTERNS) {
    next = next.replace(pattern, (match) => {
      redactions.push({
        jsonPath,
        originalHash: hashValue(match),
        replacement: '[REDACTED_SECRET]',
        reason: 'Secret-like token detected',
      });
      return '[REDACTED_SECRET]';
    });
  }

  return { value: next, redactions };
}

export function sanitizePayload(value: unknown, sensitiveFields: string[], jsonPath = '$'): { sanitized: unknown; redactions: RedactionRecordInput[] } {
  if (value === null || value === undefined) {
    return { sanitized: value, redactions: [] };
  }

  if (typeof value === 'string') {
    const redacted = redactStringValue(value, jsonPath);
    return { sanitized: redacted.value, redactions: redacted.redactions };
  }

  if (typeof value !== 'object') {
    return { sanitized: value, redactions: [] };
  }

  if (Array.isArray(value)) {
    const items = value.map((item, index) => sanitizePayload(item, sensitiveFields, `${jsonPath}[${index}]`));
    return {
      sanitized: items.map((item) => item.sanitized),
      redactions: items.flatMap((item) => item.redactions),
    };
  }

  const sanitizedEntries: Record<string, unknown> = {};
  const redactions: RedactionRecordInput[] = [];

  for (const [key, nestedValue] of Object.entries(value)) {
    const nestedPath = `${jsonPath}.${key}`;
    if (shouldRedactField(key, sensitiveFields)) {
      const original = stableStringify(nestedValue);
      sanitizedEntries[key] = '[REDACTED_FIELD]';
      redactions.push({
        jsonPath: nestedPath,
        originalHash: hashValue(original),
        replacement: '[REDACTED_FIELD]',
        reason: `Sensitive field ${key} redacted`,
      });
      continue;
    }

    const sanitizedNested = sanitizePayload(nestedValue, sensitiveFields, nestedPath);
    sanitizedEntries[key] = sanitizedNested.sanitized;
    redactions.push(...sanitizedNested.redactions);
  }

  return { sanitized: sanitizedEntries, redactions };
}

export function createPreview(value: unknown, maxLength = 180): string {
  const serialized = typeof value === 'string' ? value : stableStringify(value);
  const compact = serialized.replace(/\s+/g, ' ').trim();
  return compact.length <= maxLength ? compact : `${compact.slice(0, maxLength - 1)}…`;
}

export function signSession(payload: ActorContext & { tenantSlug: string }): string {
  const secret = getSessionSecret();
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const signature = createHmac('sha256', secret).update(encoded).digest('hex');
  return `${encoded}.${signature}`;
}

export function readSessionCookie(cookieHeader: string | null | undefined): (ActorContext & { tenantSlug: string }) | null {
  if (!cookieHeader) {
    return null;
  }

  const rawCookie = cookieHeader
    .split(';')
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${SESSION_COOKIE_NAME}=`));

  if (!rawCookie) {
    return null;
  }

  const token = rawCookie.slice(SESSION_COOKIE_NAME.length + 1);
  const [encoded, signature] = token.split('.');
  if (!encoded || !signature) {
    return null;
  }

  const secret = getSessionSecret();
  const expected = createHmac('sha256', secret).update(encoded).digest('hex');

  if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    return null;
  }

  try {
    return JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as ActorContext & { tenantSlug: string };
  } catch {
    return null;
  }
}
