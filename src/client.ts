import {
  NageClientOptions, ThinkOptions, LearnOptions,
  ThoughtResponse, ThoughtChunk, LearnResult,
  KnowledgeState, PlatformInfo, HealthResponse,
  STEMMA,
  // KLM v1 — Phase A+B+C+D mirror of Python SDK v0.2
  ChatCompletion, ChatCompletionRequest, ChatMessage,
  ModelInfo, AuditRecord, AuditExport, AuditExportRequest,
  HealthRatioResponse,
} from "./types";
import { NageError, AuthError, RateLimitError, ServerError } from "./errors";

const DEFAULT_BASE_URL = "https://ai.nage.ai";

/** Nage AI TypeScript client. */
export class NageClient {
  private apiKey: string;
  private baseUrl: string;
  private platform: string;
  private timeout: number;

  constructor(options: NageClientOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl || DEFAULT_BASE_URL).replace(/\/$/, "");
    this.platform = options.platform || "nage-8b";
    this.timeout = options.timeout || 120000;
  }

  /** Send a query with STEMMA attribution. */
  async think(query: string, options: ThinkOptions = {}): Promise<ThoughtResponse> {
    return this.post<ThoughtResponse>("/think", {
      query,
      platform: options.platform || this.platform,
      max_tokens: options.maxTokens || 512,
      temperature: options.temperature || 0.7,
      varve_hint: options.varveHint,
      layer_hint: options.layerHint,
      context: options.context,
    });
  }

  /** Streaming inference via SSE. Yields ThoughtChunks. */
  async *thinkStream(query: string, options: ThinkOptions = {}): AsyncGenerator<ThoughtChunk> {
    const response = await this.rawPost("/think/stream", {
      query,
      platform: options.platform || this.platform,
      max_tokens: options.maxTokens || 512,
      temperature: options.temperature || 0.7,
      stream: true,
    });

    const reader = response.body?.getReader();
    if (!reader) throw new NageError("No response body");

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        try {
          const data = JSON.parse(line.slice(6));
          yield data as ThoughtChunk;
          if (data.done) return;
        } catch { }
      }
    }
  }

  /** Teach new knowledge. */
  async learn(text: string, domain: string, options: LearnOptions = {}): Promise<LearnResult> {
    return this.post<LearnResult>("/learn", {
      text,
      domain,
      layer: options.layer || "CHI",
      varve_type: options.varveType || "ephemeral",
    });
  }

  /** Get knowledge state (VARVEs + health). */
  async knowledge(): Promise<KnowledgeState> {
    return this.get<KnowledgeState>(`/knowledge?platform=${this.platform}`);
  }

  /** Get platform info. */
  async platformInfo(): Promise<PlatformInfo> {
    return this.get<PlatformInfo>(`/platform?platform=${this.platform}`);
  }

  /** Health check. */
  async health(): Promise<HealthResponse> {
    return this.get<HealthResponse>("/health");
  }

  // ── KLM v1 surface (Phase A+B+C+D) ─────────────────────────────────
  // STRATUM v1.1 §4.2 endpoints. The /v1/* path runs alongside legacy
  // /think — same backend, OpenAI-shape on top, tier-aware γ + audit.

  /**
   * OpenAI-compatible chat completion via STRATUM /v1/chat/completions.
   *
   * Drop-in replacement for `openai.chat.completions.create` —
   * identical request/response shape, plus KLM extensions (gamma,
   * audit_id) when the caller's STRATUM tier permits.
   *
   * @example
   *   const r = await client.chatCompletion({
   *     model: "fehm-8b",
   *     messages: [{ role: "user", content: "merhaba" }],
   *     inference_mode: "resonance_gated",   // SEDIM §5.3
   *   });
   *   console.log(r.choices[0].message.content);
   *   console.log(r.gamma?.epistemic_label);
   *   console.log(r.audit_id);
   */
  async chatCompletion(req: ChatCompletionRequest): Promise<ChatCompletion> {
    if (req.stream) {
      throw new NageError(
        "stream=true is shipping in a future release — set stream=false " +
        "for now (full response returns at once).",
        501,
        { code: "streaming_not_implemented" },
      );
    }
    return this.post<ChatCompletion>("/v1/chat/completions", { ...req });
  }

  /** List models per STRATUM /v1/models. */
  async modelsList(): Promise<ModelInfo[]> {
    const data = await this.get<{ object: string; data: ModelInfo[] }>("/v1/models");
    return data.data || [];
  }

  /**
   * Retrieve a previous /v1/chat/completions audit Knowledge Unit.
   * Tier gate: LODE+. Tenant-scoped — cross-tenant audit_id 404s.
   */
  async auditGet(auditId: string): Promise<AuditRecord> {
    return this.get<AuditRecord>(`/v1/audit/${encodeURIComponent(auditId)}`);
  }

  /**
   * AI Act audit export via /v1/audit/export. Returns the raw tar.gz
   * bytes. The SDK does NOT decompress — manifest + signatures must
   * be preserved as-shipped for offline AI Act verification.
   *
   * `period` defaults to previous calendar month server-side.
   */
  async auditExport(opts: AuditExportRequest = {}): Promise<AuditExport> {
    const body: AuditExportRequest = {
      format: opts.format || "ai_act_2024",
      include_content_hashes: opts.include_content_hashes ?? true,
    };
    if (opts.period) {
      body.period = opts.period;
    }
    const res = await this.rawPost("/v1/audit/export", body);
    if (!res.ok) {
      await this.handleResponse(res);   // throws
    }
    const buffer = await res.arrayBuffer();
    const cd = res.headers.get("content-disposition") || "";
    const m = cd.match(/filename="?([^";]+)"?/);
    return {
      contentBytes: new Uint8Array(buffer),
      recordCount: parseInt(res.headers.get("X-Audit-Records") || "0", 10),
      format: res.headers.get("X-Audit-Format") || body.format!,
      filename: m?.[1] || "audit-export.tar.gz",
    };
  }

  /**
   * SEDIM §9.1 health ratio compute. Worker-token gated; admin/cron
   * use only. Returns per-VARVE ρ and band classification.
   *
   * NOTE: this hits the operator endpoint (/internal/worker/health-ratio)
   * which requires X-Worker-Token. Set `auth: "worker"` in the
   * `varvesHealth` call, or use a separate `WorkerClient` (TBD).
   */
  async varvesHealth(varveNames?: string[]): Promise<HealthRatioResponse> {
    const body: { varve_names?: string[] } = {};
    if (varveNames && varveNames.length) body.varve_names = varveNames;
    return this.post<HealthRatioResponse>("/internal/worker/health-ratio", body);
  }

  // ── HTTP ─────────────────────────────────────

  private headers(): Record<string, string> {
    return {
      "X-Nage-Key": this.apiKey,
      "Content-Type": "application/json",
      "User-Agent": "@nage/sdk-ts/0.1.0",
    };
  }

  private async get<T>(path: string): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: "GET",
      headers: this.headers(),
      signal: AbortSignal.timeout(this.timeout),
    });
    return this.handleResponse<T>(res);
  }

  private async post<T>(path: string, body: Record<string, any>): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.timeout),
    });
    return this.handleResponse<T>(res);
  }

  private async rawPost(path: string, body: Record<string, any>): Promise<Response> {
    return fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(body),
    });
  }

  private async handleResponse<T>(res: Response): Promise<T> {
    const data = await res.json();
    if (!res.ok) {
      const msg = data.message || data.error || "API error";
      if (res.status === 401) throw new AuthError(msg);
      if (res.status === 429) throw new RateLimitError(msg, data.limit, data.used);
      if (res.status >= 500) throw new ServerError(msg);
      throw new NageError(msg, res.status, data);
    }
    return data as T;
  }
}
