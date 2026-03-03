const MODELS = [
  'gemini-2.0-flash',
  'gemini-1.5-flash',
];

async function callWithFallback(apiKey, requestBody) {
  let lastResponse = null;

  for (const model of MODELS) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    let gotRateLimited = false;

    for (let attempt = 0; attempt < 3; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      let response;
      try {
        response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
          signal: controller.signal
        });
      } catch (err) {
        clearTimeout(timeoutId);
        if (err.name === 'AbortError') throw new Error('TIMEOUT');
        throw new Error('NETWORK_ERROR');
      }
      clearTimeout(timeoutId);

      lastResponse = response;

      if (response.status === 429) {
        gotRateLimited = true;
        if (attempt < 2) {
          await new Promise(r => setTimeout(r, 3000 * (attempt + 1)));
          continue;
        }
        break;
      }

      if (response.status === 404) {
        break;
      }

      return response;
    }

    if (gotRateLimited) {
      continue;
    }
  }

  if (lastResponse) return lastResponse;
  throw new Error('RATE_LIMITED');
}

function parseGeminiResult(data) {
  // Check for blocked content
  if (data.promptFeedback?.blockReason) {
    console.error('Gemini blocked request:', data.promptFeedback);
    throw new Error('CONTENT_BLOCKED');
  }

  const candidate = data.candidates?.[0];
  if (!candidate) throw new Error('EMPTY_RESPONSE');

  // Check if candidate was blocked by safety filters
  if (candidate.finishReason === 'SAFETY') {
    console.error('Gemini safety filter:', candidate.safetyRatings);
    throw new Error('CONTENT_BLOCKED');
  }

  const text = candidate.content?.parts?.[0]?.text;
  if (!text) throw new Error('EMPTY_RESPONSE');

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('PARSE_ERROR');

  let result;
  try {
    result = JSON.parse(jsonMatch[0]);
  } catch {
    throw new Error('PARSE_ERROR');
  }

  if (typeof result.name !== 'string' || typeof result.calories !== 'number') {
    throw new Error('INVALID_FORMAT');
  }

  return {
    name: result.name,
    calories: Math.round(result.calories),
    protein: Math.round(result.protein || 0),
    carbs: Math.round(result.carbs || 0),
    fat: Math.round(result.fat || 0),
    confidence: result.confidence || 'medium',
    portion: result.portion || ''
  };
}

async function callAndParse(apiKey, requestBody) {
  const response = await callWithFallback(apiKey, requestBody);

  if (!response.ok) {
    if (response.status === 400) {
      const errBody = await response.text().catch(() => '');
      console.error('Gemini 400 error:', errBody);
      throw new Error('BAD_REQUEST');
    }
    if (response.status === 403) throw new Error('INVALID_API_KEY');
    if (response.status === 429) throw new Error('RATE_LIMITED');
    const errBody = await response.text().catch(() => '');
    console.error(`Gemini API error ${response.status}:`, errBody);
    throw new Error(`API_ERROR`);
  }

  const data = await response.json();
  return parseGeminiResult(data);
}

export async function analyzeFood(base64Image, mimeType, apiKey) {
  if (!apiKey) throw new Error('NO_API_KEY');

  const requestBody = {
    contents: [{
      parts: [
        {
          text: `Identify the food in this image. Estimate the portion size based on visual cues.
Return ONLY a JSON object with these exact fields, no other text:
{
  "name": "food name",
  "calories": number,
  "protein": number,
  "carbs": number,
  "fat": number,
  "confidence": "high" | "medium" | "low",
  "portion": "estimated portion description"
}
If you cannot identify food in the image, return:
{"name": "Unknown", "calories": 0, "protein": 0, "carbs": 0, "fat": 0, "confidence": "low", "portion": "unknown"}`
        },
        {
          inlineData: {
            mimeType: mimeType,
            data: base64Image
          }
        }
      ]
    }]
  };

  return callAndParse(apiKey, requestBody);
}

export async function lookupFood(description, apiKey) {
  if (!apiKey) throw new Error('NO_API_KEY');

  const requestBody = {
    contents: [{
      parts: [{
        text: `Look up the nutritional information for: ${description}

Return ONLY a JSON object with these exact fields, no other text:
{
  "name": "food name (be specific)",
  "calories": number,
  "protein": number (grams),
  "carbs": number (grams),
  "fat": number (grams),
  "confidence": "high" | "medium" | "low",
  "portion": "portion size used for the estimate"
}

Use standard USDA nutritional data. If a portion size is specified, use it. Otherwise estimate a typical serving.`
      }]
    }]
  };

  return callAndParse(apiKey, requestBody);
}
