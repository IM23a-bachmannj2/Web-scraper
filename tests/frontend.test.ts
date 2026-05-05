describe("Frontend form", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <form id="w-form">
        <input id="website" />
        <p id="error"></p>
        <button type="submit">Analyse starten</button>
      </form>
      <div id="results"></div>
    `;

    jest.resetModules();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("submits the form and displays analysis results", async () => {
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const requestedUrl = input.toString();

      if (requestedUrl === "https://example.com") {
        return createResponse(
          `
            <html lang="en">
              <head>
                <title>Example Domain</title>
                <meta name="description" content="Test" />
              </head>
              <body>
                <h1>Hello</h1>
                <p>Sample text</p>
                <a href="/about">About</a>
                <a href="https://external.example/contact">Contact</a>
                <img src="/hero.png" />
              </body>
            </html>
          `,
          "https://example.com"
        );
      }

      if (requestedUrl === "https://example.com/about") {
        return createResponse(
          `
            <html lang="en">
              <head>
                <title>About Example</title>
                <meta name="description" content="About page" />
              </head>
              <body>
                <h1>About</h1>
                <p>Child sample text</p>
                <a href="/team">Team</a>
                <a href="https://external.example/legal">Legal</a>
              </body>
            </html>
          `,
          "https://example.com/about"
        );
      }

      throw new Error(`Unexpected URL requested during test: ${requestedUrl}`);
    }) as jest.MockedFunction<typeof fetch>;

    loadApp();

    const input = document.getElementById("website") as HTMLInputElement;
    const form = document.getElementById("w-form") as HTMLFormElement;
    const results = document.getElementById("results") as HTMLDivElement;
    const button = form.querySelector("button") as HTMLButtonElement;

    input.value = "https://example.com";
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await flushAsyncWork();

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(results.innerHTML).toContain("Example Domain");
    expect(results.innerHTML).toContain("Interne Links");
    expect(results.innerHTML).toContain("Externe Links");
    expect(results.innerHTML).toContain("https://external.example/contact");
    expect(results.innerHTML).toContain("Tiefenanalyse (1 Ebene tief)");
    expect(results.innerHTML).toContain("Interne Unterseiten-Links");
    expect(results.innerHTML).toContain("Externe Unterseiten-Links");
    expect(results.innerHTML).toContain("https://example.com/team");
    expect(results.innerHTML).toContain("https://external.example/legal");
    expect(results.innerHTML).toContain("About Example");
    expect(button.disabled).toBe(false);
  });

  it("shows a validation error for invalid URLs", () => {
    global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>;

    loadApp();

    const input = document.getElementById("website") as HTMLInputElement;
    const form = document.getElementById("w-form") as HTMLFormElement;
    const error = document.getElementById("error") as HTMLParagraphElement;

    input.value = "not-a-url";
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    expect(global.fetch).not.toHaveBeenCalled();
    expect(error.textContent).toBe("Please enter a valid URL (http/https)");
  });

  it("shows a browser-side fetch error when the target blocks CORS", async () => {
    global.fetch = jest.fn(async () => {
      throw new TypeError("Failed to fetch");
    }) as jest.MockedFunction<typeof fetch>;

    loadApp();

    const input = document.getElementById("website") as HTMLInputElement;
    const form = document.getElementById("w-form") as HTMLFormElement;
    const error = document.getElementById("error") as HTMLParagraphElement;
    const results = document.getElementById("results") as HTMLDivElement;

    input.value = "https://example.com";
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await flushAsyncWork();

    expect(error.textContent).toContain("CORS-Freigabe");
    expect(results.innerHTML).toBe("");
  });
});

function loadApp(): void {
  const app = require("../src/index") as typeof import("../src/index");
  app.initializeApp();
}

async function flushAsyncWork(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function createResponse(html: string, url: string, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    url,
    text: async () => html,
  } as Response;
}
