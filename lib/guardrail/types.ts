export type PolicyAction = 'pass' | 'redact' | 'block';
export type GuardrailRequestKind = 'prompt' | 'tool_call';
export type DecisionOutcome = 'pass' | 'redact' | 'block';
export type ReviewState = 'pending' | 'reviewed';

export interface PolicyThresholds {
  promptInjection: number;
  dataLeak: number;
  unsafeTool: number;
}

export interface PolicyActions {
  promptInjection: PolicyAction;
  dataLeak: PolicyAction;
  unsafeTool: PolicyAction;
  unknownTool: PolicyAction;
}

export interface PolicyRules {
  blockedPromptPatterns: string[];
  hardBlockPromptPatterns: string[];
  blockedToolPatterns: string[];
  allowedTools: string[];
  sensitiveFields: string[];
}

export interface PolicyConfig {
  thresholds: PolicyThresholds;
  actions: PolicyActions;
  rules: PolicyRules;
}

export interface MatchedRule {
  id: string;
  category: 'prompt_injection' | 'data_leak' | 'unsafe_tool' | 'policy';
  action: PolicyAction;
  confidence: number;
  message: string;
  source: string;
  hardBlock?: boolean;
}

export interface DetectorMatch {
  id: string;
  category: 'prompt_injection' | 'data_leak' | 'unsafe_tool';
  confidence: number;
  message: string;
}

export interface DetectorResult {
  detector: 'local' | 'cloudflare' | 'aws';
  status: 'matched' | 'clear' | 'unavailable' | 'skipped';
  scores: {
    promptInjection: number;
    dataLeak: number;
    unsafeTool: number;
  };
  matches: DetectorMatch[];
  detail: string;
}

export interface RedactionRecordInput {
  jsonPath: string;
  originalHash: string;
  replacement: string;
  reason: string;
}

export interface GatewayPromptRequest {
  requestType: 'prompt';
  prompt: string;
  provider?: string;
  metadata?: Record<string, unknown>;
}

export interface GatewayToolRequest {
  requestType: 'tool_call';
  prompt?: string;
  provider?: string;
  toolCall: {
    name: string;
    arguments?: Record<string, unknown>;
  };
  metadata?: Record<string, unknown>;
}

export type GatewayRequestPayload = GatewayPromptRequest | GatewayToolRequest;

export interface TenantContext {
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
}

export interface ActorContext {
  userId?: string;
  email: string;
  role: 'ADMIN' | 'REVIEWER' | 'ANALYST';
  authMode: 'cookie' | 'header' | 'mock';
}

export interface GatewayEvaluationResult {
  requestId: string;
  decision: DecisionOutcome;
  hardBlock: boolean;
  riskScore: number;
  riskBreakdown: {
    promptInjection: number;
    dataLeak: number;
    unsafeTool: number;
  };
  matchedRules: MatchedRule[];
  detectorResults: DetectorResult[];
  redactions: RedactionRecordInput[];
  sanitizedPayload: unknown;
  inputHash: string;
  inputPreview: string;
}

export interface DashboardSummary {
  tenant: TenantContext;
  policies: Array<{
    id: string;
    name: string;
    status: 'draft' | 'published' | 'archived';
    version: number;
    updatedAt: string;
  }>;
  recentRequests: Array<{
    id: string;
    requestId: string;
    decision: DecisionOutcome;
    riskScore: number;
    inputPreview: string;
    createdAt: string;
  }>;
  blockedCount: number;
  redactedCount: number;
  pendingReviews: number;
}
