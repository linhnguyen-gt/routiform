import test from "node:test";
import assert from "node:assert/strict";

const BASE_URL = "http://localhost:20128";

test("contract: /api/v1 OPTIONS exposes CORS and allowed methods", async () => {
  const { OPTIONS } = await import("../../src/app/api/v1/route.ts");
  const response = await OPTIONS();

  assert.equal(response.status, 200);
  assert.ok(response.headers.has("Access-Control-Allow-Origin"));
});

test("contract: /api/v1/embeddings OPTIONS exposes POST/GET/OPTIONS", async () => {
  const { OPTIONS } = await import("../../src/app/api/v1/embeddings/route.ts");
  const response = await OPTIONS();
  const allowMethods = response.headers.get("Access-Control-Allow-Methods") || "";

  assert.equal(response.status, 200);
  assert.ok(allowMethods.includes("GET"));
  assert.ok(allowMethods.includes("POST"));
  assert.ok(allowMethods.includes("OPTIONS"));
});

test("contract: /api/v1 and /api/v1/models return consistent model IDs", async () => {
  const [{ GET: getV1 }, { GET: getV1Models }] = await Promise.all([
    import("../../src/app/api/v1/route.ts"),
    import("../../src/app/api/v1/models/route.ts"),
  ]);

  const [v1Response, v1ModelsResponse] = await Promise.all([
    getV1(new Request(`${BASE_URL}/api/v1`, { method: "GET" })),
    getV1Models(new Request(`${BASE_URL}/api/v1/models`, { method: "GET" })),
  ]);

  assert.equal(v1Response.status, 200);
  assert.equal(v1ModelsResponse.status, 200);

  const v1Body = await v1Response.json();
  const v1ModelsBody = await v1ModelsResponse.json();

  assert.equal(v1Body.object, "list");
  assert.equal(v1ModelsBody.object, "list");
  assert.ok(Array.isArray(v1Body.data));
  assert.ok(Array.isArray(v1ModelsBody.data));

  const v1Ids = [...new Set(v1Body.data.map((item) => item.id))].sort();
  const v1ModelsIds = [...new Set(v1ModelsBody.data.map((item) => item.id))].sort();

  assert.deepEqual(v1Ids, v1ModelsIds);
});

test("contract: /api/v1/models returns OpenAI-compatible model shape", async () => {
  const { GET: getV1Models } = await import("../../src/app/api/v1/models/route.ts");
  const response = await getV1Models(new Request(`${BASE_URL}/api/v1/models`, { method: "GET" }));

  assert.equal(response.status, 200);
  const body = await response.json();

  assert.equal(body.object, "list");
  assert.ok(Array.isArray(body.data));

  // In CI environments without provider connections, models list may be empty — skip shape check
  if (body.data.length > 0) {
    const first = body.data[0];
    assert.equal(typeof first.id, "string");
    assert.equal(first.object, "model");
    assert.equal(typeof first.created, "number");
    assert.equal(typeof first.owned_by, "string");
  }
});

test("contract: /api/v1/embeddings GET returns embedding model listing shape", async () => {
  const { GET: getEmbeddings } = await import("../../src/app/api/v1/embeddings/route.ts");
  const response = await getEmbeddings();

  assert.equal(response.status, 200);
  const body = await response.json();

  assert.equal(body.object, "list");
  assert.ok(Array.isArray(body.data));
  assert.ok(body.data.length > 0, "embedding model list should not be empty");

  const first = body.data[0];
  assert.equal(first.object, "model");
  assert.equal(first.type, "embedding");
  assert.equal(typeof first.id, "string");
  assert.equal(typeof first.owned_by, "string");
});

