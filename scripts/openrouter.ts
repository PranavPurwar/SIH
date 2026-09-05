import dotenv from 'dotenv';

dotenv.config();

const API_KEY = process.env.OPENROUTER_API_KEY;
const headers = { Authorization: `Bearer ${API_KEY}` };

// 1. Submit a batch (POST /api/beta/batches).
const created = await fetch("https://openrouter.ai/api/beta/batches", {
  method: "POST",
  headers: { ...headers, "Content-Type": "application/json" },
  body: JSON.stringify({
    endpoint: "/v1/chat/completions",
    model: "openai/gpt-6-astra",
    requests: [
      {
        custom_id: "request-1",
        body: {
          model: "openai/gpt-6-astra",
          messages: [{ role: "user", content: "What is the meaning of life?" }],
        },
      },
    ],
  }),
}).then((res) => res.json());
const batchId = created.id;

// 2. Poll GET /api/beta/batches/:id until the batch is terminal — "results" are inlined.
//    Batch inputs and results are retained for 30 days.
const TERMINAL = ["completed", "failed", "cancelled", "expired"];
let batch;
do {
  await new Promise((resolve) => setTimeout(resolve, 10_000));
  batch = await fetch(`https://openrouter.ai/api/beta/batches/${batchId}`, {
    headers,
  }).then((res) => res.json());
} while (!TERMINAL.includes(batch.status));

console.log(batch.status, batch.results);