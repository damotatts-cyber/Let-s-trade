import { randomUUID } from 'node:crypto';

import { z } from 'zod';

import { MAX_PROMPT_CHARS, MAX_TOOL_ARGS_CHARS } from '@/lib/guardrail/defaults';
import { runDetectors } from '@/lib/guardrail/detectors';
import { createPreview, hashValue, sanitizePayload, stableStringify } from '@/lib/guardrail/security';
import type { DetectorResult, GatewayEvaluationResult, GatewayRequestPayload, MatchedRule, PolicyAction, PolicyConfig } from '@/lib/guardrail/types';

const metadataSchema = z.record(z.string(), z.unknown()).optional();

export const gatewayRequestSchema = z.discriminatedUnion('requestType', [
  z.object({
    requestType: z.literal('prompt'),
    prompt: z.string().min(1).max(MAX_PROMPT_CHARS),
    provider: z.string().max(120).optional(),
    metadata: metadataSchema,
  }),
  z.object({
    requestType: z.literal('tool_call'),
    prompt: z.string().max(MAX_PROMPT_CHARS).optional(),
    provider: z.string().max(120).optional(),
    toolCall: z.object({
      name: z.string().min(1).max(120),
      arguments: z.record(z.string(), z.unknown()).optional(),
    }),
    metadata: metadataSchema,
  }).superRefine((value, ctx) => {
    const size = stableStringify(value.toolCall.arguments ?? {}).length;
    if (size > MAX_TOOL_ARGS_CHARS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Tool arguments exceed ${MAX_TOOL_ARGS_CHARS} characters`,
      });
    }
  }),
]);

function lowerList(values: string[]): string[] {
  return values.map((value) => value.toLowerCase());
}

function chooseMoreSevere(current: PolicyAction, next: PolicyAction): PolicyAction {
  const priority: Record<PolicyAction, number> = { pass: 0, redact: 1, block: 2 };
  return priority[next] > priority[current] ? next : current;
}

function addRule(
  matchedRules: MatchedRule[],
  id: string,
  category: MatchedRule['category'],
  action: PolicyAction,
  confidence: number,
  message: string,
  source: string,
  hardBlock = false,
) {
  matchedRules.push({ id, category, action, confidence, message, source, hardBlock });
}

function collectDetectorRules(detectorResults: DetectorResult[], policy: PolicyConfig): MatchedRule[] {
  const rules: MatchedRule[] = [];
  for (const detector of detectorResults) {
    for (const match of detector.matches) {
      const action =
        match.category === 'prompt_injection'
          ? policy.actions.promptInjection
          : match.category === 'unsafe_tool'
            ? policy.actions.unsafeTool
            : policy.actions.dataLeak;
      addRule(rules, match.id, match.category, action, match.confidence, match.message, detector.detector, action === 'block');
    }
  }

  return rules;
}

export async function evaluateGuardrailDecision(payload: GatewayRequestPayload, policy: PolicyConfig): Promise<GatewayEvaluationResult> {
  const parsed = gatewayRequestSchema.parse(payload);
  const rawPayload =
    parsed.requestType === 'prompt'
      ? { prompt: parsed.prompt, metadata: parsed.metadata ?? {}, provider: parsed.provider ?? null }
      : {
          prompt: parsed.prompt ?? '',
          provider: parsed.provider ?? null,
          toolCall: parsed.toolCall,
          metadata: parsed.metadata ?? {},
        };

  const inputHash = hashValue(stableStringify(rawPayload));
  const { sanitized, redactions } = sanitizePayload(rawPayload, policy.rules.sensitiveFields);
  const detectorResults = await runDetectors(parsed);
  const matchedRules = collectDetectorRules(detectorResults, policy);

  const promptText = `${parsed.prompt ?? ''}`.toLowerCase();
  const blockedPromptPatterns = lowerList(policy.rules.blockedPromptPatterns);
  const hardBlockPromptPatterns = lowerList(policy.rules.hardBlockPromptPatterns);
  const blockedToolPatterns = lowerList(policy.rules.blockedToolPatterns);
  const allowedTools = lowerList(policy.rules.allowedTools);

  for (const pattern of blockedPromptPatterns) {
    if (promptText.includes(pattern)) {
      addRule(
        matchedRules,
        `policy:prompt:${pattern}`,
        'policy',
        policy.actions.promptInjection,
        0.95,
        `Prompt matched blocked phrase: ${pattern}`,
        'policy',
        policy.actions.promptInjection === 'block',
      );
    }
  }

  for (const pattern of hardBlockPromptPatterns) {
    if (promptText.includes(pattern)) {
      addRule(matchedRules, `policy:hard-prompt:${pattern}`, 'policy', 'block', 0.99, `Prompt matched hard-block phrase: ${pattern}`, 'policy', true);
    }
  }

  if (parsed.requestType === 'tool_call') {
    const toolName = parsed.toolCall.name.toLowerCase();
    for (const pattern of blockedToolPatterns) {
      if (toolName.includes(pattern)) {
        addRule(matchedRules, `policy:tool:${pattern}`, 'unsafe_tool', policy.actions.unsafeTool, 0.98, `Tool ${toolName} matched blocked pattern ${pattern}`, 'policy', policy.actions.unsafeTool === 'block');
      }
    }

    if (allowedTools.length > 0 && !allowedTools.includes(toolName)) {
      addRule(
        matchedRules,
        'policy:tool:unknown',
        'unsafe_tool',
        policy.actions.unknownTool,
        0.85,
        `Tool ${toolName} is not in the tenant allow-list`,
        'policy',
        policy.actions.unknownTool === 'block',
      );
    }
  }

  if (redactions.length > 0) {
    addRule(
      matchedRules,
      'policy:redaction:sensitive-fields',
      'data_leak',
      policy.actions.dataLeak,
      0.7,
      `Sanitizer redacted ${redactions.length} sensitive payload value(s)`,
      'policy',
      false,
    );
  }

  const riskBreakdown = {
    promptInjection: Math.max(...detectorResults.map((result) => result.scores.promptInjection), 0),
    dataLeak: Math.max(...detectorResults.map((result) => result.scores.dataLeak), redactions.length > 0 ? 0.7 : 0),
    unsafeTool: Math.max(...detectorResults.map((result) => result.scores.unsafeTool), 0),
  };

  let decision: PolicyAction = 'pass';
  let hardBlock = false;

  if (riskBreakdown.promptInjection >= policy.thresholds.promptInjection) {
    decision = chooseMoreSevere(decision, policy.actions.promptInjection);
    hardBlock ||= policy.actions.promptInjection === 'block';
  }

  if (riskBreakdown.dataLeak >= policy.thresholds.dataLeak) {
    decision = chooseMoreSevere(decision, policy.actions.dataLeak);
  }

  if (riskBreakdown.unsafeTool >= policy.thresholds.unsafeTool) {
    decision = chooseMoreSevere(decision, policy.actions.unsafeTool);
    hardBlock ||= policy.actions.unsafeTool === 'block';
  }

  for (const rule of matchedRules) {
    decision = chooseMoreSevere(decision, rule.action);
    hardBlock ||= Boolean(rule.hardBlock);
  }

  return {
    requestId: randomUUID(),
    decision,
    hardBlock,
    riskScore: Math.max(riskBreakdown.promptInjection, riskBreakdown.dataLeak, riskBreakdown.unsafeTool),
    riskBreakdown,
    matchedRules,
    detectorResults,
    redactions,
    sanitizedPayload: sanitized,
    inputHash,
    inputPreview: createPreview(sanitized),
  };
}
