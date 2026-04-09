import {
  NageClientOptions, ThinkOptions, LearnOptions,
  ThoughtResponse, ThoughtChunk, LearnResult,
  KnowledgeState, PlatformInfo, HealthResponse,
  STEMMA,
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
