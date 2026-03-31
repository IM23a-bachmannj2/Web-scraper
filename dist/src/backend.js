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
        const analysis = {
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
    }
    catch {
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
function isValidHttpUrl(value) {
    try {
        const parsed = new URL(value);
        return parsed.protocol === "http:" || parsed.protocol === "https:";
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
    for (const match of html.matchAll(regex)) {
        const href = match[1];
        if (!href)
            continue;
        try {
            // Convert relative → absolute URL
            const absoluteUrl = new URL(href, baseUrl).href;
            links.push(absoluteUrl);
        }
        catch {
            // ignore invalid URLs (mailto:, javascript:, etc.)
        }
    }
    // remove duplicates
    return [...new Set(links)];
}
//# sourceMappingURL=backend.js.map