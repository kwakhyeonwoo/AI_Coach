import { onCall } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import OpenAI from "openai";
import { db } from "./admin";
import axios from "axios";

const CRAWLER_URL = "https://jd-crawler-696276064956.asia-northeast3.run.app/scrape";

export const parseJdFromUrl = onCall(
  {
    region: "asia-northeast3",
    cors: true,
    secrets: ["OPENAI_API_KEY"],
  },
  async (request) => {
    const { url, sessionId } = request.data;
    if (!url || !sessionId) throw new Error("URL and sessionId are required.");

    logger.info(`[jdScrape] Start: ${url}`);

    // ✅ Cloud Run 호출
    const { data } = await axios.post(CRAWLER_URL, { url });
    const rawText = data.text || "";
    if (rawText.length < 100) throw new Error("No meaningful content found.");

    // ✅ OpenAI 처리
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a recruitment expert. Extract key info as JSON: { keywords: string[], main_responsibilities: string[], preferred_qualifications: string[] }`,
        },
        { role: "user", content: rawText.substring(0, 8000) },
      ],
      response_format: { type: "json_object" },
    });

    const resultJson = completion.choices[0].message.content;
    if (!resultJson) throw new Error("OpenAI parsing failed.");

    const jdData = JSON.parse(resultJson);

    // ✅ Firestore 저장
    await db.doc(`sessions/${sessionId}`).set(
      {
        jdKeywords: jdData.keywords || [],
        jdResponsibilities: jdData.main_responsibilities || [],
        jdQualifications: jdData.preferred_qualifications || [],
        jdUrl: url,
        isPro: true,
      },
      { merge: true }
    );

    return { success: true, keywords: jdData.keywords };
  }
);
