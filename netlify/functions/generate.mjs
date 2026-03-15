export default async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: { message: "GEMINI_API_KEY is not set in environment variables." } }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: { message: "Invalid JSON body." } }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Read all three fields — maxTokens is now passed from the frontend per tone
  const { system, prompt, maxTokens } = body;

  // gemini-2.5-flash is a thinking model — it uses tokens internally for reasoning
  // before generating visible text. Without thinkingBudget, those tokens eat into
  // your output limit and the report cuts off mid-sentence.
  // We cap thinking at 1024 tokens and add that on top of the visible output budget.
  const visibleTokens  = maxTokens || 1500;
  const thinkingBudget = 1024;

  const geminiPayload = {
    system_instruction: {
      parts: [{ text: system }],
    },
    contents: [
      {
        role: "user",
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      maxOutputTokens: visibleTokens + thinkingBudget,
      temperature: 0.2,
      thinkingConfig: {
        thinkingBudget: thinkingBudget,
      },
    },
  };

  const model = "gemini-2.5-flash";
  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;

  const geminiResponse = await fetch(geminiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(geminiPayload),
  });

  if (!geminiResponse.ok) {
    const errorText = await geminiResponse.text();
    return new Response(errorText, {
      status: geminiResponse.status,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Pass the SSE stream straight through to the browser
  return new Response(geminiResponse.body, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
    },
  });
};

export const config = {
  path: "/api/generate",
};
