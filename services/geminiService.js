const { GoogleGenerativeAI } = require('@google/generative-ai');

// The Gemini API key will be loaded from process.env.GEMINI_API_KEY
// We initialize the client lazily so that server startup doesn't crash if the key is missing initially
let genAI = null;

const getGenAIInstance = () => {
  if (!genAI) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn('WARNING: GEMINI_API_KEY environment variable is not defined. AI summarization will fail.');
      return null;
    }
    genAI = new GoogleGenerativeAI(apiKey);
  }
  return genAI;
};

/**
 * Summarizes the provided text using the Gemini API (gemini-1.5-flash).
 * Expects a JSON response with 'summary' (string) and 'keyPoints' (array of strings).
 * Returns null if summarization fails.
 * 
 * @param {string} text The original note content
 * @returns {Promise<{summary: string, keyPoints: string[]}|null>}
 */
const summarizeText = async (text) => {
  try {
    const aiClient = getGenAIInstance();
    if (!aiClient) {
      throw new Error('Gemini API client not initialized. Check your GEMINI_API_KEY.');
    }

    const model = aiClient.getGenerativeModel({
  model: "gemini-2.5-flash",
  generationConfig: {
    responseMimeType: "application/json"
  }
});

    const prompt = `
You are a text summarization assistant. Analyze the text provided below.
Your task is to:
1. Generate a short, concise summary (exactly 2 to 4 sentences).
2. Extract 3 to 5 key points as a list of distinct, informative bullet items.

You MUST respond ONLY with a valid JSON object in the following format:
{
  "summary": "Write the 2-4 sentence summary here",
  "keyPoints": [
    "Key point 1 details",
    "Key point 2 details",
    "Key point 3 details"
  ]
}

Ensure the output is valid JSON. Do not include any explanation, markdown formatting (do not wrap in \`\`\`json), or extra text.

Text to analyze:
${text}
`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    
    // Parse response text
    let parsedData;
    try {
      parsedData = JSON.parse(responseText.trim());
    } catch (parseError) {
      console.error('Failed to parse JSON response from Gemini API. Response was:', responseText);
      // Fallback: try stripping markdown code blocks if the model ignored our formatting instruction
      let cleanText = responseText.trim();
      if (cleanText.startsWith('```')) {
        cleanText = cleanText.replace(/^```(json)?\s*/i, '').replace(/```$/, '').trim();
        parsedData = JSON.parse(cleanText);
      } else {
        throw parseError;
      }
    }

    // Validate structure of parsed output
    if (!parsedData || typeof parsedData.summary !== 'string' || !Array.isArray(parsedData.keyPoints)) {
      throw new Error('Invalid JSON structure returned by Gemini API');
    }

    return {
      summary: parsedData.summary,
      keyPoints: parsedData.keyPoints
    };
  } catch (error) {
    console.error('Error in geminiService.summarizeText:', error.message);
    return null; // Return null so note can still be saved without summary
  }
};

module.exports = {
  summarizeText
};
