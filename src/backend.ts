import express, { type Express, type Request, type Response } from "express";
import path from "node:path";

export const app: Express = express();
const port = Number(process.env.PORT ?? 3000);
const publicDir = path.resolve(process.cwd(), "public");
const fetchHeaders = { "User-Agent": "Mozilla/5.0 (compatible; WebScraperBot/1.0)" };

app.use(express.json());
app.use(express.static(publicDir));

interface AnalyzeRequestBody {
  url?: string;
}

interface PageAnalysis {
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

interface LinkedPageAnalysis {
  url: string;
  finalUrl: string | null;
  statusCode: number | null;
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
  error: string | null;
}

interface WebsiteAnalysis extends PageAnalysis {
  linkedPages: LinkedPageAnalysis[];
}

class WebsiteUnavailableError extends Error {
  public constructor(public readonly statusCode: number) {
    super(`Webseite nicht erreichbar (Status ${statusCode}).`);
  }
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
      const pageAnalysis = await analyzePage(url);
      const linkedPages = await analyzeLinkedPages(pageAnalysis.links, pageAnalysis.finalUrl);

      res.json({
        ...pageAnalysis,
        linkedPages,
      });
    } catch (error) {
      if (error instanceof WebsiteUnavailableError) {
        res.status(400).json({ error: error.message });
        return;
      }

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

async function analyzePage(url: string): Promise<PageAnalysis> {
  const { response, html } = await fetchHtml(url);
  const finalUrl = normalizeUrl(response.url);

  return {
    url,
    finalUrl,
    statusCode: response.status,
    title: extractFirstTag(html, "title"),
    metaDescription: extractMetaDescription(html),
    language: extractHtmlLanguage(html),
    headingCount: countTags(html, "h1|h2|h3|h4|h5|h6"),
    topHeadings: extractTags(html, "h1|h2|h3", 8),
    paragraphCount: countTags(html, "p"),
    linkCount: countTags(html, "a"),
    links: extractLinks(html, finalUrl),
    imageCount: countTags(html, "img"),
    textSample: extractTextSample(html, 220),
  };
}

async function fetchHtml(url: string): Promise<{ response: Response; html: string }> {
  const response = await fetch(url, {
    redirect: "follow",
    headers: fetchHeaders,
  });

  if (!response.ok) {
    throw new WebsiteUnavailableError(response.status);
  }

  return {
    response,
    html: await response.text(),
  };
}

async function analyzeLinkedPages(links: string[], baseUrl: string): Promise<LinkedPageAnalysis[]> {
  const sameSiteLinks = filterSameSiteLinks(links, baseUrl);

  return Promise.all(
    sameSiteLinks.map(async (link) => {
      try {
        const pageAnalysis = await analyzePage(link);

        return {
          ...pageAnalysis,
          error: null,
        };
      } catch (error) {
        return createFailedLinkedPageAnalysis(link, error);
      }
    })
  );
}

function createFailedLinkedPageAnalysis(url: string, error: unknown): LinkedPageAnalysis {
  return {
    url,
    finalUrl: null,
    statusCode: null,
    title: null,
    metaDescription: null,
    language: null,
    headingCount: 0,
    topHeadings: [],
    paragraphCount: 0,
    linkCount: 0,
    links: [],
    imageCount: 0,
    textSample: "",
    error: getLinkedPageErrorMessage(error),
  };
}

function getLinkedPageErrorMessage(error: unknown): string {
  if (error instanceof WebsiteUnavailableError) {
    return error.message;
  }

  return "Unterseite konnte nicht analysiert werden.";
}

function filterSameSiteLinks(links: string[], baseUrl: string): string[] {
  const base = new URL(baseUrl);
  const normalizedBaseUrl = normalizeUrl(base.href);
  const seen = new Set<string>();
  const sameSiteLinks: string[] = [];

  for (const link of links) {
    try {
      const parsed = new URL(link);

      if (!hasHttpProtocol(parsed)) {
        continue;
      }

      parsed.hash = "";
      const normalizedLink = parsed.href;

      if (parsed.origin !== base.origin || normalizedLink === normalizedBaseUrl || seen.has(normalizedLink)) {
        continue;
      }

      seen.add(normalizedLink);
      sameSiteLinks.push(normalizedLink);
    } catch {
      continue;
    }
  }

  return sameSiteLinks;
}

function normalizeUrl(value: string): string {
  const parsed = new URL(value);
  parsed.hash = "";
  return parsed.href;
}

function hasHttpProtocol(url: URL): boolean {
  return url.protocol === "http:" || url.protocol === "https:";
}

export function isValidHttpUrl(value: string): boolean {
  try {
    return hasHttpProtocol(new URL(value));
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
  const seen = new Set<string>();

  for (const match of html.matchAll(regex)) {
    const href = match[1];

    if (!href) {
      continue;
    }

    try {
      const parsed = new URL(href, baseUrl);

      if (!hasHttpProtocol(parsed)) {
        continue;
      }

      parsed.hash = "";
      const absoluteUrl = parsed.href;

      if (seen.has(absoluteUrl)) {
        continue;
      }

      seen.add(absoluteUrl);
      links.push(absoluteUrl);
    } catch {
      continue;
    }
  }

  return links;
}

