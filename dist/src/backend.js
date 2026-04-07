"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
exports.startServer = startServer;
exports.isValidHttpUrl = isValidHttpUrl;
exports.extractLinks = extractLinks;
const express_1 = __importDefault(require("express"));
const node_path_1 = __importDefault(require("node:path"));
exports.app = (0, express_1.default)();
const port = Number(process.env.PORT ?? 3000);
const publicDir = node_path_1.default.resolve(process.cwd(), "public");
const fetchHeaders = { "User-Agent": "Mozilla/5.0 (compatible; WebScraperBot/1.0)" };
class WebsiteUnavailableError extends Error {
    statusCode;
    constructor(statusCode) {
        super(`Webseite nicht erreichbar (Status ${statusCode}).`);
        this.statusCode = statusCode;
    }
}
exports.app.use(express_1.default.json());
exports.app.use(express_1.default.static(publicDir));
exports.app.get("/", (_req, res) => {
    res.sendFile(node_path_1.default.join(publicDir, "index.html"));
});
exports.app.post("/api/analyze", async (req, res) => {
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
    }
    catch (error) {
        if (error instanceof WebsiteUnavailableError) {
            res.status(400).json({ error: error.message });
            return;
        }
        res.status(500).json({ error: "Analyse fehlgeschlagen. Bitte URL prüfen und erneut versuchen." });
    }
});
function startServer() {
    return exports.app.listen(port, () => {
        console.log(`Server läuft auf http://localhost:${port}`);
    });
}
if (require.main === module) {
    startServer();
}
async function analyzePage(url) {
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
async function fetchHtml(url) {
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
async function analyzeLinkedPages(links, baseUrl) {
    const sameSiteLinks = filterSameSiteLinks(links, baseUrl);
    return Promise.all(sameSiteLinks.map(async (link) => {
        try {
            const pageAnalysis = await analyzePage(link);
            return {
                ...pageAnalysis,
                error: null,
            };
        }
        catch (error) {
            return createFailedLinkedPageAnalysis(link, error);
        }
    }));
}
function createFailedLinkedPageAnalysis(url, error) {
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
function getLinkedPageErrorMessage(error) {
    if (error instanceof WebsiteUnavailableError) {
        return error.message;
    }
    return "Unterseite konnte nicht analysiert werden.";
}
function filterSameSiteLinks(links, baseUrl) {
    const base = new URL(baseUrl);
    const normalizedBaseUrl = normalizeUrl(base.href);
    const seen = new Set();
    const sameSiteLinks = [];
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
        }
        catch {
            continue;
        }
    }
    return sameSiteLinks;
}
function normalizeUrl(value) {
    const parsed = new URL(value);
    parsed.hash = "";
    return parsed.href;
}
function hasHttpProtocol(url) {
    return url.protocol === "http:" || url.protocol === "https:";
}
function isValidHttpUrl(value) {
    try {
        return hasHttpProtocol(new URL(value));
    }
    catch {
        return false;
    }
}
function decodeHtmlEntities(input) {
    return input
        .replaceAll(/&nbsp;/g, " ")
        .replaceAll(/&amp;/g, "&")
        .replaceAll(/&quot;/g, '"')
        .replaceAll(/&#39;/g, "'")
        .replaceAll(/&lt;/g, "<")
        .replaceAll(/&gt;/g, ">");
}
function stripTags(input) {
    return decodeHtmlEntities(input.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim());
}
function extractFirstTag(html, tagName) {
    const regex = new RegExp(`<(${tagName})[^>]*>([\\s\\S]*?)<\\/\\1>`, "i");
    const match = html.match(regex);
    if (!match?.[2]) {
        return null;
    }
    return stripTags(match[2]) || null;
}
function extractTags(html, tagPattern, maxItems) {
    const regex = new RegExp(`<(${tagPattern})[^>]*>([\\s\\S]*?)<\\/\\1>`, "gi");
    const items = [];
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
function countTags(html, tagPattern) {
    const regex = new RegExp(`<(${tagPattern})(\\s|>)`, "gi");
    return [...html.matchAll(regex)].length;
}
function extractMetaDescription(html) {
    const regex = /<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["'][^>]*>/i;
    const reverseRegex = /<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["'][^>]*>/i;
    const match = html.match(regex) ?? html.match(reverseRegex);
    if (!match?.[1]) {
        return null;
    }
    return decodeHtmlEntities(match[1].trim()) || null;
}
function extractHtmlLanguage(html) {
    const match = html.match(/<html[^>]*lang=["']([^"']+)["'][^>]*>/i);
    if (!match?.[1]) {
        return null;
    }
    return match[1].trim();
}
function extractTextSample(html, maxLength) {
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    const baseText = stripTags(bodyMatch?.[1] ?? html);
    return baseText.slice(0, maxLength);
}
function extractLinks(html, baseUrl) {
    const regex = /<a[^>]*href=["']([^"']+)["'][^>]*>/gi;
    const links = [];
    const seen = new Set();
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
        }
        catch {
            continue;
        }
    }
    return links;
}
//# sourceMappingURL=backend.js.map
