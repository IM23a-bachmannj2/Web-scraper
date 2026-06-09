const form = document.getElementById("w-form");
const input = document.getElementById("website");
const error = document.getElementById("error");
const results = document.getElementById("results");
const apiBasePath = window.location.pathname.replace(/^\/projects\//, "/api/");
const apiUrl = `${window.location.origin}${apiBasePath}api/analyze`;

if (!form || !input || !error || !results) {
  throw new Error("Required DOM elements not found");
}

renderEmptyState();

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const value = input.value.trim();

  if (!value) {
    showError("URL must not be empty");
    return;
  }

  if (!isValidUrl(value)) {
    showError("Please enter a valid URL (http/https)");
    return;
  }

  clearError();
  renderLoadingState(value);

  try {
    const response = await fetch(new URL(apiUrl), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: value }),
    });

    const payload = await response.json();

    if (!response.ok || "error" in payload) {
      showError("error" in payload ? payload.error : "Analyse fehlgeschlagen");
      renderEmptyState();
      return;
    }

    renderResults(payload);
  } catch {
    showError("Server nicht erreichbar. Bitte Backend starten.");
    renderEmptyState();
  }
});

function renderResults(data) {
  const links = Array.isArray(data.links) ? data.links : [];
  const topHeadings = Array.isArray(data.topHeadings) ? data.topHeadings : [];
  const linkedPages = Array.isArray(data.linkedPages) ? data.linkedPages : [];
  const finalUrl = data.finalUrl || "";
  const { internalLinks, externalLinks } = splitLinksByOrigin(links, finalUrl);
  const summaryTitle = escapeHtml(data.title || getHostnameLabel(finalUrl) || finalUrl || "Analyzed page");

  const headings =
    topHeadings.length > 0
      ? `<ul class="result-list">${topHeadings.map((heading) => `<li>${escapeHtml(heading)}</li>`).join("")}</ul>`
      : '<p class="muted">Keine Überschriften gefunden.</p>';

  const internalLinksMarkup = renderLinkList(internalLinks, "Keine internen Links gefunden.");
  const externalLinksMarkup = renderLinkList(externalLinks, "Keine externen Links gefunden.");
  const recursiveSearchMarkup = renderRecursiveSearch(linkedPages);

  results.innerHTML = `
    <section class="analysis-layout">
      <div class="analysis-hero">
        <div class="analysis-copy">
          <p class="eyebrow">Analyse abgeschlossen</p>
          <h2>${summaryTitle}</h2>
          <p class="analysis-subtitle">${escapeHtml(finalUrl || "-")}</p>
        </div>

        <div class="analysis-badges">
          <span class="status-pill">Status ${data.statusCode}</span>
          <span class="counter-pill counter-pill-secondary">${linkedPages.length} Unterseiten</span>
        </div>
      </div>

      <section class="result-section">
        <div class="section-heading">
          <div>
            <h3>Basisdaten</h3>
            <p class="section-description">Die wichtigsten Werte der analysierten Seite auf einen Blick.</p>
          </div>
        </div>
        <div class="data-grid">
          <p><strong>Status</strong><span>${data.statusCode}</span></p>
          <p><strong>URL</strong><span>${escapeHtml(finalUrl || "-")}</span></p>
          <p><strong>Title</strong><span>${escapeHtml(data.title ?? "-")}</span></p>
          <p><strong>Meta Description</strong><span>${escapeHtml(data.metaDescription ?? "-")}</span></p>
          <p><strong>Sprache</strong><span>${escapeHtml(data.language ?? "-")}</span></p>
          <p><strong>Absätze</strong><span>${data.paragraphCount}</span></p>
          <p><strong>Links</strong><span>${data.linkCount}</span></p>
          <p><strong>Bilder</strong><span>${data.imageCount}</span></p>
          <p><strong>Überschriften insgesamt</strong><span>${data.headingCount}</span></p>
        </div>
      </section>

      <section class="result-section">
        <div class="section-heading">
          <div>
            <h3>Erkannte Überschriften</h3>
            <p class="section-description">Die ersten markanten Strukturpunkte der Seite.</p>
          </div>
        </div>
        <div class="scroll-panel">
          ${headings}
        </div>
      </section>

      <section class="result-section">
        <div class="section-heading">
          <div>
            <h3>Link-Verteilung</h3>
            <p class="section-description">Aufgeteilt nach internen und externen Verweisen.</p>
          </div>
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
      </section>

      <section class="result-section">
        <div class="section-heading">
          <div>
            <h3>Textauszug</h3>
            <p class="section-description">Ein kurzer Eindruck vom extrahierten Fließtext.</p>
          </div>
        </div>
        <div class="scroll-panel">
          <p>${escapeHtml(data.textSample || "-")}</p>
        </div>
      </section>

      ${recursiveSearchMarkup}
    </section>
  `;
}

