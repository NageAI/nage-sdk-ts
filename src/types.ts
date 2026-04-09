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
