import { NextResponse } from 'next/server';

import { resolveAdminRequestSession } from '@/lib/guardrail/auth';
import { evaluateGuardrailDecision, gatewayRequestSchema } from '@/lib/guardrail/engine';
import { getGuardrailRepository } from '@/lib/guardrail/repository';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await resolveAdminRequestSession(request);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = gatewayRequestSchema.parse(await request.json());
    const { id } = await params;
    const repository = getGuardrailRepository();
    const policy = await repository.getPolicy(session.tenant.tenantId, id);
    if (!policy) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const evaluation = await evaluateGuardrailDecision(body, {
      thresholds: policy.thresholds,
      rules: policy.rules,
      actions: policy.actions,
    });

    return NextResponse.json({
      policyId: policy.id,
      decision: evaluation.decision,
      hardBlock: evaluation.hardBlock,
      riskScore: evaluation.riskScore,
      matchedRules: evaluation.matchedRules,
      detectorResults: evaluation.detectorResults,
      redactions: evaluation.redactions,
      sanitizedPayload: evaluation.sanitizedPayload,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to simulate policy' }, { status: 400 });
  }
}
