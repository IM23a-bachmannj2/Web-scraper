"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const form = document.getElementById("w-form");
const input = document.getElementById("website");
const error = document.getElementById("error");
const results = document.getElementById("results");
if (!form || !input || !error || !results) {
    throw new Error("Required DOM elements not found");
}
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
    results.innerHTML = "<p>Analysiere Webseite...</p>";
    try {
        const response = await fetch("/api/analyze", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: value }),
        });
        const payload = (await response.json());
        if (!response.ok || "error" in payload) {
            showError("error" in payload ? payload.error : "Analyse fehlgeschlagen");
            results.innerHTML = "";
            return;
        }
        renderResults(payload);
    }
    catch {
        showError("Server nicht erreichbar. Bitte Backend starten.");
        results.innerHTML = "";
    }
});
function renderResults(data) {
    const headings = data.topHeadings.length > 0
        ? `<ul class="result-list">${data.topHeadings.map((heading) => `<li>${escapeHtml(heading)}</li>`).join("")}</ul>`
        : '<p class="muted">Keine Überschriften gefunden.</p>';
    const links = data.links.length > 0
        ? `<ul class="link-list">${data.links
            .map((link) => `<li><a href="${escapeHtml(link)}" target="_blank" rel="noopener noreferrer">${escapeHtml(link)}</a></li>`)
            .join("")}</ul>`
        : '<p class="muted">Keine Links gefunden.</p>';
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

      <details class="link-details">
        <summary>Gefundene Links (${data.links.length})</summary>
        <div class="scroll-panel">
          ${links}
        </div>
      </details>

      <h3>Textauszug</h3>
      <div class="scroll-panel">
        <p>${escapeHtml(data.textSample || "-")}</p>
      </div>
    </section>
  `;
}
function isValidUrl(url) {
    try {
        const parsed = new URL(url);
        return parsed.protocol === "http:" || parsed.protocol === "https:";
    }
    catch {
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
function escapeHtml(value) {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
//# sourceMappingURL=index.js.map