// functions/src/buildSummary.ts
import * as functions from "firebase-functions/v2";
import { onRequest } from "firebase-functions/v2/https";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "./admin";
import OpenAI from "openai";

interface QADoc {
  questionText: string;
  transcript: string;
  metrics?: { durationSec?: number };
}

const TEMP_UID = "test-user-001";

export const buildSummary = onRequest(
  {
    region: "asia-northeast3",
    cors: true,
    secrets: ["OPENAI_API_KEY"],
    timeoutSeconds: 300,
    memory: "1GiB",
  },
  async (req, res) => {
    try {
      const sessionId =
        (req.query?.sessionId as string) ||
        (typeof req.body === "object" ? (req.body?.sessionId as string) : undefined);
      if (!sessionId) {
        res.status(400).json({ error: "sessionId is required" });
        return;
      }

      const uid = TEMP_UID;
      const sessionRef = db.collection("users").doc(uid).collection("sessions").doc(sessionId);
      functions.logger.info(`[buildSummary] Starting for session: ${sessionId}`);

      // 🔹 status 먼저 업데이트
      await sessionRef.set(
        { status: "processing", updatedAt: FieldValue.serverTimestamp() },
        { merge: true }
      );

      const sessionSnap = await sessionRef.get();
      if (!sessionSnap.exists) {
        throw new Error(`Session not found: users/${uid}/sessions/${sessionId}`);
      }
      const sessionData = sessionSnap.data()!;

      // 🔹 QA 가져오기
      const qaCol = sessionRef.collection("qa");
      const qaSnap = await qaCol.orderBy("createdAt", "asc").get();

      const qaListForAI = qaSnap.docs.map((doc) => ({
        id: doc.id,
        questionText: (doc.data() as QADoc).questionText,
        transcript: (doc.data() as QADoc).transcript,
      }));

      if (qaListForAI.length === 0) {
        throw new Error(`No QA documents found for session: ${sessionId}`);
      }

      const isProSession = sessionData.isPro === true && sessionData.jdKeywords?.length > 0;
      const jdKeywords = isProSession ? sessionData.jdKeywords : [];

      // 🔹 시스템 프롬프트
      const systemPrompt = `
        You are an expert AI interview coach. I will provide interview data in JSON format. 
        Your task is to analyze it and return a single JSON evaluation object.
        
        ${isProSession 
          ? `// PRO MODE: Evaluate based on JD keywords: [${jdKeywords.join(", ")}]`
          : `// FREE MODE: General best practices.`}

        JSON format:
        {
          "overallScore": number,
          "level": "Beginner" | "Intermediate" | "Advanced",
          "strengths": string[],
          "improvements": string[],
          "tips": string[],
          "qa": {
            "id": string,
            "questionText": string,
            "answerSummary": string,
            "modelAnswer": string,
            "feedback": string,
            "score": number,
            "tags": string[],
            "jdKeywordCoverage": boolean,
            "metricSpecificity": boolean
          }[]
        }
      `;

      // 🔹 사용자 프롬프트
      const userPrompt = `
        Process the following interview data:
        Role: ${sessionData.role || "general"}
        Company: ${sessionData.companyId || "N/A"}
        
        Q&A JSON:
        ${JSON.stringify(qaListForAI, null, 2)}
      `;

      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.5,
        response_format: { type: "json_object" },
      });

      const resultJson = completion.choices[0].message.content;
      if (!resultJson) {
        throw new Error("OpenAI returned an empty response.");
      }
      const summaryData = JSON.parse(resultJson);

      // 🔹 최종 저장할 데이터
      const finalPayload = {
        ...summaryData,
        uid,
        sessionId,
        startedAt: sessionData.startedAt,
        endedAt: sessionData.endedAt ?? FieldValue.serverTimestamp(),
        totalQuestions: qaListForAI.length,
        totalSpeakingSec: qaSnap.docs.reduce(
          (sum, doc) => sum + ((doc.data() as QADoc).metrics?.durationSec || 0),
          0
        ),
        status: "ready",
        updatedAt: FieldValue.serverTimestamp(),
      };

      // ✅ summaries 컬렉션 대신 users/{uid}/sessions/{sessionId}에 저장
      await sessionRef.set({ summary: finalPayload, ...finalPayload }, { merge: true });

      functions.logger.info(`[buildSummary] Successfully generated summary for session: ${sessionId}`);
      res.status(200).json({ success: true, sessionId });
    } catch (e: any) {
      functions.logger.error("[buildSummary] Fatal error", {
        message: e?.message,
        stack: e?.stack,
        sessionId: req.query?.sessionId ?? req.body?.sessionId,
      });

      const sessionId = req.query?.sessionId ?? req.body?.sessionId;
      if (sessionId) {
        const uid = TEMP_UID;
        const sessionRef = db.doc(`users/${uid}/sessions/${sessionId}`);
        await sessionRef.set(
          { status: "error", error: e?.message ?? "Unknown error" },
          { merge: true }
        );
      }
      res.status(500).json({ error: e?.message ?? "Failed to build summary" });
    }
  }
);
