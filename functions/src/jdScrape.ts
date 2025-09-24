import { onCall } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import OpenAI from "openai";
import { db } from "./admin";
import axios from "axios";

const CRAWLER_URL =
  process.env.CRAWLER_URL ||
  "https://jd-crawler-696276064956.asia-northeast3.run.app/scrape";

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

    let rawText = "";
    try {
      // ✅ Cloud Run 호출
      const { data } = await axios.post(
        CRAWLER_URL,
        { url },
        { timeout: 60000 } // 60초 타임아웃
      );

      rawText = data.text || "";
      if (rawText.length < 100) {
        logger.warn("[jdScrape] Extracted text too short", { url, rawText });
        throw new Error("No meaningful content found.");
      }
    } catch (err: any) {
      logger.error("[jdScrape] Cloud Run call failed", err);
      throw new Error("Crawler service unavailable or failed.");
    }

    // ✅ OpenAI 처리
    let jdData: any = {};
    try {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You are a recruitment expert. Extract key info as JSON: { keywords: string[], main_responsibilities: string[], preferred_qualifications: string[] }",
          },
          { role: "user", content: rawText.substring(0, 8000) },
        ],
        response_format: { type: "json_object" },
      });

      const resultJson = completion.choices[0].message.content;
      if (!resultJson) throw new Error("OpenAI returned empty response");

      try {
        jdData = JSON.parse(resultJson);
      } catch (e) {
        logger.error("[jdScrape] JSON parse error", resultJson);
        throw new Error("Invalid AI response format");
      }
    } catch (err: any) {
      logger.error("[jdScrape] OpenAI call failed", err);
      throw new Error("AI parsing failed.");
    }

    // ✅ Firestore 저장
    try {
      await db.doc(`sessions/${sessionId}`).set(
        {
          jdKeywords: jdData.keywords || [],
          jdResponsibilities: jdData.main_responsibilities || [],
          jdQualifications: jdData.preferred_qualifications || [],
          jdUrl: url,
          isPro: true,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    } catch (err) {
      logger.error("[jdScrape] Firestore save failed", err);
      throw new Error("Failed to save JD data.");
    }

    logger.info("[jdScrape] Success", {
      sessionId,
      keywords: jdData.keywords,
    });

    return { success: true, keywords: jdData.keywords };
  }
);
