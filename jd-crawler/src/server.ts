import express, { Request, Response } from "express";
import puppeteer from "puppeteer";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || "";
const SEARCH_ENGINE_ID = process.env.SEARCH_ENGINE_ID || "";

// ----------------------
// 메인 엔드포인트
// ----------------------
app.post("/scrape", async (req: Request, res: Response) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: "url required" });

  try {
    let companyName = "";

    // 1️⃣ 잡코리아 기업명 추출
    if (url.includes("jobkorea.co.kr")) {
      companyName = await scrapeCompanyFromJobKorea(url);
    } else {
      return res.status(400).json({ error: "Only JobKorea URLs supported (데모용)" });
    }

    // 2️⃣ Google Search API로 홈페이지 탐색
    const homepage = await findCompanyHomepage(companyName);
    if (!homepage) throw new Error("Could not resolve company homepage");

    // 3️⃣ 인재상/채용 페이지 찾기
    const talentPageUrl = await findTalentPage(homepage);

    // 4️⃣ 해당 페이지에서 텍스트 크롤링
    const talentText = await scrapePageText(talentPageUrl);

    res.json({
      company: companyName,
      homepage,
      talentPageUrl,
      text: talentText.slice(0, 2000),
    });
  } catch (err: any) {
    console.error("Scrape error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ----------------------
// 잡코리아 기업명 추출
// ----------------------
async function scrapeCompanyFromJobKorea(url: string): Promise<string> {
  const browser = await puppeteer.launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    headless: true,
  });
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });

  // ✅ 셀렉터 수정: ".coName a"
  const companyName = await page.$eval(".coName a", el => (el as HTMLElement).innerText.trim());

  await browser.close();
  return companyName;
}


// ----------------------
// Google Search API 사용
// ----------------------
async function findCompanyHomepage(company: string): Promise<string | null> {
  if (!GOOGLE_API_KEY || !SEARCH_ENGINE_ID) {
    throw new Error("Google Search API not configured");
  }

  const apiUrl = `https://www.googleapis.com/customsearch/v1?q=${encodeURIComponent(
    company + " 공식 홈페이지"
  )}&key=${GOOGLE_API_KEY}&cx=${SEARCH_ENGINE_ID}`;

  const res = await fetch(apiUrl);
  if (!res.ok) throw new Error("Google Search API failed");

  const data = await res.json();

  // 첫 번째 결과 링크 반환
  return data.items?.[0]?.link || null;
}

// ----------------------
// 인재상/채용 페이지 찾기
// ----------------------
async function findTalentPage(homepage: string): Promise<string> {
  const candidates = ["/careers", "/recruit", "/about", "/인재상"];
  for (const path of candidates) {
    try {
      const res = await fetch(homepage + path);
      if (res.ok) return homepage + path;
    } catch {}
  }
  return homepage; // fallback
}

// ----------------------
// Puppeteer로 텍스트 크롤링
// ----------------------
async function scrapePageText(url: string): Promise<string> {
  const browser = await puppeteer.launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    headless: true,
  });
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });

  const text = await page.evaluate(() => document.body.innerText || "");
  await browser.close();
  return text;
}

// ----------------------
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});


