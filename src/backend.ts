import express, { type Express, type Request, type Response } from "express";
import path from "node:path";

export const app: Express = express();
const port = Number(process.env.PORT ?? 3000);
const publicDir = path.resolve(process.cwd(), "public");

app.use(express.json());
app.use(express.static(publicDir));

interface AnalyzeRequestBody {
  url?: string;
}

interface WebsiteAnalysis {
  url: string;
  finalUrl: string;
  statusCode: number;
  title: string | null;
  metaDescription: string | null;
  language: string | null;
  headingCount: number;
  topHeadings: string[];
  paragraphCount: number;
  linkCount: number;
  links: string[];
  imageCount: number;
  textSample: string;
}

app.get("/", (_req: Request, res: Response) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

app.post(
  "/api/analyze",
  async (
    req: Request<Record<string, never>, WebsiteAnalysis | { error: string }, AnalyzeRequestBody>,
    res: Response<WebsiteAnalysis | { error: string }>
  ) => {
    const { url } = req.body;

    if (!url || !isValidHttpUrl(url)) {
      res.status(400).json({ error: "Bitte eine gültige http/https URL senden." });
      return;
    }

    try {
      const response = await fetch(url, {
        redirect: "follow",
        headers: { "User-Agent": "Mozilla/5.0 (compatible; WebScraperBot/1.0)" },
      });

      if (!response.ok) {
        res.status(400).json({ error: `Webseite nicht erreichbar (Status ${response.status}).` });
        return;
      }

      const html = await response.text();
      const topHeadings = extractTags(html, "h1|h2|h3", 8);

      const analysis: WebsiteAnalysis = {
        url,
        finalUrl: response.url,
        statusCode: response.status,
        title: extractFirstTag(html, "title"),
        metaDescription: extractMetaDescription(html),
        language: extractHtmlLanguage(html),
        headingCount: countTags(html, "h1|h2|h3|h4|h5|h6"),
        topHeadings,
        paragraphCount: countTags(html, "p"),
        linkCount: countTags(html, "a"),
        links: extractLinks(html, response.url),
        imageCount: countTags(html, "img"),
        textSample: extractTextSample(html, 220),
      };

      res.json(analysis);
    } catch {
      res.status(500).json({ error: "Analyse fehlgeschlagen. Bitte URL prüfen und erneut versuchen." });
    }
  }
);

export function startServer() {
  return app.listen(port, () => {
    console.log(`Server läuft auf http://localhost:${port}`);
  });
}

if (require.main === module) {
  startServer();
}

export function isValidHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function decodeHtmlEntities(input: string): string {
  return input
    .replaceAll(/&nbsp;/g, " ")
    .replaceAll(/&amp;/g, "&")
    .replaceAll(/&quot;/g, '"')
    .replaceAll(/&#39;/g, "'")
    .replaceAll(/&lt;/g, "<")
    .replaceAll(/&gt;/g, ">");
}

function stripTags(input: string): string {
  return decodeHtmlEntities(input.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim());
}

function extractFirstTag(html: string, tagName: string): string | null {
  const regex = new RegExp(`<(${tagName})[^>]*>([\\s\\S]*?)<\\/\\1>`, "i");
  const match = html.match(regex);
  if (!match?.[2]) {
    return null;
  }
  return stripTags(match[2]) || null;
}

function extractTags(html: string, tagPattern: string, maxItems: number): string[] {
  const regex = new RegExp(`<(${tagPattern})[^>]*>([\\s\\S]*?)<\\/\\1>`, "gi");
  const items: string[] = [];

  for (const match of html.matchAll(regex)) {
    if (items.length >= maxItems) {
      break;
    }
    const raw = match[2];
    if (!raw) {
      continue;
    }
    const value = stripTags(raw);
    if (value) {
      items.push(value);
    }
  }

  return items;
}

function countTags(html: string, tagPattern: string): number {
  const regex = new RegExp(`<(${tagPattern})(\\s|>)`, "gi");
  return [...html.matchAll(regex)].length;
}

function extractMetaDescription(html: string): string | null {
  const regex = /<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["'][^>]*>/i;
  const reverseRegex = /<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["'][^>]*>/i;
  const match = html.match(regex) ?? html.match(reverseRegex);
  if (!match?.[1]) {
    return null;
  }
  return decodeHtmlEntities(match[1].trim()) || null;
}

function extractHtmlLanguage(html: string): string | null {
  const match = html.match(/<html[^>]*lang=["']([^"']+)["'][^>]*>/i);
  if (!match?.[1]) {
    return null;
  }
  return match[1].trim();
}

function extractTextSample(html: string, maxLength: number): string {
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const baseText = stripTags(bodyMatch?.[1] ?? html);
  return baseText.slice(0, maxLength);
}

export function extractLinks(html: string, baseUrl: string): string[] {
  const regex = /<a[^>]*href=["']([^"']+)["'][^>]*>/gi;
  const links: string[] = [];

  for (const match of html.matchAll(regex)) {
    const href = match[1];

    if (!href) continue;

    try {
      // Convert relative → absolute URL
      const absoluteUrl = new URL(href, baseUrl).href;
      links.push(absoluteUrl);
    } catch {
      // ignore invalid URLs (mailto:, javascript:, etc.)
    }
  }

  // remove duplicates
  return [...new Set(links)];
}

