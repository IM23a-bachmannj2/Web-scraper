const form = document.getElementById("w-form");
const input = document.getElementById("website");
const error = document.getElementById("error");
if (!form || !input || !error) {
    throw new Error("Required DOM elements not found");
}
form.addEventListener("submit", (event) => {
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
    console.log("Valid URL:", value);
});
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
export {};
//# sourceMappingURL=index.js.map