const MODELS = [
  'gemini-2.0-flash',
  'gemini-1.5-flash',
];

async function callWithFallback(apiKey, requestBody) {
  for (const model of MODELS) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    for (let attempt = 0; attempt < 3; attempt++) {
      let response;
      try {
        response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody)
        });
      } catch {
        throw new Error('NETWORK_ERROR');
      }
      if (response.status === 429 && attempt < 2) {
        await new Promise(r => setTimeout(r, 3000 * (attempt + 1)));
        continue;
      }
      if (response.status === 404 || response.status === 400) {
        break; // Model not available, try next model
      }
      return response;
    }
  }
  throw new Error('RATE_LIMITED');
}

export async function analyzeFood(base64Image, mimeType, apiKey) {
  if (!apiKey) {
    throw new Error('NO_API_KEY');
  }

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

  const response = await callWithFallback(apiKey, requestBody);

  if (!response.ok) {
    if (response.status === 400 || response.status === 403) throw new Error('INVALID_API_KEY');
    if (response.status === 429) throw new Error('RATE_LIMITED');
    throw new Error(`API_ERROR: ${response.status}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

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
