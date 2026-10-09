import type { DetectorResult, GatewayRequestPayload } from '@/lib/guardrail/types';

interface DetectorAdapter {
  inspect(payload: GatewayRequestPayload): Promise<DetectorResult>;
}

const promptSignals = [
  { needle: 'ignore previous instructions', confidence: 0.95, message: 'Instruction override phrase detected' },
  { needle: 'reveal system prompt', confidence: 0.92, message: 'System prompt disclosure request detected' },
  { needle: 'disable safety', confidence: 0.9, message: 'Safety bypass phrase detected' },
  { needle: '前の指示を無視', confidence: 0.97, message: 'Japanese instruction-override phrase detected' },
  { needle: 'システムプロンプト', confidence: 0.91, message: 'Japanese system prompt request detected' },
  { needle: '安全対策を解除', confidence: 0.94, message: 'Japanese safety-disable phrase detected' },
  { needle: '秘密情報', confidence: 0.88, message: 'Secret exfiltration phrase detected' },
];

const secretPatterns = [
  /sk-[a-zA-Z0-9_-]{10,}/i,
  /Bearer\s+[A-Za-z0-9._-]{8,}/i,
  /AKIA[0-9A-Z]{16}/,
  /password\s*[:=]/i,
  /api[_ -]?key\s*[:=]/i,
];

const blockedToolNeedles = ['shell', 'exec', 'delete', 'drop', 'curl', 'wget', 'exfiltrate'];

class LocalDetector implements DetectorAdapter {
  async inspect(payload: GatewayRequestPayload): Promise<DetectorResult> {
    const prompt = `${payload.prompt ?? ''} ${payload.requestType === 'tool_call' ? JSON.stringify(payload.toolCall.arguments ?? {}) : ''}`.toLowerCase();
    const toolName = payload.requestType === 'tool_call' ? payload.toolCall.name.toLowerCase() : '';
    const matches = [] as DetectorResult['matches'];
    let promptInjection = 0;
    let dataLeak = 0;
    let unsafeTool = 0;

    for (const signal of promptSignals) {
      if (prompt.includes(signal.needle.toLowerCase())) {
        promptInjection = Math.max(promptInjection, signal.confidence);
        matches.push({
          id: `local:${signal.needle}`,
          category: 'prompt_injection',
          confidence: signal.confidence,
          message: signal.message,
        });
      }
    }

    if (secretPatterns.some((pattern) => pattern.test(prompt))) {
      dataLeak = 0.82;
      matches.push({
        id: 'local:secret-pattern',
        category: 'data_leak',
        confidence: 0.82,
        message: 'Secret-like material detected in payload',
      });
    }

    if (toolName && blockedToolNeedles.some((needle) => toolName.includes(needle))) {
      unsafeTool = 0.96;
      matches.push({
        id: 'local:unsafe-tool-name',
        category: 'unsafe_tool',
        confidence: 0.96,
        message: `Tool name ${toolName} matches a blocked unsafe pattern`,
      });
    }

    const detail = matches.length > 0 ? 'Local heuristic detector matched one or more signals.' : 'Local heuristic detector found no matching signals.';
    return {
      detector: 'local',
      status: matches.length > 0 ? 'matched' : 'clear',
      scores: {
        promptInjection,
        dataLeak,
        unsafeTool,
      },
      matches,
      detail,
    };
  }
}

class DisabledRemoteDetector implements DetectorAdapter {
  constructor(private readonly detector: 'cloudflare' | 'aws', private readonly envKeys: string[]) {}

  async inspect(): Promise<DetectorResult> {
    const configured = this.envKeys.every((key) => Boolean(process.env[key]));
    return {
      detector: this.detector,
      status: configured ? 'skipped' : 'unavailable',
      scores: {
        promptInjection: 0,
        dataLeak: 0,
        unsafeTool: 0,
      },
      matches: [],
      detail: configured
        ? `${this.detector} detector adapter boundary configured but network execution is intentionally disabled in local mode.`
        : `${this.detector} detector credentials are absent, so the local detector remains authoritative.`,
    };
  }
}

export async function runDetectors(payload: GatewayRequestPayload): Promise<DetectorResult[]> {
  const detectors: DetectorAdapter[] = [
    new LocalDetector(),
    new DisabledRemoteDetector('cloudflare', ['CLOUDFLARE_ACCOUNT_ID', 'CLOUDFLARE_API_TOKEN']),
    new DisabledRemoteDetector('aws', ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY']),
  ];

  return Promise.all(detectors.map((detector) => detector.inspect(payload)));
}
