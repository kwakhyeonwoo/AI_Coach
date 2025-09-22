import express, { Request, Response } from "express";
import puppeteer from "puppeteer";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok" });
});

app.post("/scrape", async (req: Request, res: Response) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: "url required" });

  try {
    const browser = await puppeteer.launch({
      headless: true, // 최신 Puppeteer 권장 옵션
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });

    const text = await page.evaluate(() => document.body.innerText || "");
    await browser.close();

    const words = Array.from(
      new Set(
        text
          .split(/\s+/)
          .map(w => w.trim())
          .filter(w => w.length > 1)
      )
    ).slice(0, 20);

    res.json({ url, text: text.slice(0, 1500), keywords: words });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 🚀 서버 실행 부분 추가
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
