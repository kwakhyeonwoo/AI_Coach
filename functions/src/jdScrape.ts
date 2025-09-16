// functions/src/jdScrape.ts
import {onRequest} from "firebase-functions/v2/https";
import {setGlobalOptions} from "firebase-functions/v2/options";
import axios from "axios";
import * as cheerio from "cheerio";

setGlobalOptions({region: "asia-northeast3"});

const FORBIDDEN = [/^localhost$/i, /^127\./, /^10\./, /^192\.168\./, /^169\.254\./, /\.internal$/i];

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) " +
  "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";

function tidy(s = ""): string {
  return s.replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").replace(/[ \t]{2,}/g, " ").trim();
}

export const jdScrape = onRequest({cors: true}, async (req, res): Promise<void> => {
  try {
    const url = String(req.query.url || "");
    if (!/^https?:\/\//i.test(url)) {
      res.status(400).json({error: "invalid url"});
      return;
    }

    const u = new URL(url);
    if (FORBIDDEN.some((rx) => rx.test(u.hostname))) {
      res.status(400).json({error: "forbidden host"});
      return;
    }

    const {data: html} = await axios.get(url, {
      headers: {"User-Agent": UA, "Accept-Language": "ko,ko-KR;q=0.9,en-US;q=0.8,en;q=0.7"},
      timeout: 10000,
      maxRedirects: 5
    });

    const $ = cheerio.load(html);
    let text = "";

    switch (u.hostname) {
      case "www.jobkorea.co.kr":
        text = $(".detailArea").text() || $(".recruit-info, .recruitment-content, .cont").text();
        break;
      case "www.wanted.co.kr":
        text = $("[data-testid=JobDescription]").text() || $("article").text();
        break;
      case "www.saramin.co.kr":
        text = $(".user_content").text() || $("#content").text();
        break;
      default:
        text = $("main").text() || $("article").text() || $("#container").text() || $("body").text();
    }

    const meta = $("meta[name=description]").attr("content") || "";
    const title = $("h1").first().text() || $("title").text() || "";
    const merged = tidy([title, meta, text].join("\n\n"));

    if (!merged) {
      res.status(204).end();
      return;
    }

    res.json({text: merged});
    return; // <- 값을 반환하지 않도록
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    res.status(500).json({error: "scrape_failed", detail: msg});
    return;
  }
});
