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
        ? `<ul>${data.topHeadings.map((heading) => `<li>${escapeHtml(heading)}</li>`).join("")}</ul>`
        : "<p>Keine Überschriften gefunden.</p>";
    results.innerHTML = `
    <h2>Basisdaten</h2>
    <p><strong>Status:</strong> ${data.statusCode}</p>
    <p><strong>URL:</strong> ${escapeHtml(data.finalUrl)}</p>
    <p><strong>Title:</strong> ${escapeHtml(data.title ?? "-")}</p>
    <p><strong>Meta Description:</strong> ${escapeHtml(data.metaDescription ?? "-")}</p>
    <p><strong>Sprache:</strong> ${escapeHtml(data.language ?? "-")}</p>
    <p><strong>Absätze:</strong> ${data.paragraphCount}</p>
    <p><strong>Links:</strong> ${data.linkCount}</p>
    <p><strong>Bilder:</strong> ${data.imageCount}</p>
    <p><strong>Überschriften insgesamt:</strong> ${data.headingCount}</p>
    <h3>Erkannte Überschriften</h3>
    ${headings}
    <h3>Textauszug</h3>
    <p>${escapeHtml(data.textSample || "-")}</p>
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