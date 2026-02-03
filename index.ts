const form = document.getElementById("w-form") as HTMLFormElement | null;
const input = document.getElementById("website") as HTMLInputElement | null;
const error = document.getElementById("error") as HTMLParagraphElement | null;

if (!form || !input || !error) {
    throw new Error("Required DOM elements not found");
}

form.addEventListener("submit", (event: SubmitEvent) => {
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

function isValidUrl(url: string): boolean {
    try {
        const parsed = new URL(url);
        return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
        return false;
    }
}

function showError(message: string): void {
    error!.textContent = message;
    error!.style.display = "block";
    input!.classList.add("is-invalid");
}

function clearError(): void {
    error!.textContent = "";
    error!.style.display = "none";
    input!.classList.remove("is-invalid");
}