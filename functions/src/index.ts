// functions/src/index.ts
import {initializeApp} from "firebase-admin/app";
import {onRequest} from "firebase-functions/v2/https";
import {defineSecret} from "firebase-functions/params";
import * as logger from "firebase-functions/logger";
import OpenAI from "openai";

initializeApp();

const OPENAI_API_KEY = defineSecret("OPENAI_API_KEY");

type QA = {q: string; a?: string};

const FALLBACK: Record<string, string[]> = {
  iOS: [
    "iOS 앱에서 메모리 누수가 발생했을 때 어떻게 디버깅하고 해결하시겠습니까?",
    "GCD와 OperationQueue의 차이와 선택 기준은 무엇인가요?",
    "Swift Concurrency 적용 시 주의할 점은 무엇인가요?",
    "Instruments로 성능 최적화하는 절차를 설명해 주세요.",
    "HLS 스트리밍 지연을 어떻게 진단하고 개선하나요?",
  ],
  Android: [
    "Android에서 메모리 누수를 어떻게 진단하고 해결하나요?",
    "Coroutine/Flow를 대규모 화면에 적용하는 구조를 설명해 주세요.",
    "RecyclerView 성능 최적화 팁을 설명해 주세요.",
  ],
  Frontend: [
    "React 렌더링 최적화를 위해 어떤 전략을 사용하시나요?",
    "CSR/SSR/SSG를 어떤 기준으로 선택하나요?",
  ],
  Backend: [
    "대규모 트래픽에서 DB 경합 문제를 어떻게 진단하고 해결하나요?",
    "비동기 작업 큐를 어떤 기준으로 설계하나요?",
  ],
  Data: [
    "피처 누출을 어떻게 방지하고 검증하나요?",
    "데이터 품질 검사를 프로덕션에 어떻게 자동화하셨나요?",
  ],
};

export const interviewQuestion = onRequest(
  {
    cors: true,
    region: "asia-northeast3",
    timeoutSeconds: 60,
    memory: "1GiB",
    secrets: [OPENAI_API_KEY],
  },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).send("Method Not Allowed");
      return;
    }

    const body = req.body || {};
    const role: string = (body.role || "iOS").trim();
    const history: QA[] = Array.isArray(body.history) ? body.history : [];
    const maxQ: number = body.maxQ || 5;
    const difficulty: string = body.difficulty || "mid";

    const idx = history.length;
    if (idx >= maxQ) {
      res.json({question: null, done: true});
      return;
    }

    const topics = FALLBACK[role] ? role : "iOS";

    const SYSTEM =
      "You are a senior technical interviewer. " +
      "Generate exactly ONE interview question in Korean, no numbering, " +
      "no quotes. It must be precise, practical, and role-specific (" +
      topics +
      "), difficulty=" +
      difficulty +
      ". Return ONLY the question text, nothing else.";

    const hist = history
      .map((h, i) => "Q" + (i + 1) + ": " + h.q +
        "\nA" + (i + 1) + ": " + (h.a || "(audio)") + "\n")
      .join("\n");

    const USER =
      "직무: " + topics + "\n" +
      "총 문항 수: " + maxQ + "\n" +
      "현재 인덱스: " + idx + "\n" +
      "이전 문답:\n" + hist +
      "요구사항:\n" +
      "- 한국어로 단 한 문장 질문만 생성\n" +
      "- 직무 핵심을 겨냥 (원인 진단→해결/트레이드오프)\n" +
      "- 난이도: " + difficulty + "\n" +
      "- 도메인 키워드 포함";

    // ✅ 시크릿 확인 + 로깅
    const apiKey = OPENAI_API_KEY.value();
    if (!apiKey) {
      logger.error("OPENAI_API_KEY is missing");
    }
    const client = new OpenAI({apiKey});

    let question: string | null = null;

    try {
      const r = await client.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0.7,
        max_tokens: 120,
        messages: [
          {role: "system", content: SYSTEM},
          {role: "user", content: USER},
        ],
      });

      question = r.choices?.[0]?.message?.content?.trim() || null;

      // 규칙 위반(번호/여러 줄) 방지
      if (question && question.includes("\n")) {
        const first = question.split("\n").find(Boolean);
        question = first || question;
      }
      if (question) {
        question = question
          .replace(/^["'“”‘’\s]*\d*[).-\s]?\s*/, "")
          .trim();
      }

      // 너무 짧으면 실패로 간주하여 폴백 사용
      if (!question || question.length < 5) {
        logger.warn("Model returned empty/short question, using fallback.");
        question = null;
      }
    } catch (err: any) {
      // ✅ 실패 원인 그대로 남기기 (콘솔 Logs에서 확인)
      logger.error("OpenAI call failed", {
        message: err?.message,
        name: err?.name,
        status: err?.status,
        data: err?.response?.data,
      });
      question = null;
    }

    if (!question) {
      const list = FALLBACK[topics] || FALLBACK.iOS;
      question = list[idx % list.length];
    }

    res.json({question, done: false});
  }
);
