import express, { Request, Response } from "express";
import puppeteer from "puppeteer";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

app.post("/scrape", async (req: Request, res: Response) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: "url required" });

  try {
    let text = "";

    if (url.includes("jobkorea.co.kr")) {
      text = await scrapeWithPuppeteer(url, ".detailArea, .recruitment-content");
    } else if (url.includes("saramin.co.kr")) {
      text = await scrapeWithPuppeteer(url, "#content, .user_content");
    } else if (url.includes("wanted.co.kr")) {
      text = await scrapeWanted(url);
    } else if (url.includes("jumpit.co.kr")) {
      text = await scrapeWithPuppeteer(url, "#__next main");
    } else {
      return res.status(400).json({ error: "Unsupported domain" });
    }

    const keywords = extractKeywords(text);

    res.json({ url, text: text.slice(0, 2000), keywords });
  } catch (err: any) {
    console.error("Scrape error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Puppeteer 기반 크롤러
async function scrapeWithPuppeteer(url: string, selector: string, timeout = 30000): Promise<string> {
  const browser = await puppeteer.launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    headless: true,
  });
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: "networkidle2", timeout });
  await page.waitForSelector(selector, { timeout });
  const text = await page.evaluate((sel) => {
    const el = document.querySelector(sel) as HTMLElement | null;
    return el ? el.innerText : document.body.innerText || "";
  }, selector);
  await browser.close();
  return text;
}

// Wanted 전용 API 크롤링
async function scrapeWanted(url: string): Promise<string> {
  const jobIdMatch = url.match(/wd\/(\d+)/);
  if (!jobIdMatch) throw new Error("Invalid Wanted URL");
  const jobId = jobIdMatch[1];

  const apiUrl = `https://www.wanted.co.kr/api/v4/jobs/${jobId}`;
  const response = await fetch(apiUrl);
  if (!response.ok) throw new Error("Failed to fetch Wanted API");

  const data = await response.json();

  const details = [
    data?.position?.title,
    data?.jd?.main_tasks,
    data?.jd?.requirements,
    data?.jd?.preferred_points,
    data?.jd?.benefits,
  ]
    .filter(Boolean)
    .join("\n");

  return details;
}

// 간단 키워드 추출기
function extractKeywords(text: string): string[] {
  return Array.from(
    new Set(
      text
        .split(/\s+/)
        .map((w) => w.trim())
        .filter((w) => w.length > 1)
    )
  ).slice(0, 30);
}

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