test("contract: /api/v1/images/generations GET returns image model listing shape", async () => {
  const { GET: getImageModels } = await import("../../src/app/api/v1/images/generations/route.ts");
  const response = await getImageModels();

  assert.equal(response.status, 200);
  const body = await response.json();

  assert.equal(body.object, "list");
  assert.ok(Array.isArray(body.data));
  assert.ok(body.data.length > 0, "image model list should not be empty");

  const first = body.data[0];
  assert.equal(first.object, "model");
  assert.equal(first.type, "image");
  assert.equal(typeof first.id, "string");
  assert.equal(typeof first.owned_by, "string");
});

test("contract: /api/v1/messages/count_tokens returns 400 on invalid JSON", async () => {
  const { POST: countTokens } = await import("../../src/app/api/v1/messages/count_tokens/route.ts");

  const response = await countTokens(
    new Request(`${BASE_URL}/api/v1/messages/count_tokens`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    })
  );

  assert.equal(response.status, 400);
  const body = await response.json();
  assert.ok(body.error, "error payload should exist");
  assert.ok(
    typeof body.error === "string" || typeof body.error === "object",
    "error payload should be string or object"
  );
});

test("contract: /api/v1/messages/count_tokens rejects empty messages payload", async () => {
  const { POST: countTokens } = await import("../../src/app/api/v1/messages/count_tokens/route.ts");

  const response = await countTokens(
    new Request(`${BASE_URL}/api/v1/messages/count_tokens`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [] }),
    })
  );

  assert.equal(response.status, 400);
  const body = await response.json();
  assert.ok(body.error, "error payload should exist");
  assert.ok(
    typeof body.error === "string" || typeof body.error === "object",
    "error payload should be string or object"
  );
});

test("contract: /api/v1/messages/count_tokens computes token estimate from text content", async () => {
  const { POST: countTokens } = await import("../../src/app/api/v1/messages/count_tokens/route.ts");

  const payload = {
    messages: [
      { role: "user", content: "abcd" }, // 4 chars
      {
        role: "assistant",
        content: [{ type: "text", text: "12345678" }], // 8 chars
      },
    ],
  };

  const response = await countTokens(
    new Request(`${BASE_URL}/api/v1/messages/count_tokens`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
  );

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.input_tokens, 3);
});

test("contract: /api/v1/messages/count_tokens uses upstream count for claude models when available", async () => {
  const {
    POST: countTokens,
    setCountTokensCredentialsResolverForTesting,
    resetCountTokensCredentialsResolverForTesting,
    setCountTokensAccessKeyValidatorForTesting,
    resetCountTokensAccessKeyValidatorForTesting,
    setCountTokensModelAccessValidatorForTesting,
    resetCountTokensModelAccessValidatorForTesting,
    setCountTokensApiKeyMetadataResolverForTesting,
    resetCountTokensApiKeyMetadataResolverForTesting,
  } = await import("../../src/app/api/v1/messages/count_tokens/route.ts");

  const originalFetch = globalThis.fetch;
  const fetchCalls = [];
  globalThis.fetch = async (url, init = {}) => {
    fetchCalls.push({ url: String(url), init });
    return new Response(JSON.stringify({ input_tokens: 42 }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
  setCountTokensCredentialsResolverForTesting(async () => ({ apiKey: "anthropic-test-key" }));
  setCountTokensAccessKeyValidatorForTesting(async () => true);
  setCountTokensModelAccessValidatorForTesting(async () => true);
  setCountTokensApiKeyMetadataResolverForTesting(async () => ({ isActive: true }));

  try {
    const payload = {
      model: "claude/claude-sonnet-4-20250514",
      messages: [{ role: "user", content: "hello" }],
    };

    const response = await countTokens(
      new Request(`${BASE_URL}/api/v1/messages/count_tokens`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer sk-test",
        },
        body: JSON.stringify(payload),
      })
    );

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.input_tokens, 42);
    assert.equal(fetchCalls.length, 1);
    assert.match(fetchCalls[0].url, /\/v1\/messages\/count_tokens$/);
  } finally {
    globalThis.fetch = originalFetch;
    resetCountTokensCredentialsResolverForTesting();
    resetCountTokensAccessKeyValidatorForTesting();
    resetCountTokensModelAccessValidatorForTesting();
    resetCountTokensApiKeyMetadataResolverForTesting();
  }
});

