import express, { Request, Response } from "express";
import puppeteer from "puppeteer";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

// ----------------------
// 메인 엔드포인트
// ----------------------
app.post("/scrape", async (req: Request, res: Response) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: "url required" });

  try {
    let text = "";

    if (url.includes("jobkorea.co.kr")) {
      text = await scrapeWithPuppeteer(url, [
        ".detailArea",
        ".recruitment-content",
        ".detail-content",
        "#container",
        "body",
      ]);
    } else if (url.includes("saramin.co.kr")) {
      text = await scrapeWithPuppeteer(url, [
        ".wrap_jview",
        ".user_content",
        ".content",
        ".cont",
        "body",
      ], 60000);
    } else if (url.includes("wanted.co.kr")) {
      text = await scrapeWanted(url);
    } else if (url.includes("jumpit.co.kr")) {
      text = await scrapeWithPuppeteer(url, [
        "main",
        ".job-description",
        ".position-detail",
        "body",
      ], 60000);
    } else {
      return res.status(400).json({ error: "Unsupported domain" });
    }

    if (!text || text.trim().length < 50) {
      throw new Error("No meaningful content found");
    }

    const keywords = extractKeywords(text);

    res.json({ url, text: text.slice(0, 2000), keywords });
  } catch (err: any) {
    console.error("Scrape error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ----------------------
// Puppeteer 크롤러
// ----------------------
async function scrapeWithPuppeteer(
  url: string,
  selectors: string[],
  timeout = 45000
): Promise<string> {
  const browser = await puppeteer.launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    headless: true,
  });
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: "domcontentloaded", timeout });

  let text = "";
  for (const selector of selectors) {
    try {
      await page.waitForSelector(selector, { timeout: 8000 });
      text = await page.$eval(selector, el => (el as HTMLElement).innerText || "");
      if (text.trim().length > 0) break;
    } catch {
      console.warn(`⚠️ Selector not found: ${selector}`);
    }
  }

  // fallback
  if (!text) {
    text = await page.evaluate(() => document.body.innerText || "");
  }

  await browser.close();
  return text;
}

// ----------------------
// Wanted API 크롤링
// ----------------------
async function scrapeWanted(url: string): Promise<string> {
  const jobIdMatch = url.match(/wd\/(\d+)/);
  if (!jobIdMatch) throw new Error("Invalid Wanted URL");
  const jobId = jobIdMatch[1];

  const apiUrl = `https://www.wanted.co.kr/api/v4/jobs/${jobId}`;
  const response = await fetch(apiUrl);
  if (!response.ok) throw new Error("Failed to fetch Wanted API");

  const data = await response.json();
  return [
    data?.position?.title,
    data?.detail?.requirement,
    data?.detail?.main_tasks,
    data?.detail?.benefits,
  ]
    .filter(Boolean)
    .join("\n");
}

// ----------------------
// 간단 키워드 추출기
// ----------------------
function extractKeywords(text: string): string[] {
  return Array.from(
    new Set(
      text
        .split(/\s+/)
        .map(w => w.trim())
        .filter(w => w.length > 1)
    )
  ).slice(0, 30);
}

// ----------------------
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
