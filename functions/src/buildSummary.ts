// functions/src/buildSummary.ts
import { onRequest } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import { db } from "./admin";
import { FieldValue } from "firebase-admin/firestore";
import OpenAI from "openai";

type QADoc = {
  questionText: string;
  transcript: string;
  metrics?: {
    durationSec?: number;
  };
};

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

      const summaryRef = db.doc(`summaries/${sessionId}`);
      logger.info(`[buildSummary] Starting for session: ${sessionId}`);
      
      await summaryRef.set({ status: 'processing', updatedAt: FieldValue.serverTimestamp() }, { merge: true });

      const sessionRef = db.collection("sessions").doc(sessionId);
      const sessionSnap = await sessionRef.get();
      if (!sessionSnap.exists) {
        throw new Error(`Session not found: ${sessionId}`);
      }
      const sessionData = sessionSnap.data()!;

      const qaCol = sessionRef.collection("qa");
      const qaSnap = await qaCol.orderBy("createdAt", "asc").get();
      
      // ✅ 1. AI에게 전달할 데이터 목록 생성 (id 포함)
      const qaListForAI = qaSnap.docs.map((doc) => ({
        id: doc.id, // "q1", "q2", ...
        questionText: (doc.data() as QADoc).questionText,
        transcript: (doc.data() as QADoc).transcript,
      }));

      if (qaListForAI.length === 0) {
        throw new Error(`No QA documents found for session: ${sessionId}`);
      }

      // ✅ 2. 시스템 프롬프트를 JSON 입/출력에 맞게 수정하고 ID 보존을 명확히 지시
      const systemPrompt = `
        You are an expert AI interview coach. I will provide a JSON array of interview data. Analyze it and return a single JSON object with a comprehensive evaluation.
        The final JSON object MUST have the following structure: { "overallScore": number, "level": "Beginner" | "Intermediate" | "Advanced", "strengths": string[], "improvements": string[], "tips": string[], "qa": { "id": string, "questionText": string, "answerSummary": string, "score": number, "tags": string[], "sentiment": "positive" | "neutral" | "negative" }[] }.
        - All text must be in Korean.
        - The "qa" array you return MUST contain an object for EVERY question in the input JSON.
        - Preserve the original "id" and "questionText" for each item in the "qa" array. Do not skip any questions.
        - If a transcript is "(답변 스킵됨)", reflect this in your summary and assign a low score.
        - 'strengths', 'improvements', 'tips' must each be an array of 3 short, actionable Korean sentences.
      `;

      // ✅ 3. 사용자 프롬프트에 단순 텍스트 대신 JSON 문자열을 전달
      const userPrompt = `
        Process the following interview data according to the system instructions.
        
        Interview Context:
        Role: ${sessionData.role || "general"}
        Company (optional): ${sessionData.companyId || "N/A"}

        Q&A List (JSON):
        ${JSON.stringify(qaListForAI, null, 2)}
      `;

      logger.info(`[buildSummary] Calling OpenAI for session: ${sessionId}`);
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini", // 최신 모델 사용 권장
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

      // ✅ 4. AI가 생성한 qa 배열의 길이를 확인하여 누락 여부 검증
      if (summaryData.qa?.length !== qaListForAI.length) {
          logger.warn(`[buildSummary] Mismatch in QA length. Expected ${qaListForAI.length}, got ${summaryData.qa?.length}`, { sessionId });
          // 여기서 에러 처리를 하거나, 누락된 질문을 수동으로 추가하는 로직을 넣을 수도 있습니다.
      }
      
      const finalPayload = {
        ...summaryData,
        uid: sessionData.uid,
        sessionId,
        startedAt: sessionData.startedAt,
        endedAt: sessionData.endedAt ?? FieldValue.serverTimestamp(),
        totalQuestions: qaListForAI.length,
        totalSpeakingSec: qaSnap.docs.reduce((sum, doc) => sum + ((doc.data() as QADoc).metrics?.durationSec || 0), 0),
        status: "ready",
        updatedAt: FieldValue.serverTimestamp(),
      };

      await summaryRef.set(finalPayload, { merge: true });

      logger.info(`[buildSummary] Successfully generated summary for session: ${sessionId}`);
      res.status(200).json({ success: true, sessionId });

    } catch (e: any) {
      logger.error("[buildSummary] Fatal error", {
        message: e?.message,
        stack: e?.stack,
        sessionId: req.query?.sessionId ?? req.body?.sessionId,
      });
      const sessionId = req.query?.sessionId ?? req.body?.sessionId;
      if (sessionId) {
        const ref = db.doc(`summaries/${sessionId}`);
        await ref.set({ status: 'error', error: e?.message ?? 'Unknown error' }, { merge: true });
      }
      res.status(500).json({ error: e?.message ?? "Failed to build summary" });
    }
  }
);