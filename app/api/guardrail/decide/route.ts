import { NextResponse } from 'next/server';

import { resolveGatewaySession } from '@/lib/guardrail/auth';
import { enforceBodyLimit, processGatewayDecision, readGatewayPayload } from '@/lib/guardrail/service';

export async function POST(request: Request) {
  try {
    await enforceBodyLimit(request);
    const session = await resolveGatewaySession(request);
    const payload = await readGatewayPayload(request);
    const { request: requestRecord, evaluation, policy } = await processGatewayDecision(payload, session.tenant, session.actor);

    return NextResponse.json({
      requestId: requestRecord.requestId,
      policyId: policy.id,
      decision: evaluation.decision,
      hardBlock: evaluation.hardBlock,
      riskScore: evaluation.riskScore,
      riskBreakdown: evaluation.riskBreakdown,
      matchedRules: evaluation.matchedRules,
      detectorResults: evaluation.detectorResults,
      sanitizedPayload: evaluation.sanitizedPayload,
      redactions: requestRecord.redactions,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Guardrail decision failed';
    const status = /unauthorized|required unless/i.test(message) ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
