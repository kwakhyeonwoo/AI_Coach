import { onRequest } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import { db } from "./admin";
import { FieldValue } from "firebase-admin/firestore";
import OpenAI from "openai";

// FIX 2: Firestore 문서 데이터의 타입을 명시적으로 정의합니다.
// 이렇게 하면 TypeScript가 데이터의 구조를 이해하고 오류를 방지할 수 있습니다.
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

      // FIX 1: sessionId를 선언하고 유효성을 검사한 이후에 summaryRef를 정의합니다.
      const summaryRef = db.doc(`summaries/${sessionId}`);

      logger.info(`[buildSummary] Starting for session: ${sessionId}`);
      
      await summaryRef.set({ status: 'processing', updatedAt: FieldValue.serverTimestamp() }, { merge: true });

      const sessionRef = db.collection("sessions").doc(sessionId);
      const sessionSnap = await sessionRef.get();

      if (!sessionSnap.exists) {
        logger.error(`[buildSummary] Session not found: ${sessionId}`);
        await summaryRef.set({ status: 'error', error: 'Session document not found.' }, { merge: true });
        res.status(404).json({ error: "Session not found" });
        return;
      }
      const sessionData = sessionSnap.data()!;

      const qaCol = sessionRef.collection("qa");
      const qaSnap = await qaCol.orderBy("createdAt", "asc").get();
      
      // FIX 2: .map() 내부에서 가져온 데이터에 QADoc 타입을 적용합니다.
      const qaList = qaSnap.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as QADoc), // "이 데이터는 QADoc 형태를 따를 거야"라고 알려줍니다.
      }));

      if (qaList.length === 0) {
        logger.warn(`[buildSummary] No QA documents found for session: ${sessionId}`);
        await summaryRef.set({ status: 'error', error: 'No answers found for this session.' }, { merge: true });
        res.status(400).json({ error: "No QA docs for session" });
        return;
      }

      const transcripts = qaList
        .map(
          (qa, index) =>
            `Q${index + 1}: ${qa.questionText}\nA${index + 1}: ${qa.transcript}` // 이제 .questionText와 .transcript를 에러 없이 읽을 수 있습니다.
        )
        .join("\n\n");
      
      const systemPrompt = `
        You are an expert AI interview coach. Based on the following interview transcripts, provide a comprehensive evaluation in JSON format.
        The JSON object must have the following structure: { "overallScore": number, "level": "Beginner" | "Intermediate" | "Advanced", "strengths": string[], "improvements": string[], "tips": string[], "qa": { "id": string, "questionText": string, "answerSummary": string, "score": number, "tags": string[], "sentiment": "positive" | "neutral" | "negative" }[] }.
        - All text must be in Korean.
        - 'overallScore' is an integer from 0 to 100.
        - 'level' is determined by the overall score (e.g., >80 Advanced, >60 Intermediate, else Beginner).
        - 'strengths', 'improvements', 'tips' must be arrays of short, actionable Korean sentences. Provide 3 items for each.
        - For each item in the 'qa' array, provide its id, the original questionText, a concise summary, a score (0-100), relevant tags (e.g., "커뮤니케이션", "문제해결"), and the sentiment of the answer.
      `;

      const userPrompt = `
        Role: ${sessionData.role || "general"}
        Company (optional): ${sessionData.companyId || "N/A"}
        
        Transcripts:
        ${transcripts}
      `;

      logger.info(`[buildSummary] Calling OpenAI for session: ${sessionId}`);
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

      const finalPayload = {
        ...summaryData,
        uid: sessionData.uid,
        sessionId,
        startedAt: sessionData.startedAt,
        endedAt: sessionData.endedAt ?? FieldValue.serverTimestamp(),
        totalQuestions: qaList.length,
        totalSpeakingSec: qaList.reduce((sum, qa) => sum + (qa.metrics?.durationSec || 0), 0), // 이제 .metrics를 에러 없이 읽을 수 있습니다.
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