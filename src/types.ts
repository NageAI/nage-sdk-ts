/** STEMMA attribution entry for a single VARVE. */
export interface STEMMAEntry {
  varve: string;
  weight: number;
  layer: string;
  source?: string;
}

/** Source attribution for a response. */
export interface STEMMA {
  weights: Record<string, number>;
  dominant_layer: string;
  dominant_varve: string;
  entropy: number;
  entries?: STEMMAEntry[];
}

/** Knowledge source that contributed to a response. */
export interface KnowledgeSource {
  varve: string;
  layer: string;
  weight: number;
  confidence: number;
}

/** Response from client.think(). */
export interface ThoughtResponse {
  thought_id: string;
  response: string;
  stemma: STEMMA;
  knowledge: KnowledgeSource[];
  meta: Record<string, any>;
}

/** One chunk from streaming response. */
export interface ThoughtChunk {
  thought_id: string;
  delta: string;
  done: boolean;
  response?: string;
  stemma?: STEMMA;
}

/** Response from client.learn(). */
export interface LearnResult {
  varve_id: string;
  varve_type: string;
  layer: string;
  status: string;
  training_eta?: number;
  message: string;
}

/** VARVE health info. */
export interface VARVEHealth {
  varve_id: string;
  layer: string;
  status: string;
  distance: number;
  description: string;
}

/** Knowledge state. */
export interface KnowledgeState {
  platform: string;
  total_varves: number;
  layers: Record<string, VARVEHealth[]>;
}

/** Platform info. */
export interface PlatformInfo {
  platform_id: string;
  model_id: string;
  d_model: number;
  varves: number;
  varve_names: string[];
  formula: string;
  stratum_tiers: Record<string, number | null>;
}

/** Health check. */
export interface HealthResponse {
  status: string;
  version: string;
  app: string;
  checks?: Record<string, string>;
}

/** Client options. */
export interface NageClientOptions {
  apiKey: string;
  baseUrl?: string;
  platform?: string;
  timeout?: number;
}

/** Think options. */
export interface ThinkOptions {
  platform?: string;
  varveHint?: string;
  layerHint?: string;
  maxTokens?: number;
  temperature?: number;
  context?: Array<{ role: string; content: string }>;
}

/** Learn options. */
export interface LearnOptions {
  layer?: string;
  varveType?: string;
}

/** STRATUM API tiers. */
export type StratumTier = "SURFACE" | "DRIFT" | "VEIN" | "LODE" | "CORE";

// ──────────────────────────────────────────────────────────────────────
// KLM v1 surface — γ vector, OpenAI-compat ChatCompletion, Audit, Health
// Mirrors the Python SDK's nage v0.2.0 additions. References:
//   SEDIM v1.0  §10  KLM Compliance
//   STRATUM v1.1 §3  γ Detail Levels
//   STRATUM v1.1 §4  Endpoint Yapısı
//   STRATUM v1.1 §7  Audit ve AI Act
//   SEDIM v1.0  §5.3 Resonance-Gated mode
//   SEDIM v1.0  §9.1 Health Ratio
// ──────────────────────────────────────────────────────────────────────

/** Six-label epistemic state per SEDIM v1.0 §10.5 / KLM standard. */
export type EpistemicLabel =
  | "STABLE"
  | "EVOLVING"
  | "CONTESTED"
  | "UNCERTAIN"
  | "STALE"
  | "RAW";

/**
 * KLM γ vector — epistemic fingerprint of a single inference output.
 *
 * Tier-aware visibility (STRATUM §3.7):
 *   SURFACE  → null returned (γ stripped from response entirely)
 *   DRIFT    → epistemic_label + warning only
 *   VEIN     → adds confidence + dominant_source
 *   LODE     → adds evidence/coherence/freshness scores + provenance_map
 *   CORE     → all of the above plus audit_ref on the response root
 */
export interface Gamma {
  epistemic_label?: EpistemicLabel;
  warning?: string | null;
  confidence?: number;
  evidence_score?: number;
  freshness_score?: number;
  coherence_score?: number;
  dominant_source?: string;
  provenance_map?: Record<string, number>;
}

/** Audit reference returned in CORE-tier responses (STRATUM §5.3). */
export interface AuditRef {
  audit_id: string;
  frame_id: string | null;
  signed_by: string | null;
}

// ── OpenAI-compat chat.completion ─────────────────────────────────────

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
}

export interface ChatChoice {
  index: number;
  message: ChatMessage;
  finish_reason?: string | null;
}

export interface Usage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

/** OpenAI-compatible chat.completion response with KLM extensions. */
export interface ChatCompletion {
  id: string;
  object: "chat.completion";
  created: number;
  model: string;
  choices: ChatChoice[];
  usage: Usage;
  // KLM extensions — present per tier
  gamma?: Gamma | null;
  audit_id?: string;
  audit_ref?: AuditRef;
}

export interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  max_tokens?: number;
  temperature?: number;
  stream?: boolean;
  // STRATUM extensions (KLM)
  varve_ids?: string[];
  varve_weights?: Record<string, number>;
  inference_mode?:
    | "adaptive"
    | "full"
    | "cento_full"
    | "top_k"
    | "static"
    | "resonance_gated";
  audit?: boolean;
  end_user_id?: string;
  session_id?: string;
  include_tensions?: boolean;
}

// ── /v1/models ────────────────────────────────────────────────────────

export interface ModelInfo {
  id: string;
  object: "model";
  created: number;
  owned_by: string;
  context_window?: number;
  tier_min?: string;
}

// ── /v1/audit/{id} ────────────────────────────────────────────────────

export interface AuditRecord {
  audit_id: string;
  created_at?: string | null;
  event_type?: string | null;
  gamma?: Gamma | null;
  payload?: Record<string, unknown> | null;
  routing_snapshot?: Record<string, unknown> | null;   // CORE tier only
  audit_ref?: AuditRef;                                 // CORE tier only
}

// ── /v1/audit/export ──────────────────────────────────────────────────

export interface AuditExportRequest {
  period?: { start: string; end: string };
  format?: "ai_act_2024";
  include_content_hashes?: boolean;
}

/** AuditExport bundle — opaque tar.gz the SDK never decompresses. */
export interface AuditExport {
  contentBytes: Uint8Array;
  recordCount: number;
  format: string;
  filename: string;
}

// ── SEDIM §9.1 health_ratio ──────────────────────────────────────────

export type HealthBand = "healthy" | "consolidation_candidate" | "drifted";

export interface VarveHealth {
  name: string;
  rho: number;
  rho_global: number;
  band: HealthBand;
  n_layers: number;
  rho_min?: number;
  rho_max?: number;
}

export interface HealthRatioResponse {
  varve_count: number;
  scanned_layers: number;
  healthy_band: { min: number; max: number };
  results: Record<string, VarveHealth>;
}
