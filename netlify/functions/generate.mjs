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

  const { system, prompt } = body;

  // Build Gemini request
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
      maxOutputTokens: 1500,
      temperature: 0.7,
    },
  };

  const model = "gemini-1.5-flash";
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
