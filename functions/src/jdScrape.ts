// functions/src/jdScrape.ts
import { onCall } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import OpenAI from "openai";
import { db } from "./admin";
import axios from "axios";
import * as cheerio from "cheerio"; // 👈 jsdom 대신 cheerio 사용
import { URL } from "url";

async function scrapeTextFromUrl(url: string): Promise<string> {
    try {
        const { data } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7'
            }
        });
        const $ = cheerio.load(data);
        // 주요 채용 사이트에 맞춰 선택자 개선
        const u = new URL(url);
        let text = "";
        if (u.hostname.includes('jobkorea.co.kr')) text = $(".detailArea, .recruitment-content").text();
        else if (u.hostname.includes('wanted.co.kr')) text = $("[data-testid=JobDescription]").text();
        else if (u.hostname.includes('saramin.co.kr')) text = $(".user_content, #content").text();
        else text = $("main").text() || $("article").text() || $("body").text();
        
        return text.replace(/\s\s+/g, ' ').trim();
    } catch (error) {
        logger.error(`Error scraping URL ${url}:`, error);
        throw new Error('Failed to scrape the provided URL.');
    }
}

export const parseJdFromUrl = onCall(
  {
    region: "asia-northeast3",
    cors: true,
    secrets: ["OPENAI_API_KEY"],
  },
  async (request) => {
    const { url, sessionId } = request.data;
    if (!url || !sessionId) {
      throw new Error("URL and sessionId are required.");
    }

    logger.info(`[jdScrape] Starting for session: ${sessionId}, URL: ${url}`);

    const rawText = await scrapeTextFromUrl(url);
    if (rawText.length < 100) {
      throw new Error("Could not extract meaningful content from the URL.");
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a recruitment expert. Analyze the provided job description text and extract key information. Return a JSON object with the structure: { "keywords": string[], "main_responsibilities": string[], "preferred_qualifications": string[] }. "keywords" should be a list of 10-15 core technical skills and competencies.`
        },
        { role: "user", content: `Extract key info from this JD: \n\n${rawText.substring(0, 8000)}` },
      ],
      response_format: { type: "json_object" },
    });
    
    const resultJson = completion.choices[0].message.content;
    if (!resultJson) {
      throw new Error("OpenAI failed to parse the JD.");
    }

    const jdData = JSON.parse(resultJson);

    const sessionRef = db.doc(`sessions/${sessionId}`);
    await sessionRef.set({
      jdKeywords: jdData.keywords || [],
      jdResponsibilities: jdData.main_responsibilities || [],
      jdQualifications: jdData.preferred_qualifications || [],
      jdUrl: url,
      isPro: true,
    }, { merge: true });

    logger.info(`[jdScrape] Successfully parsed and saved JD for session: ${sessionId}`);
    return { success: true, keywords: jdData.keywords };
  }
);