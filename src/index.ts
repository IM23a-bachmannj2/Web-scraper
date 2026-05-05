export interface PageAnalysis {
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

export interface LinkedPageAnalysis {
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

export interface WebsiteAnalysis extends PageAnalysis {
  linkedPages: LinkedPageAnalysis[];
}

interface AppElements {
  form: HTMLFormElement;
  input: HTMLInputElement;
  error: HTMLParagraphElement;
  results: HTMLDivElement;
  submitButton: HTMLButtonElement | HTMLInputElement | null;
}

type FetchLike = typeof fetch;

const MAX_TEXT_SAMPLE_LENGTH = 220;
const MAX_TOP_HEADINGS = 8;
const DEFAULT_SUBMIT_LABEL = "Analyse starten";

export class InvalidUrlError extends Error {
  public constructor() {
    super("Bitte eine gültige http/https URL senden.");
  }
}

export class WebsiteUnavailableError extends Error {
  public constructor(public readonly statusCode: number) {
    super(`Webseite nicht erreichbar (Status ${statusCode}).`);
  }
}

export class BrowserFetchError extends Error {
  public constructor() {
    super(
      "Die Webseite konnte nicht direkt im Browser geladen werden. Auf GitHub Pages scheitern viele Seiten ohne CORS-Freigabe."
    );
  }
}

export async function analyzeWebsite(url: string, fetchImplementation: FetchLike = fetch): Promise<WebsiteAnalysis> {
  if (!isValidHttpUrl(url)) {
    throw new InvalidUrlError();
  }

  const pageAnalysis = await analyzePage(url, fetchImplementation);
  const linkedPages = await analyzeLinkedPages(pageAnalysis.links, pageAnalysis.finalUrl, fetchImplementation);

  return {
    ...pageAnalysis,
    linkedPages,
  };
}

async function analyzePage(url: string, fetchImplementation: FetchLike): Promise<PageAnalysis> {
  const { response, html } = await fetchHtml(url, fetchImplementation);
  const finalUrl = normalizeUrl(response.url || url);
  const parsedDocument = parseHtml(html);

  return {
    url,
    finalUrl,
    statusCode: response.status,
    title: toNullableText(parsedDocument.querySelector("title")?.textContent),
    metaDescription: extractMetaDescription(parsedDocument),
    language: extractHtmlLanguage(parsedDocument),
    headingCount: parsedDocument.querySelectorAll("h1, h2, h3, h4, h5, h6").length,
    topHeadings: extractTopHeadings(parsedDocument),
    paragraphCount: parsedDocument.getElementsByTagName("p").length,
    linkCount: parsedDocument.getElementsByTagName("a").length,
    links: extractLinksFromDocument(parsedDocument, finalUrl),
    imageCount: parsedDocument.getElementsByTagName("img").length,
    textSample: extractTextSample(parsedDocument, MAX_TEXT_SAMPLE_LENGTH),
  };
}

async function fetchHtml(
  url: string,
  fetchImplementation: FetchLike
): Promise<{
  response: Response;
  html: string;
}> {
  let response: Response;

  try {
    response = await fetchImplementation(url);
  } catch {
    throw new BrowserFetchError();
  }

  if (!response.ok) {
    throw new WebsiteUnavailableError(response.status);
  }

  try {
    return {
      response,
      html: await response.text(),
    };
  } catch {
    throw new BrowserFetchError();
  }
}

async function analyzeLinkedPages(
  links: string[],
  baseUrl: string,
  fetchImplementation: FetchLike
): Promise<LinkedPageAnalysis[]> {
  const sameSiteLinks = filterSameSiteLinks(links, baseUrl);

  return Promise.all(
    sameSiteLinks.map(async (link) => {
      try {
        const pageAnalysis = await analyzePage(link, fetchImplementation);

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

function parseHtml(html: string): Document {
  return new DOMParser().parseFromString(html, "text/html");
}

function extractMetaDescription(parsedDocument: Document): string | null {
  const metaTags = Array.from(parsedDocument.getElementsByTagName("meta"));
  const descriptionTag = metaTags.find((tag) => tag.getAttribute("name")?.toLowerCase() === "description");

  return toNullableText(descriptionTag?.getAttribute("content"));
}

function extractHtmlLanguage(parsedDocument: Document): string | null {
  return toNullableText(parsedDocument.documentElement.getAttribute("lang"));
}

function extractTopHeadings(parsedDocument: Document): string[] {
  return Array.from(parsedDocument.querySelectorAll("h1, h2, h3"))
    .map((heading) => normalizeText(heading.textContent))
    .filter((heading) => heading.length > 0)
    .slice(0, MAX_TOP_HEADINGS);
}

function extractTextSample(parsedDocument: Document, maxLength: number): string {
  const sourceText = parsedDocument.body?.textContent ?? parsedDocument.documentElement.textContent ?? "";
  return normalizeText(sourceText).slice(0, maxLength);
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
  if (
    error instanceof BrowserFetchError ||
    error instanceof InvalidUrlError ||
    error instanceof WebsiteUnavailableError
  ) {
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

export function extractLinks(html: string, baseUrl: string): string[] {
  return extractLinksFromDocument(parseHtml(html), baseUrl);
}

function extractLinksFromDocument(parsedDocument: Document, baseUrl: string): string[] {
  const links: string[] = [];
  const seen = new Set<string>();

  for (const anchor of Array.from(parsedDocument.getElementsByTagName("a"))) {
    const href = anchor.getAttribute("href");

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

function normalizeText(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function toNullableText(value: string | null | undefined): string | null {
  const normalizedValue = normalizeText(value);
  return normalizedValue === "" ? null : normalizedValue;
}

export function splitLinksByOrigin(
  links: string[],
  baseUrl: string
): {
  internalLinks: string[];
  externalLinks: string[];
} {
  const baseOrigin = new URL(baseUrl).origin;
  const internalLinks: string[] = [];
  const externalLinks: string[] = [];

  for (const link of links) {
    try {
      const parsed = new URL(link);

      if (parsed.origin === baseOrigin) {
        internalLinks.push(link);
        continue;
      }

      externalLinks.push(link);
    } catch {
      externalLinks.push(link);
    }
  }

  return { internalLinks, externalLinks };
}

export function initializeApp(root: Document = document): void {
  const elements = getAppElements(root);

  if (!elements) {
    return;
  }

  if (elements.form.dataset.initialized === "true") {
    return;
  }

  elements.form.dataset.initialized = "true";

  if (elements.submitButton instanceof HTMLButtonElement || elements.submitButton instanceof HTMLInputElement) {
    elements.submitButton.dataset.idleLabel =
      elements.submitButton instanceof HTMLInputElement
        ? elements.submitButton.value || DEFAULT_SUBMIT_LABEL
        : elements.submitButton.textContent?.trim() || DEFAULT_SUBMIT_LABEL;
  }

  elements.form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const value = elements.input.value.trim();

    if (!value) {
      showError(elements, "URL must not be empty");
      return;
    }

    if (!isValidHttpUrl(value)) {
      showError(elements, "Please enter a valid URL (http/https)");
      return;
    }

    clearError(elements);
    setBusyState(elements, true);
    elements.results.innerHTML = "<p>Analysiere Webseite direkt im Browser...</p>";

    try {
      const analysis = await analyzeWebsite(value);
      renderResults(elements.results, analysis);
    } catch (error) {
      showError(elements, getUserFacingErrorMessage(error));
      elements.results.innerHTML = "";
    } finally {
      setBusyState(elements, false);
    }
  });
}

function getAppElements(root: Document): AppElements | null {
  const form = root.getElementById("w-form");
  const input = root.getElementById("website");
  const error = root.getElementById("error");
  const results = root.getElementById("results");

  if (
    !(form instanceof HTMLFormElement) ||
    !(input instanceof HTMLInputElement) ||
    !(error instanceof HTMLParagraphElement) ||
    !(results instanceof HTMLDivElement)
  ) {
    return null;
  }

  const submitButton = form.querySelector("button[type='submit'], button:not([type]), input[type='submit']");

  return {
    form,
    input,
    error,
    results,
    submitButton:
      submitButton instanceof HTMLButtonElement || submitButton instanceof HTMLInputElement ? submitButton : null,
  };
}

function setBusyState(elements: AppElements, isBusy: boolean): void {
  elements.input.disabled = isBusy;

  if (!elements.submitButton) {
    return;
  }

  elements.submitButton.disabled = isBusy;
  const idleLabel = elements.submitButton.dataset.idleLabel || DEFAULT_SUBMIT_LABEL;

  if (elements.submitButton instanceof HTMLInputElement) {
    elements.submitButton.value = isBusy ? "Analysiere..." : idleLabel;
    return;
  }

  elements.submitButton.textContent = isBusy ? "Analysiere..." : idleLabel;
}

function getUserFacingErrorMessage(error: unknown): string {
  if (error instanceof BrowserFetchError || error instanceof InvalidUrlError || error instanceof WebsiteUnavailableError) {
    return error.message;
  }

  return "Analyse fehlgeschlagen. Bitte URL prüfen und erneut versuchen.";
}

function renderResults(results: HTMLDivElement, data: WebsiteAnalysis): void {
  const { internalLinks, externalLinks } = splitLinksByOrigin(data.links, data.finalUrl);
  const headings =
    data.topHeadings.length > 0
      ? `<ul class="result-list">${data.topHeadings.map((heading) => `<li>${escapeHtml(heading)}</li>`).join("")}</ul>`
      : '<p class="muted">Keine Überschriften gefunden.</p>';
  const internalLinksMarkup = renderLinkList(internalLinks, "Keine internen Links gefunden.");
  const externalLinksMarkup = renderLinkList(externalLinks, "Keine externen Links gefunden.");
  const recursiveSearchMarkup = renderRecursiveSearch(data.linkedPages);

  results.innerHTML = `
    <section class="analysis-layout">
      <h2>Basisdaten</h2>
      <div class="data-grid">
        <p><strong>Status</strong><span>${data.statusCode}</span></p>
        <p><strong>URL</strong><span>${escapeHtml(data.finalUrl)}</span></p>
        <p><strong>Title</strong><span>${escapeHtml(data.title ?? "-")}</span></p>
        <p><strong>Meta Description</strong><span>${escapeHtml(data.metaDescription ?? "-")}</span></p>
        <p><strong>Sprache</strong><span>${escapeHtml(data.language ?? "-")}</span></p>
        <p><strong>Absätze</strong><span>${data.paragraphCount}</span></p>
        <p><strong>Links</strong><span>${data.linkCount}</span></p>
        <p><strong>Bilder</strong><span>${data.imageCount}</span></p>
        <p><strong>Überschriften insgesamt</strong><span>${data.headingCount}</span></p>
      </div>

      <h3>Erkannte Überschriften</h3>
      <div class="scroll-panel">
        ${headings}
      </div>

      <section class="link-groups">
        <div class="link-group-card">
          <div class="section-heading">
            <h3>Interne Links</h3>
            <span class="counter-pill">${internalLinks.length}</span>
          </div>
          <div class="scroll-panel">
            ${internalLinksMarkup}
          </div>
        </div>

        <div class="link-group-card">
          <div class="section-heading">
            <h3>Externe Links</h3>
            <span class="counter-pill counter-pill-secondary">${externalLinks.length}</span>
          </div>
          <div class="scroll-panel">
            ${externalLinksMarkup}
          </div>
        </div>
      </section>

      <h3>Textauszug</h3>
      <div class="scroll-panel">
        <p>${escapeHtml(data.textSample || "-")}</p>
      </div>

      ${recursiveSearchMarkup}
    </section>
  `;
}

function renderLinkList(links: string[], emptyMessage: string): string {
  if (links.length === 0) {
    return `<p class="muted">${emptyMessage}</p>`;
  }

  return `<ul class="link-list">${links
    .map(
      (link) => `<li><a href="${escapeHtml(link)}" target="_blank" rel="noopener noreferrer">${escapeHtml(link)}</a></li>`
    )
    .join("")}</ul>`;
}

function renderRecursiveSearch(linkedPages: LinkedPageAnalysis[]): string {
  const summary = summarizeLinkedPages(linkedPages);

  if (linkedPages.length === 0) {
    return `
      <details class="recursive-details" open>
        <summary class="recursive-summary">
          <div class="recursive-summary-main">
            <span class="recursive-summary-title">Tiefenanalyse (1 Ebene tief)</span>
            <span class="recursive-summary-subtitle">Keine internen Unterseiten gefunden</span>
          </div>
          <span class="counter-pill">0</span>
        </summary>
        <div class="recursive-body">
          <p class="muted">Keine internen Unterseiten für die Tiefenanalyse gefunden.</p>
        </div>
      </details>
    `;
  }

  return `
    <details class="recursive-details" open>
      <summary class="recursive-summary">
        <div class="recursive-summary-main">
          <span class="recursive-summary-title">Tiefenanalyse (1 Ebene tief)</span>
          <span class="recursive-summary-subtitle">${summary.successCount} erfolgreich, ${summary.errorCount} Fehler</span>
        </div>
        <span class="counter-pill">${linkedPages.length}</span>
      </summary>

      <div class="recursive-body">
        <div class="recursive-overview-grid">
          <p><strong>Unterseiten</strong><span>${linkedPages.length}</span></p>
          <p><strong>Erfolgreich</strong><span>${summary.successCount}</span></p>
          <p><strong>Fehler</strong><span>${summary.errorCount}</span></p>
          <p><strong>Interne Links auf Unterseiten</strong><span>${summary.internalLinkCount}</span></p>
          <p><strong>Externe Links auf Unterseiten</strong><span>${summary.externalLinkCount}</span></p>
          <p><strong>Absätze auf Unterseiten</strong><span>${summary.paragraphCount}</span></p>
        </div>

        <div class="recursive-page-list">
          ${linkedPages.map((linkedPage) => renderRecursivePage(linkedPage)).join("")}
        </div>
      </div>
    </details>
  `;
}

function renderRecursivePage(linkedPage: LinkedPageAnalysis): string {
  const title = linkedPage.title ?? linkedPage.finalUrl ?? linkedPage.url;
  const pageUrl = linkedPage.finalUrl ?? linkedPage.url;
  const { internalLinks, externalLinks } = splitLinksByOrigin(linkedPage.links, pageUrl);
  const headingList =
    linkedPage.topHeadings.length > 0
      ? `<ul class="result-list">${linkedPage.topHeadings
          .map((heading) => `<li>${escapeHtml(heading)}</li>`)
          .join("")}</ul>`
      : '<p class="muted">Keine Hauptüberschriften gefunden.</p>';

  if (linkedPage.error) {
    return `
      <details class="linked-page-details">
        <summary class="linked-page-summary">
          <div class="linked-page-summary-main">
            <span class="linked-page-summary-title">${escapeHtml(title)}</span>
            <span class="linked-page-summary-subtitle">${escapeHtml(pageUrl)}</span>
          </div>
          <span class="status-pill status-pill-error">Fehler</span>
        </summary>
        <div class="linked-page-body">
          <div class="data-grid child-data-grid">
            <p><strong>URL</strong><span>${escapeHtml(pageUrl)}</span></p>
            <p><strong>Status</strong><span>Fehler</span></p>
          </div>
          <p class="child-page-error">${escapeHtml(linkedPage.error)}</p>
        </div>
      </details>
    `;
  }

  return `
    <details class="linked-page-details">
      <summary class="linked-page-summary">
        <div class="linked-page-summary-main">
          <span class="linked-page-summary-title">${escapeHtml(title)}</span>
          <span class="linked-page-summary-subtitle">${escapeHtml(pageUrl)}</span>
        </div>
        <span class="status-pill">Status ${linkedPage.statusCode ?? "-"}</span>
      </summary>

      <div class="linked-page-body">
        <div class="data-grid child-data-grid">
          <p><strong>Sprache</strong><span>${escapeHtml(linkedPage.language ?? "-")}</span></p>
          <p><strong>Meta Description</strong><span>${escapeHtml(linkedPage.metaDescription ?? "-")}</span></p>
          <p><strong>Absätze</strong><span>${linkedPage.paragraphCount}</span></p>
          <p><strong>Links</strong><span>${linkedPage.linkCount}</span></p>
          <p><strong>Interne Links</strong><span>${internalLinks.length}</span></p>
          <p><strong>Externe Links</strong><span>${externalLinks.length}</span></p>
          <p><strong>Bilder</strong><span>${linkedPage.imageCount}</span></p>
          <p><strong>Überschriften</strong><span>${linkedPage.headingCount}</span></p>
        </div>

        <div class="recursive-subsection">
          <h4>Gefundene Hauptüberschriften</h4>
          <div class="scroll-panel">
            ${headingList}
          </div>
        </div>

        <div class="link-groups child-link-groups">
          <div class="link-group-card">
            <div class="section-heading">
              <h4>Interne Unterseiten-Links</h4>
              <span class="counter-pill">${internalLinks.length}</span>
            </div>
            <div class="scroll-panel">
              ${renderLinkList(internalLinks, "Keine internen Links auf dieser Unterseite gefunden.")}
            </div>
          </div>

          <div class="link-group-card">
            <div class="section-heading">
              <h4>Externe Unterseiten-Links</h4>
              <span class="counter-pill counter-pill-secondary">${externalLinks.length}</span>
            </div>
            <div class="scroll-panel">
              ${renderLinkList(externalLinks, "Keine externen Links auf dieser Unterseite gefunden.")}
            </div>
          </div>
        </div>

        <div class="recursive-subsection">
          <h4>Textauszug</h4>
          <div class="scroll-panel">
            <p>${escapeHtml(linkedPage.textSample || "Kein Textauszug verfügbar.")}</p>
          </div>
        </div>
      </div>
    </details>
  `;
}

function summarizeLinkedPages(linkedPages: LinkedPageAnalysis[]): {
  successCount: number;
  errorCount: number;
  internalLinkCount: number;
  externalLinkCount: number;
  paragraphCount: number;
} {
  return linkedPages.reduce(
    (summary, linkedPage) => {
      const pageUrl = linkedPage.finalUrl ?? linkedPage.url;
      const { internalLinks, externalLinks } = splitLinksByOrigin(linkedPage.links, pageUrl);

      return {
        successCount: summary.successCount + (linkedPage.error ? 0 : 1),
        errorCount: summary.errorCount + (linkedPage.error ? 1 : 0),
        internalLinkCount: summary.internalLinkCount + internalLinks.length,
        externalLinkCount: summary.externalLinkCount + externalLinks.length,
        paragraphCount: summary.paragraphCount + linkedPage.paragraphCount,
      };
    },
    {
      successCount: 0,
      errorCount: 0,
      internalLinkCount: 0,
      externalLinkCount: 0,
      paragraphCount: 0,
    }
  );
}

function showError(elements: AppElements, message: string): void {
  elements.error.textContent = message;
  elements.error.style.display = "block";
  elements.input.classList.add("is-invalid");
}

function clearError(elements: AppElements): void {
  elements.error.textContent = "";
  elements.error.style.display = "none";
  elements.input.classList.remove("is-invalid");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

if (typeof document !== "undefined") {
  initializeApp();
}
