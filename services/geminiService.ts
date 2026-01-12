
import { GoogleGenAI } from "@google/genai";

export const getFinancialHealthAnalysis = async (financialData: any) => {
  // Create a new instance right before the call to ensure the latest API key is used
  const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });
  try {
    const prompt = `
      Analyze the following financial data for Unit 48 Payment System:
      ${JSON.stringify(financialData)}
      
      Provide a brief (max 150 words) professional summary of the unit's financial health, collection efficiency, and any anomalies or risks you detect.
      Suggest one actionable improvement for the Unit Admin.
      Format the response in professional financial language.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    // Access .text property directly as per guidelines
    return response.text;
  } catch (error) {
    console.error("Gemini analysis failed:", error);
    return "Financial health analysis currently unavailable. Please review reports manually.";
  }
};
