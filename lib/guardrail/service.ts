import { MAX_BODY_BYTES } from '@/lib/guardrail/defaults';
import { evaluateGuardrailDecision, gatewayRequestSchema } from '@/lib/guardrail/engine';
import { getGuardrailRepository, type PolicyRecord } from '@/lib/guardrail/repository';
import type { ActorContext, GatewayRequestPayload, TenantContext } from '@/lib/guardrail/types';

export async function enforceBodyLimit(request: Request) {
  const declaredLength = Number(request.headers.get('content-length') ?? '0');
  if (declaredLength > MAX_BODY_BYTES) {
    throw new Error(`Payload exceeds ${MAX_BODY_BYTES} bytes`);
  }
}

export async function readGatewayPayload(request: Request): Promise<GatewayRequestPayload & { policyId?: string; source?: string }> {
  const parsed = await request.json();
  const payload = gatewayRequestSchema.parse(parsed);
  return {
    ...payload,
    policyId: typeof parsed?.policyId === 'string' ? parsed.policyId : undefined,
    source: typeof parsed?.source === 'string' ? parsed.source : 'proxy',
  };
}

export async function loadPolicyForDecision(tenantId: string, requestedPolicyId?: string): Promise<PolicyRecord> {
  const repository = getGuardrailRepository();
  const policy = await repository.getPublishedPolicy(tenantId, requestedPolicyId);
  if (!policy) {
    throw new Error('No policy is available for the tenant');
  }
  return policy;
}

export async function processGatewayDecision(payload: GatewayRequestPayload & { policyId?: string; source?: string }, tenant: TenantContext, actor: ActorContext) {
  const repository = getGuardrailRepository();
  const policy = await loadPolicyForDecision(tenant.tenantId, payload.policyId);
  const evaluation = await evaluateGuardrailDecision(payload, {
    thresholds: policy.thresholds,
    rules: policy.rules,
    actions: policy.actions,
  });
  const requestRecord = await repository.recordDecision(
    tenant.tenantId,
    actor,
    policy.id,
    payload.requestType,
    payload.source ?? 'proxy',
    payload.requestType === 'tool_call' ? payload.toolCall.name : null,
    evaluation,
  );

  return {
    request: requestRecord,
    policy,
    evaluation,
  };
}
