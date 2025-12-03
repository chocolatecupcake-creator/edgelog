'use server';

import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY!);

export async function analyzeTrade(tradeData: any) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `
    You are an expert trading coach. Analyze the following trade data and provide constructive feedback.
    Be like a strict but helpful teacher. Point out mistakes based on the notes and quantitative data, and praise good habits.

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

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return { success: true, text: response.text() };
  } catch (error) {
    console.error("AI Analysis Error:", error);
    return { success: false, error: "Failed to generate analysis." };
  }
}