function renderEmptyState() {
  results.innerHTML = `
    <section class="empty-state">
      <p class="eyebrow">Bereit</p>
      <h2>Starte mit einer URL.</h2>
      <p>
        Die Analyse zeigt dir Metadaten, Inhaltsstruktur, Link-Aufteilung und
        eine kompakte Tiefenanalyse in einer lesbaren Ansicht.
      </p>
    </section>
  `;
}

function renderLoadingState(url) {
  const hostnameLabel = getHostnameLabel(url) || url;

  results.innerHTML = `
    <section class="loading-state">
      <span class="loading-orb" aria-hidden="true"></span>
      <div>
        <p class="eyebrow">Analyse läuft</p>
        <h2>${escapeHtml(hostnameLabel)}</h2>
        <p class="muted">Webseite wird geprüft und die Daten werden aufbereitet.</p>
      </div>
    </section>
  `;
}

function renderLinkList(links, emptyMessage) {
  if (links.length === 0) {
    return `<p class="muted">${emptyMessage}</p>`;
  }

  return `<ul class="link-list">${links
    .map((link) => `<li><a href="${escapeHtml(link)}" target="_blank" rel="noopener noreferrer">${escapeHtml(link)}</a></li>`)
    .join("")}</ul>`;
}

function renderRecursiveSearch(linkedPages) {
  const summary = summarizeLinkedPages(linkedPages);

  if (linkedPages.length === 0) {
    return `
      <details class="recursive-details result-section" open>
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
    <details class="recursive-details result-section" open>
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

function renderRecursivePage(linkedPage) {
  const title = linkedPage.title ?? linkedPage.finalUrl ?? linkedPage.url ?? "Unbekannte Seite";
  const pageUrl = linkedPage.finalUrl ?? linkedPage.url ?? "-";
  const childLinks = Array.isArray(linkedPage.links) ? linkedPage.links : [];
  const childHeadings = Array.isArray(linkedPage.topHeadings) ? linkedPage.topHeadings : [];
  const { internalLinks, externalLinks } = splitLinksByOrigin(childLinks, pageUrl);
  const headingList =
    childHeadings.length > 0
      ? `<ul class="result-list">${childHeadings.map((heading) => `<li>${escapeHtml(heading)}</li>`).join("")}</ul>`
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

function summarizeLinkedPages(linkedPages) {
  return linkedPages.reduce(
    (summary, linkedPage) => {
      const pageUrl = linkedPage.finalUrl ?? linkedPage.url;
      const childLinks = Array.isArray(linkedPage.links) ? linkedPage.links : [];
      const { internalLinks, externalLinks } = splitLinksByOrigin(childLinks, pageUrl);

      return {
        successCount: summary.successCount + (linkedPage.error ? 0 : 1),
        errorCount: summary.errorCount + (linkedPage.error ? 1 : 0),
        internalLinkCount: summary.internalLinkCount + internalLinks.length,
        externalLinkCount: summary.externalLinkCount + externalLinks.length,
        paragraphCount: summary.paragraphCount + (Number(linkedPage.paragraphCount) || 0),
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

function splitLinksByOrigin(links, baseUrl) {
  let baseOrigin = "";

  try {
    baseOrigin = new URL(baseUrl).origin;
  } catch {
    return { internalLinks: [], externalLinks: [...links] };
  }

  const internalLinks = [];
  const externalLinks = [];

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

function isValidUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function showError(message) {
  error.textContent = message;
  error.style.display = "block";
  input.classList.add("is-invalid");
}

function clearError() {
  error.textContent = "";
  error.style.display = "none";
  input.classList.remove("is-invalid");
}

function getHostnameLabel(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
