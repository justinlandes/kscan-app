// app/api/analyze+api.js

// Set GEMINI_API_KEY in your .env file
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const SYSTEM_PROMPT = `You are a high-fashion stylist. Analyze this image and provide:
1. A brief, professional style breakdown and one pairing suggestion (2-4 sentences).
2. Then exactly three lines in this format so we can parse them:
Category: [e.g. Streetwear, Minimalist, Classic]
Color: [dominant palette]
Silhouette: [e.g. Oversized, Fitted, Layered]
Reply with the analysis first, then the three lines.`;

function extractImageParts(imageInput) {
  if (!imageInput || typeof imageInput !== 'string') {
    return { mimeType: '', data: '' };
  }

  const match = imageInput.match(/^data:(image\/[\w.+-]+);base64,(.+)$/);
  if (match) {
    return {
      mimeType: match[1],
      data: match[2],
    };
  }

  return {
    mimeType: 'image/jpeg',
    data: imageInput,
  };
}

function parseMetadata(text) {
  const category =
    (text.match(/Category:\s*(.+?)(?=\n|$)/i) || [])[1]?.trim() || '';
  const color =
    (text.match(/Color:\s*(.+?)(?=\n|$)/i) || [])[1]?.trim() || '';
  const silhouette =
    (text.match(/Silhouette:\s*(.+?)(?=\n|$)/i) || [])[1]?.trim() || '';

  return { category, color, silhouette };
}

function stripMetadataFromResult(text) {
  return text
    .replace(/\n\s*Category:\s*[^\n]+/gi, '')
    .replace(/\n\s*Color:\s*[^\n]+/gi, '')
    .replace(/\n\s*Silhouette:\s*[^\n]+/gi, '')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

export async function POST(request) {
  try {
    if (!GEMINI_API_KEY) {
      console.error('Missing GEMINI_API_KEY');
      return Response.json(
        {
          result: 'Server is missing GEMINI_API_KEY in the .env file.',
          metadata: { category: '', color: '', silhouette: '' },
        },
        { status: 500 }
      );
    }

    const { image } = await request.json();
    const { mimeType, data } = extractImageParts(image);

    if (!data) {
      return Response.json(
        {
          result: 'No image data received. Please try taking the photo again.',
          metadata: { category: '', color: '', silhouette: '' },
        },
        { status: 400 }
      );
    }

    const geminiUrl =
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`;

    console.log('[K-SCAN] model:', 'gemini-2.0-flash-exp');

    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: SYSTEM_PROMPT },
              {
                inline_data: {
                  mime_type: mimeType || 'image/jpeg',
                  data,
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 1024,
          topP: 0.95,
        },
      }),
    });

    const json = await response.json();

    console.log('[K-SCAN] gemini status:', response.status);
    console.log('[K-SCAN] response keys:', Object.keys(json));
    console.log('[K-SCAN] candidates[0]:', JSON.stringify(json?.candidates?.[0]));
    console.log('[K-SCAN] promptFeedback:', JSON.stringify(json?.promptFeedback));
    console.log('[K-SCAN] error:', JSON.stringify(json?.error));

    if (!response.ok) {
      const message =
        json?.error?.message || `Gemini API error: ${response.status}`;
      console.error('Gemini API error:', message);

      return Response.json(
        {
          result: `Analysis failed: ${message}. Check your API key and quota.`,
          metadata: { category: '', color: '', silhouette: '' },
        },
        { status: 502 }
      );
    }

    const textPart = json?.candidates?.[0]?.content?.parts?.[0];
    const rawText =
      typeof textPart?.text === 'string' ? textPart.text.trim() : '';

    console.log('[K-SCAN] rawText:', JSON.stringify(rawText));

    if (rawText) {
      const metadata = parseMetadata(rawText);
      console.log('[K-SCAN] parsed metadata:', JSON.stringify(metadata));
      const result = stripMetadataFromResult(rawText) || rawText;
      console.log('[K-SCAN] final response:', JSON.stringify({ result, metadata }));

      return Response.json(
        { result, metadata },
        { status: 200 }
      );
    }

    const blockReason =
      json?.promptFeedback?.blockReason ||
      json?.candidates?.[0]?.finishReason;

    if (blockReason) {
      return Response.json(
        {
          result: `Analysis was not generated (${blockReason}). Try a different photo.`,
          metadata: { category: '', color: '', silhouette: '' },
        },
        { status: 200 }
      );
    }

    return Response.json(
      {
        result: "AI couldn't describe this look. Try a clearer, full-outfit photo.",
        metadata: { category: '', color: '', silhouette: '' },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Server Error:', error);

    return Response.json(
      {
        result: 'Server error while analyzing image. Please try again.',
        metadata: { category: '', color: '', silhouette: '' },
      },
      { status: 500 }
    );
  }
}