test("contract: /api/v1/messages/count_tokens falls back to local estimate on upstream failure", async () => {
  const {
    POST: countTokens,
    setCountTokensCredentialsResolverForTesting,
    resetCountTokensCredentialsResolverForTesting,
    setCountTokensAccessKeyValidatorForTesting,
    resetCountTokensAccessKeyValidatorForTesting,
    setCountTokensModelAccessValidatorForTesting,
    resetCountTokensModelAccessValidatorForTesting,
    setCountTokensApiKeyMetadataResolverForTesting,
    resetCountTokensApiKeyMetadataResolverForTesting,
  } = await import("../../src/app/api/v1/messages/count_tokens/route.ts");

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ error: { message: "rate limited" } }), {
      status: 429,
      headers: { "Content-Type": "application/json" },
    });
  setCountTokensCredentialsResolverForTesting(async () => ({ apiKey: "anthropic-test-key" }));
  setCountTokensAccessKeyValidatorForTesting(async () => true);
  setCountTokensModelAccessValidatorForTesting(async () => true);
  setCountTokensApiKeyMetadataResolverForTesting(async () => ({ isActive: true }));

  try {
    const payload = {
      model: "claude/claude-sonnet-4-20250514",
      messages: [{ role: "user", content: "abcd" }],
    };

    const response = await countTokens(
      new Request(`${BASE_URL}/api/v1/messages/count_tokens`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer sk-test",
        },
        body: JSON.stringify(payload),
      })
    );

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.input_tokens, 1);
  } finally {
    globalThis.fetch = originalFetch;
    resetCountTokensCredentialsResolverForTesting();
    resetCountTokensAccessKeyValidatorForTesting();
    resetCountTokensModelAccessValidatorForTesting();
    resetCountTokensApiKeyMetadataResolverForTesting();
  }
});

