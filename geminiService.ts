
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const analyzeVibe = async (content: string): Promise<{ vibe: string; quote: string }> => {
  if (!content.trim()) return { vibe: "Peaceful", quote: "The journey of a thousand miles begins with a single step." };

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Analyze the mood of this journal entry and provide a short vibe (1-3 words) and an inspiring quote: "${content}"`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            vibe: { type: Type.STRING },
            quote: { type: Type.STRING }
          },
          required: ["vibe", "quote"]
        }
      }
    });

    const data = JSON.parse(response.text || "{}");
    return {
      vibe: data.vibe || "Reflective",
      quote: data.quote || "Your mind is a garden, your thoughts are the seeds."
    };
  } catch (error) {
    console.error("Gemini Vibe Analysis Error:", error);
    return { vibe: "Reflective", quote: "Keep moving forward." };
  }
};

export const getWeatherForLocation = async (location: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Provide only one single emoji representing the typical or current weather for this location: "${location}". Return only the emoji.`,
    });
    return response.text.trim() || "☁️";
  } catch {
    return "✨";
  }
};

export const suggestLocations = async (input: string): Promise<string[]> => {
  if (input.length < 2) return [];
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Provide a JSON array of 5 real-world location names (City, Country) that start with or are highly relevant to: "${input}"`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        }
      }
    });
    return JSON.parse(response.text || "[]");
  } catch {
    return [];
  }
};

/**
 * Simulates lifting a subject from an image.
 */
export const extractSubject = async (base64Image: string): Promise<boolean> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        { text: "Identify the main subject of this image for background removal. Is there a clear object or person?" },
        { inlineData: { mimeType: "image/jpeg", data: base64Image.split(',')[1] } }
      ]
    });
    return !!response.text;
  } catch (error) {
    console.error("Subject extraction error:", error);
    return true;
  }
};
