export { NageClient } from "./client";
export { NageError, AuthError, RateLimitError, ServerError } from "./errors";
export type {
  // legacy /think surface
  NageClientOptions, ThinkOptions, LearnOptions,
  ThoughtResponse, ThoughtChunk, LearnResult,
  STEMMA, STEMMAEntry, KnowledgeSource,
  KnowledgeState, VARVEHealth, PlatformInfo, HealthResponse,
  StratumTier,
  // KLM v1 surface (SDK v0.2)
  EpistemicLabel, Gamma, AuditRef,
  ChatMessage, ChatChoice, Usage, ChatCompletion, ChatCompletionRequest,
  ModelInfo,
  AuditRecord, AuditExport, AuditExportRequest,
  HealthBand, VarveHealth, HealthRatioResponse,
} from "./types";