test("contract: /api/v1/messages/count_tokens keeps local estimate when provider unsupported", async () => {
  const { POST: countTokens } = await import("../../src/app/api/v1/messages/count_tokens/route.ts");

  const originalFetch = globalThis.fetch;
  let fetchCalled = false;
  globalThis.fetch = async () => {
    fetchCalled = true;
    return new Response(JSON.stringify({ input_tokens: 999 }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    const payload = {
      model: "openai/gpt-4o-mini",
      messages: [{ role: "user", content: "abcd" }],
    };

    const response = await countTokens(
      new Request(`${BASE_URL}/api/v1/messages/count_tokens`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer sk-test",
        },
        body: JSON.stringify(payload),
      })
    );

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.input_tokens, 1);
    assert.equal(fetchCalled, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("contract: /api/v1/messages/count_tokens keeps local estimate when no auth signal is present", async () => {
  const {
    POST: countTokens,
    setCountTokensCredentialsResolverForTesting,
    resetCountTokensCredentialsResolverForTesting,
    setCountTokensAccessKeyValidatorForTesting,
    resetCountTokensAccessKeyValidatorForTesting,
    setCountTokensModelAccessValidatorForTesting,
    resetCountTokensModelAccessValidatorForTesting,
    setCountTokensApiKeyMetadataResolverForTesting,
    resetCountTokensApiKeyMetadataResolverForTesting,
  } = await import("../../src/app/api/v1/messages/count_tokens/route.ts");

  const originalFetch = globalThis.fetch;
  let fetchCalled = false;
  globalThis.fetch = async () => {
    fetchCalled = true;
    return new Response(JSON.stringify({ input_tokens: 999 }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
  setCountTokensCredentialsResolverForTesting(async () => ({ apiKey: "anthropic-test-key" }));
  setCountTokensAccessKeyValidatorForTesting(async () => true);
  setCountTokensModelAccessValidatorForTesting(async () => true);
  setCountTokensApiKeyMetadataResolverForTesting(async () => ({ isActive: true }));

  try {
    const payload = {
      model: "claude/claude-sonnet-4-20250514",
      messages: [{ role: "user", content: "abcd" }],
    };

    const response = await countTokens(
      new Request(`${BASE_URL}/api/v1/messages/count_tokens`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })
    );

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.input_tokens, 1);
    assert.equal(fetchCalled, false);
  } finally {
    globalThis.fetch = originalFetch;
    resetCountTokensCredentialsResolverForTesting();
    resetCountTokensAccessKeyValidatorForTesting();
    resetCountTokensModelAccessValidatorForTesting();
    resetCountTokensApiKeyMetadataResolverForTesting();
  }
});

test("contract: /api/v1/messages/count_tokens keeps local estimate when auth key is invalid", async () => {
  const {
    POST: countTokens,
    setCountTokensCredentialsResolverForTesting,
    resetCountTokensCredentialsResolverForTesting,
    setCountTokensAccessKeyValidatorForTesting,
    resetCountTokensAccessKeyValidatorForTesting,
  } = await import("../../src/app/api/v1/messages/count_tokens/route.ts");

  const originalFetch = globalThis.fetch;
  let fetchCalled = false;
  globalThis.fetch = async () => {
    fetchCalled = true;
    return new Response(JSON.stringify({ input_tokens: 999 }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
  setCountTokensCredentialsResolverForTesting(async () => ({ apiKey: "anthropic-test-key" }));
  setCountTokensAccessKeyValidatorForTesting(async () => false);

  try {
    const payload = {
      model: "claude/claude-sonnet-4-20250514",
      messages: [{ role: "user", content: "abcd" }],
    };

    const response = await countTokens(
      new Request(`${BASE_URL}/api/v1/messages/count_tokens`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer not-a-valid-key",
        },
        body: JSON.stringify(payload),
      })
    );

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.input_tokens, 1);
    assert.equal(fetchCalled, false);
  } finally {
    globalThis.fetch = originalFetch;
    resetCountTokensCredentialsResolverForTesting();
    resetCountTokensAccessKeyValidatorForTesting();
  }
});

test("contract: /api/v1/messages/count_tokens falls back when credentials resolver throws", async () => {
  const {
    POST: countTokens,
    setCountTokensCredentialsResolverForTesting,
    resetCountTokensCredentialsResolverForTesting,
    setCountTokensAccessKeyValidatorForTesting,
    resetCountTokensAccessKeyValidatorForTesting,
    setCountTokensModelAccessValidatorForTesting,
    resetCountTokensModelAccessValidatorForTesting,
    setCountTokensApiKeyMetadataResolverForTesting,
    resetCountTokensApiKeyMetadataResolverForTesting,
  } = await import("../../src/app/api/v1/messages/count_tokens/route.ts");

  const originalFetch = globalThis.fetch;
  let fetchCalled = false;
  globalThis.fetch = async () => {
    fetchCalled = true;
    return new Response(JSON.stringify({ input_tokens: 999 }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
  setCountTokensCredentialsResolverForTesting(async () => {
    throw new Error("credential backend unavailable");
  });
  setCountTokensAccessKeyValidatorForTesting(async () => true);
  setCountTokensModelAccessValidatorForTesting(async () => true);
  setCountTokensApiKeyMetadataResolverForTesting(async () => ({ isActive: true }));

  try {
    const payload = {
      model: "claude/claude-sonnet-4-20250514",
      messages: [{ role: "user", content: "abcd" }],
    };

    const response = await countTokens(
      new Request(`${BASE_URL}/api/v1/messages/count_tokens`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer sk-test",
        },
        body: JSON.stringify(payload),
      })
    );

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.input_tokens, 1);
    assert.equal(fetchCalled, false);
  } finally {
    globalThis.fetch = originalFetch;
    resetCountTokensCredentialsResolverForTesting();
    resetCountTokensAccessKeyValidatorForTesting();
    resetCountTokensModelAccessValidatorForTesting();
    resetCountTokensApiKeyMetadataResolverForTesting();
  }
});

test("contract: /api/v1/messages/count_tokens falls back when auth validator throws", async () => {
  const {
    POST: countTokens,
    setCountTokensCredentialsResolverForTesting,
    resetCountTokensCredentialsResolverForTesting,
    setCountTokensAccessKeyValidatorForTesting,
    resetCountTokensAccessKeyValidatorForTesting,
    setCountTokensModelAccessValidatorForTesting,
    resetCountTokensModelAccessValidatorForTesting,
    setCountTokensApiKeyMetadataResolverForTesting,
    resetCountTokensApiKeyMetadataResolverForTesting,
  } = await import("../../src/app/api/v1/messages/count_tokens/route.ts");

  const originalFetch = globalThis.fetch;
  let fetchCalled = false;
  globalThis.fetch = async () => {
    fetchCalled = true;
    return new Response(JSON.stringify({ input_tokens: 999 }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
  setCountTokensCredentialsResolverForTesting(async () => ({ apiKey: "anthropic-test-key" }));
  setCountTokensAccessKeyValidatorForTesting(async () => {
    throw new Error("validator backend unavailable");
  });
  setCountTokensModelAccessValidatorForTesting(async () => true);
  setCountTokensApiKeyMetadataResolverForTesting(async () => ({ isActive: true }));

  try {
    const payload = {
      model: "claude/claude-sonnet-4-20250514",
      messages: [{ role: "user", content: "abcd" }],
    };

    const response = await countTokens(
      new Request(`${BASE_URL}/api/v1/messages/count_tokens`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer sk-test",
        },
        body: JSON.stringify(payload),
      })
    );

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.input_tokens, 1);
    assert.equal(fetchCalled, false);
  } finally {
    globalThis.fetch = originalFetch;
    resetCountTokensCredentialsResolverForTesting();
    resetCountTokensAccessKeyValidatorForTesting();
    resetCountTokensModelAccessValidatorForTesting();
    resetCountTokensApiKeyMetadataResolverForTesting();
  }
});

test("contract: /api/v1/messages/count_tokens falls back on malformed upstream count response", async () => {
  const {
    POST: countTokens,
    setCountTokensCredentialsResolverForTesting,
    resetCountTokensCredentialsResolverForTesting,
    setCountTokensAccessKeyValidatorForTesting,
    resetCountTokensAccessKeyValidatorForTesting,
    setCountTokensModelAccessValidatorForTesting,
    resetCountTokensModelAccessValidatorForTesting,
    setCountTokensApiKeyMetadataResolverForTesting,
    resetCountTokensApiKeyMetadataResolverForTesting,
  } = await import("../../src/app/api/v1/messages/count_tokens/route.ts");

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ input_tokens: "42" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  setCountTokensCredentialsResolverForTesting(async () => ({ apiKey: "anthropic-test-key" }));
  setCountTokensAccessKeyValidatorForTesting(async () => true);
  setCountTokensModelAccessValidatorForTesting(async () => true);
  setCountTokensApiKeyMetadataResolverForTesting(async () => ({ isActive: true }));

  try {
    const payload = {
      model: "claude/claude-sonnet-4-20250514",
      messages: [{ role: "user", content: "abcd" }],
    };

    const response = await countTokens(
      new Request(`${BASE_URL}/api/v1/messages/count_tokens`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer sk-test",
        },
        body: JSON.stringify(payload),
      })
    );

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.input_tokens, 1);
  } finally {
    globalThis.fetch = originalFetch;
    resetCountTokensCredentialsResolverForTesting();
    resetCountTokensAccessKeyValidatorForTesting();
    resetCountTokensModelAccessValidatorForTesting();
    resetCountTokensApiKeyMetadataResolverForTesting();
  }
});

test("contract: /api/v1/messages/count_tokens uses provider path with valid x-api-key", async () => {
  const {
    POST: countTokens,
    setCountTokensCredentialsResolverForTesting,
    resetCountTokensCredentialsResolverForTesting,
    setCountTokensAccessKeyValidatorForTesting,
    resetCountTokensAccessKeyValidatorForTesting,
    setCountTokensModelAccessValidatorForTesting,
    resetCountTokensModelAccessValidatorForTesting,
    setCountTokensApiKeyMetadataResolverForTesting,
    resetCountTokensApiKeyMetadataResolverForTesting,
  } = await import("../../src/app/api/v1/messages/count_tokens/route.ts");

  const originalFetch = globalThis.fetch;
  let fetchCalled = false;
  globalThis.fetch = async () => {
    fetchCalled = true;
    return new Response(JSON.stringify({ input_tokens: 7 }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
  setCountTokensCredentialsResolverForTesting(async () => ({ apiKey: "anthropic-test-key" }));
  setCountTokensAccessKeyValidatorForTesting(async () => true);
  setCountTokensModelAccessValidatorForTesting(async () => true);
  setCountTokensApiKeyMetadataResolverForTesting(async () => ({ isActive: true }));

  try {
    const payload = {
      model: "claude/claude-sonnet-4-20250514",
      messages: [{ role: "user", content: "abcd" }],
    };

    const response = await countTokens(
      new Request(`${BASE_URL}/api/v1/messages/count_tokens`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": "rk-valid",
        },
        body: JSON.stringify(payload),
      })
    );

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.input_tokens, 7);
    assert.equal(fetchCalled, true);
  } finally {
    globalThis.fetch = originalFetch;
    resetCountTokensCredentialsResolverForTesting();
    resetCountTokensAccessKeyValidatorForTesting();
    resetCountTokensModelAccessValidatorForTesting();
    resetCountTokensApiKeyMetadataResolverForTesting();
  }
});

test("contract: /api/v1/messages/count_tokens falls back when key cannot access requested model", async () => {
  const {
    POST: countTokens,
    setCountTokensCredentialsResolverForTesting,
    resetCountTokensCredentialsResolverForTesting,
    setCountTokensAccessKeyValidatorForTesting,
    resetCountTokensAccessKeyValidatorForTesting,
    setCountTokensModelAccessValidatorForTesting,
    resetCountTokensModelAccessValidatorForTesting,
    setCountTokensApiKeyMetadataResolverForTesting,
    resetCountTokensApiKeyMetadataResolverForTesting,
  } = await import("../../src/app/api/v1/messages/count_tokens/route.ts");

  const originalFetch = globalThis.fetch;
  let fetchCalled = false;
  globalThis.fetch = async () => {
    fetchCalled = true;
    return new Response(JSON.stringify({ input_tokens: 999 }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
  setCountTokensCredentialsResolverForTesting(async () => ({ apiKey: "anthropic-test-key" }));
  setCountTokensAccessKeyValidatorForTesting(async () => true);
  setCountTokensModelAccessValidatorForTesting(async () => false);
  setCountTokensApiKeyMetadataResolverForTesting(async () => ({ isActive: true }));

  try {
    const payload = {
      model: "claude/claude-sonnet-4-20250514",
      messages: [{ role: "user", content: "abcd" }],
    };

    const response = await countTokens(
      new Request(`${BASE_URL}/api/v1/messages/count_tokens`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer sk-test",
        },
        body: JSON.stringify(payload),
      })
    );

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.input_tokens, 1);
    assert.equal(fetchCalled, false);
  } finally {
    globalThis.fetch = originalFetch;
    resetCountTokensCredentialsResolverForTesting();
    resetCountTokensAccessKeyValidatorForTesting();
    resetCountTokensModelAccessValidatorForTesting();
    resetCountTokensApiKeyMetadataResolverForTesting();
  }
});

test("contract: /api/v1/messages/count_tokens falls back to x-api-key when bearer key is invalid", async () => {
  const {
    POST: countTokens,
    setCountTokensCredentialsResolverForTesting,
    resetCountTokensCredentialsResolverForTesting,
    setCountTokensAccessKeyValidatorForTesting,
    resetCountTokensAccessKeyValidatorForTesting,
    setCountTokensModelAccessValidatorForTesting,
    resetCountTokensModelAccessValidatorForTesting,
    setCountTokensApiKeyMetadataResolverForTesting,
    resetCountTokensApiKeyMetadataResolverForTesting,
  } = await import("../../src/app/api/v1/messages/count_tokens/route.ts");

  const originalFetch = globalThis.fetch;
  let fetchCalled = false;
  globalThis.fetch = async () => {
    fetchCalled = true;
    return new Response(JSON.stringify({ input_tokens: 11 }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
  setCountTokensCredentialsResolverForTesting(async () => ({ apiKey: "anthropic-test-key" }));
  setCountTokensAccessKeyValidatorForTesting(async (key) => key === "rk-valid");
  setCountTokensModelAccessValidatorForTesting(async () => true);
  setCountTokensApiKeyMetadataResolverForTesting(async (key) => ({ isActive: key === "rk-valid" }));

  try {
    const payload = {
      model: "claude/claude-sonnet-4-20250514",
      messages: [{ role: "user", content: "abcd" }],
    };

    const response = await countTokens(
      new Request(`${BASE_URL}/api/v1/messages/count_tokens`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer rk-invalid",
          "x-api-key": "rk-valid",
        },
        body: JSON.stringify(payload),
      })
    );

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.input_tokens, 11);
    assert.equal(fetchCalled, true);
  } finally {
    globalThis.fetch = originalFetch;
    resetCountTokensCredentialsResolverForTesting();
    resetCountTokensAccessKeyValidatorForTesting();
    resetCountTokensModelAccessValidatorForTesting();
    resetCountTokensApiKeyMetadataResolverForTesting();
  }
});

test("contract: /api/v1/messages/count_tokens keeps local estimate when key is inactive", async () => {
  const {
    POST: countTokens,
    setCountTokensCredentialsResolverForTesting,
    resetCountTokensCredentialsResolverForTesting,
    setCountTokensAccessKeyValidatorForTesting,
    resetCountTokensAccessKeyValidatorForTesting,
    setCountTokensModelAccessValidatorForTesting,
    resetCountTokensModelAccessValidatorForTesting,
    setCountTokensApiKeyMetadataResolverForTesting,
    resetCountTokensApiKeyMetadataResolverForTesting,
  } = await import("../../src/app/api/v1/messages/count_tokens/route.ts");

  const originalFetch = globalThis.fetch;
  let fetchCalled = false;
  globalThis.fetch = async () => {
    fetchCalled = true;
    return new Response(JSON.stringify({ input_tokens: 999 }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  setCountTokensCredentialsResolverForTesting(async () => ({ apiKey: "anthropic-test-key" }));
  setCountTokensAccessKeyValidatorForTesting(async () => true);
  setCountTokensModelAccessValidatorForTesting(async () => true);
  setCountTokensApiKeyMetadataResolverForTesting(async () => ({ isActive: false }));

  try {
    const payload = {
      model: "claude/claude-sonnet-4-20250514",
      messages: [{ role: "user", content: "abcd" }],
    };

    const response = await countTokens(
      new Request(`${BASE_URL}/api/v1/messages/count_tokens`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer sk-disabled",
        },
        body: JSON.stringify(payload),
      })
    );

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.input_tokens, 1);
    assert.equal(fetchCalled, false);
  } finally {
    globalThis.fetch = originalFetch;
    resetCountTokensCredentialsResolverForTesting();
    resetCountTokensAccessKeyValidatorForTesting();
    resetCountTokensModelAccessValidatorForTesting();
    resetCountTokensApiKeyMetadataResolverForTesting();
  }
});
