import http, { type IncomingHttpHeaders, type Server } from "node:http";
import { type AddressInfo } from "node:net";
import { app } from "../src/backend";
import { SuccessfulWebsiteFetchDouble } from "./doubles/SuccessfulWebsiteFetchDouble";
import { ThrowingWebsiteFetchDouble } from "./doubles/ThrowingWebsiteFetchDouble";
import { UnavailableWebsiteFetchDouble } from "./doubles/UnavailableWebsiteFetchDouble";

interface HttpResponse {
  statusCode: number;
  body: string;
  headers: IncomingHttpHeaders;
}

const originalFetch = global.fetch;

describe("Backend Integration Tests", () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    server = await new Promise<Server>((resolve) => {
      const startedServer = app.listen(0, "127.0.0.1", () => {
        resolve(startedServer);
      });
    });

    const address = server.address();

    if (!address || typeof address === "string") {
      throw new Error("Test server address could not be resolved");
    }

    baseUrl = `http://127.0.0.1:${(address as AddressInfo).port}`;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  });

  it("should serve the frontend entry page", async () => {
    const response = await sendRequest(baseUrl, "GET", "/");

    expect(response.statusCode).toBe(200);
    expect(response.body).toContain('id="w-form"');
    expect(response.headers["content-type"]).toContain("text/html");
  });

  it("should analyze a reachable website and return extracted metadata", async () => {
    const html = `
      <html lang="de">
        <head>
          <title>Integration Test Page</title>
          <meta name="description" content="Metadata from integration test" />
        </head>
        <body>
          <h1>Headline One</h1>
          <h2>Headline Two</h2>
          <p>First paragraph for the sample body.</p>
          <p>Second paragraph with more sample text.</p>
          <a href="/about">About</a>
          <a href="https://example.com/contact">Contact</a>
          <img src="/hero.png" alt="hero" />
        </body>
      </html>
    `;
    const fetchDouble = new SuccessfulWebsiteFetchDouble(html, "https://example.com/final-page");

    global.fetch = fetchDouble.fetch.bind(fetchDouble) as typeof fetch;

    const response = await sendRequest(baseUrl, "POST", "/api/analyze", {
      url: "https://example.com",
    });
    const payload = JSON.parse(response.body) as {
      finalUrl: string;
      title: string;
      metaDescription: string;
      language: string;
      paragraphCount: number;
      linkCount: number;
      imageCount: number;
      headingCount: number;
      topHeadings: string[];
      links: string[];
    };

    expect(response.statusCode).toBe(200);
    expect(payload.finalUrl).toBe("https://example.com/final-page");
    expect(payload.title).toBe("Integration Test Page");
    expect(payload.metaDescription).toBe("Metadata from integration test");
    expect(payload.language).toBe("de");
    expect(payload.paragraphCount).toBe(2);
    expect(payload.linkCount).toBe(2);
    expect(payload.imageCount).toBe(1);
    expect(payload.headingCount).toBe(2);
    expect(payload.topHeadings).toEqual(["Headline One", "Headline Two"]);
    expect(payload.links).toEqual(["https://example.com/about", "https://example.com/contact"]);
    expect(fetchDouble.calls).toHaveLength(1);
    expect(fetchDouble.calls[0]?.init).toMatchObject({
      redirect: "follow",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; WebScraperBot/1.0)" },
    });
  });

  it("should limit headings and keep fetch double reusable across tests", async () => {
    const html = `
      <html>
        <body>
          <h1>One</h1>
          <h2>Two</h2>
          <h3>Three</h3>
          <h1>Four</h1>
          <h2>Five</h2>
          <h3>Six</h3>
          <h1>Seven</h1>
          <h2>Eight</h2>
          <h3>Nine</h3>
          <a href="/same-link">Duplicate A</a>
          <a href="/same-link">Duplicate B</a>
        </body>
      </html>
    `;
    const fetchDouble = new SuccessfulWebsiteFetchDouble(html);

    global.fetch = fetchDouble.fetch.bind(fetchDouble) as typeof fetch;

    const response = await sendRequest(baseUrl, "POST", "/api/analyze", {
      url: "https://example.com/articles",
    });
    const payload = JSON.parse(response.body) as {
      headingCount: number;
      topHeadings: string[];
      links: string[];
    };

    expect(response.statusCode).toBe(200);
    expect(payload.headingCount).toBe(9);
    expect(payload.topHeadings).toEqual(["One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight"]);
    expect(payload.links).toEqual(["https://example.com/same-link"]);
    expect(fetchDouble.calls).toHaveLength(1);
  });

  it("should reject invalid URLs before calling the external fetch", async () => {
    const fetchDouble = new SuccessfulWebsiteFetchDouble("<html></html>");

    global.fetch = fetchDouble.fetch.bind(fetchDouble) as typeof fetch;

    const response = await sendRequest(baseUrl, "POST", "/api/analyze", {
      url: "not-a-valid-url",
    });
    const payload = JSON.parse(response.body) as { error: string };

    expect(response.statusCode).toBe(400);
    expect(payload.error).toContain("gültige http/https URL");
    expect(fetchDouble.calls).toHaveLength(0);
  });

  it("should surface upstream status errors as bad requests", async () => {
    const fetchDouble = new UnavailableWebsiteFetchDouble(404);

    global.fetch = fetchDouble.fetch.bind(fetchDouble) as typeof fetch;

    const response = await sendRequest(baseUrl, "POST", "/api/analyze", {
      url: "https://example.com/missing",
    });
    const payload = JSON.parse(response.body) as { error: string };

    expect(response.statusCode).toBe(400);
    expect(payload.error).toContain("Status 404");
    expect(fetchDouble.calls).toHaveLength(1);
  });

  it("should return a server error when the external fetch throws", async () => {
    const fetchDouble = new ThrowingWebsiteFetchDouble(new Error("DNS lookup failed"));

    global.fetch = fetchDouble.fetch.bind(fetchDouble) as typeof fetch;

    const response = await sendRequest(baseUrl, "POST", "/api/analyze", {
      url: "https://example.com/offline",
    });
    const payload = JSON.parse(response.body) as { error: string };

    expect(response.statusCode).toBe(500);
    expect(payload.error).toContain("Analyse fehlgeschlagen");
    expect(fetchDouble.calls).toHaveLength(1);
  });
});

async function sendRequest(baseUrl: string, method: string, pathname: string, body?: unknown): Promise<HttpResponse> {
  const payload = body ? JSON.stringify(body) : undefined;

  return new Promise<HttpResponse>((resolve, reject) => {
    const request = http.request(
      new URL(pathname, baseUrl),
      {
        method,
        headers: payload
          ? {
              "Content-Length": Buffer.byteLength(payload),
              "Content-Type": "application/json",
            }
          : undefined,
      },
      (response) => {
        const chunks: Buffer[] = [];

        response.on("data", (chunk: Buffer | string) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });

        response.on("end", () => {
          resolve({
            statusCode: response.statusCode ?? 500,
            body: Buffer.concat(chunks).toString("utf-8"),
            headers: response.headers,
          });
        });
      }
    );

    request.on("error", reject);

    if (payload) {
      request.write(payload);
    }

    request.end();
  });
}
