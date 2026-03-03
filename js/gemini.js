const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

async function fetchWithRetry(url, options, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    const response = await fetch(url, options);
    if (response.status === 429 && i < maxRetries - 1) {
      // Wait 2s, 4s, then 8s between retries
      await new Promise(r => setTimeout(r, 2000 * Math.pow(2, i)));
      continue;
    }
    return response;
  }
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

  let response;
  try {
    response = await fetchWithRetry(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });
  } catch {
    throw new Error('NETWORK_ERROR');
  }

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
