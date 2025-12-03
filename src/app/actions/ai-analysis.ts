'use server';

import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY!);

export async function analyzeTrade(tradeData: any, includeChart: boolean = false) {
  try {
    // Use configured model or default to latest stable flash model which supports multimodal input
    const modelName = process.env.GOOGLE_GEMINI_MODEL || "gemini-1.5-flash-latest";
    const model = genAI.getGenerativeModel({ model: modelName });

    const promptText = `
    You are an expert trading coach. Analyze the following trade data ${includeChart ? 'and the attached chart image' : ''} and provide constructive feedback.
    Be like a strict but helpful teacher. Point out mistakes based on the notes, quantitative data, ${includeChart ? 'technical analysis from the chart,' : ''} and praise good habits.

    Trade Details:
    - Instrument: ${tradeData.instrument}
    - Direction: ${tradeData.direction}
    - PnL: ${tradeData.pnl}
    - Setup: ${tradeData.setup}
    - Entry Time: ${new Date(tradeData.time).toLocaleString()}
    - Exit Time: ${new Date(tradeData.endTime).toLocaleString()}

    Notes:
    - Entry: ${tradeData.notes.entry}
    - Exit: ${tradeData.notes.exit}
    - Management: ${tradeData.notes.mgmt}
    - General: ${tradeData.notes.general}

    Tags:
    - Mistakes: ${tradeData.mistakes.join(', ')}
    - Good Habits: ${tradeData.successes.join(', ')}
    - Mindset: ${tradeData.mindsets.join(', ')}

    Executions:
    ${JSON.stringify(tradeData.executions)}

    Provide a concise analysis (max 300 words) focusing on:
    1. Execution & Timing
    2. Risk Management
    3. Psychology/Mindset
    4. Actionable tip for next time.
    `;

    const parts: any[] = [promptText];

    if (includeChart && tradeData.chartImage) {
        let base64Data = '';
        let mimeType = 'image/png'; // Default

        if (tradeData.chartImage.startsWith('data:image')) {
            // Extract base64 data
            const match = tradeData.chartImage.match(/^data:(image\/[a-z]+);base64,(.+)$/);
            if (match) {
                mimeType = match[1];
                base64Data = match[2];
            }
        } else if (tradeData.chartImage.startsWith('http')) {
            // Fetch remote image
            try {
                const imgRes = await fetch(tradeData.chartImage);
                const arrayBuffer = await imgRes.arrayBuffer();
                const buffer = Buffer.from(arrayBuffer);
                base64Data = buffer.toString('base64');
                mimeType = imgRes.headers.get('content-type') || 'image/png';
            } catch (e) {
                console.error("Failed to fetch image for AI:", e);
            }
        }

        if (base64Data) {
            parts.push({
                inlineData: {
                    data: base64Data,
                    mimeType: mimeType
                }
            });
        }
    }

    const result = await model.generateContent(parts);
    const response = await result.response;
    return { success: true, text: response.text() };
  } catch (error) {
    console.error("AI Analysis Error:", error);
    return { success: false, error: "Failed to generate analysis." };
  }
}
