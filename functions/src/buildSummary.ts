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

      const isProSession = sessionData.isPro === true && sessionData.jdKeywords?.length > 0;
      const jdKeywords = isProSession ? sessionData.jdKeywords : [];

      // ✅ 2. 시스템 프롬프트를 JSON 입/출력에 맞게 수정하고 ID 보존을 명확히 지시
      const systemPrompt = `
        You are an expert AI interview coach. I will provide interview data in JSON format. Your task is to analyze it and return a single JSON evaluation object.
        
        ${isProSession 
          ? `// PRO MODE: This is a Pro session. Evaluate based on the provided JD keywords.
             - Scoring Formula: overall = Σ(score_dim_i × weight_i_jd) + α × keyword_coverage + β × metric_specificity
             - α (keyword_coverage): For each answer, check if any of these JD keywords are mentioned: [${jdKeywords.join(', ')}].
             - β (metric_specificity): For each answer, check if it contains specific numbers, KPIs, or metrics.`
          : `// FREE MODE: This is a Free session. Evaluate based on general best practices.`
        }

        The final JSON object MUST have the following structure: 
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
            "feedback": string, // 👈 Pro 피드백을 담을 필드
            "score": number, 
            "tags": string[], 
            "jdKeywordCoverage": boolean, // 👈 JD 키워드 포함 여부
            "metricSpecificity": boolean  // 👈 KPI 포함 여부
          }[] 
        }.
        
        - All text must be in Korean.
        - The "qa" array MUST contain an object for EVERY question in the input.
        - Preserve the original "id" and "questionText" for each item.
        - For Pro sessions, the "feedback" should explicitly mention how well the answer aligns with the JD keywords.
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