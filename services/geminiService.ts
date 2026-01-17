import { GoogleGenAI, Type } from "@google/genai";
import { SmartMetaData, FileType } from "../types";

// Initialize the API client
// Note: In a production app, never expose keys on the client.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

/**
 * Helper to convert a File object to a Base64 string
 */
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      // Remove the data URL prefix (e.g., "data:image/jpeg;base64,")
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = (error) => reject(error);
  });
};

/**
 * Analyzes an image using Gemini to generate a description and tags.
 */
export const analyzeImage = async (file: File): Promise<SmartMetaData> => {
  try {
    const base64Data = await fileToBase64(file);

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: file.type,
              data: base64Data
            }
          },
          {
            text: "Analyze this image. Provide a short concise summary, a list of 3-5 relevant tags, and a suggested action (e.g., 'Save to Photos', 'Share with Work')."
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            tags: { type: Type.ARRAY, items: { type: Type.STRING } },
            suggestedAction: { type: Type.STRING }
          },
          required: ["summary", "tags"]
        }
      }
    });

    if (response.text) {
      return JSON.parse(response.text) as SmartMetaData;
    }
    throw new Error("No response text");

  } catch (error) {
    console.error("Gemini Image Analysis Error:", error);
    return {
      summary: "Analysis failed. Please try again.",
      tags: [],
      suggestedAction: "Retry"
    };
  }
};

/**
 * Analyzes text content using Gemini to generate a summary.
 */
export const analyzeText = async (content: string): Promise<SmartMetaData> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Analyze the following text file content. Provide a very brief 1-sentence summary, detect the language, and 3 keywords.\n\nText:\n${content.substring(0, 2000)}`, // Limit context for demo speed
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            tags: { type: Type.ARRAY, items: { type: Type.STRING } },
            language: { type: Type.STRING }
          }
        }
      }
    });

    if (response.text) {
      return JSON.parse(response.text) as SmartMetaData;
    }
    throw new Error("No response text");

  } catch (error) {
    console.error("Gemini Text Analysis Error:", error);
    return {
      summary: "Text analysis failed.",
      tags: []
    };
  }
};

/**
 * Router function to determine which analysis to run
 */
export const processFileWithGemini = async (file: File, type: FileType): Promise<SmartMetaData> => {
  if (!process.env.API_KEY) {
    return { summary: "API Key missing. Cannot analyze.", tags: [] };
  }

  if (type === FileType.IMAGE) {
    return await analyzeImage(file);
  } else if (type === FileType.TEXT) {
    const text = await file.text();
    return await analyzeText(text);
  }
  
  return { summary: "File type not supported for automatic analysis.", tags: [] };
};
