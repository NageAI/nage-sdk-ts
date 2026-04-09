# @nage/sdk

TypeScript SDK for [Nage AI](https://nage.ai) — source-attributed intelligence.

```bash
npm install @nage/sdk
```

## Quick Start

```typescript
import { NageClient } from "@nage/sdk";

const client = new NageClient({ apiKey: "nk_live_..." });

// Think with STEMMA attribution
const thought = await client.think("What is SEDIM?");
console.log(thought.response);
console.log(thought.stemma.weights);  // { "fehm-tr": 0.73, "cortex": 0.27 }
console.log(thought.stemma.dominant_varve);  // "FEHM/tr"

// Streaming
for await (const chunk of client.thinkStream("Explain VARVE")) {
  process.stdout.write(chunk.delta);
  if (chunk.done) console.log("\nSTEMMA:", chunk.stemma);
}

// Knowledge state
const knowledge = await client.knowledge();
console.log(knowledge.layers);

// Learn new domain
await client.learn("Domain text...", "legal-tr");

// Platform info
const info = await client.platformInfo();
console.log(info.formula);  // CENTO = FACIES + Sigma STEMMA * VARVE
```

## API

| Method | Returns | Description |
|--------|---------|-------------|
| `think(query, options?)` | `ThoughtResponse` | Inference + STEMMA |
| `thinkStream(query, options?)` | `AsyncGenerator<ThoughtChunk>` | SSE streaming |
| `learn(text, domain, options?)` | `LearnResult` | Teach knowledge |
| `knowledge()` | `KnowledgeState` | VARVE health |
| `platformInfo()` | `PlatformInfo` | Metadata + tiers |
| `health()` | `HealthResponse` | Service status |

## Types

Full TypeScript types for STEMMA, ThoughtResponse, VARVE health, and all API responses.

## License

MIT
