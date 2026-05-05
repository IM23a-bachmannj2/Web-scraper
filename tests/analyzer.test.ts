import { analyzeWebsite, extractLinks, isValidHttpUrl } from "../src/index";

describe("Website analysis", () => {
  it("validates correct URLs", () => {
    expect(isValidHttpUrl("https://example.com")).toBe(true);
    expect(isValidHttpUrl("http://example.com")).toBe(true);
    expect(isValidHttpUrl("not-a-url")).toBe(false);
  });

  it("extracts http links from HTML and normalizes duplicates", () => {
    const html = `
      <html>
        <body>
          <a href="https://example.com/page1">Link 1</a>
          <a href="/page2#top">Link 2</a>
          <a href="/page2#bottom">Link 3</a>
          <a href="mailto:test@example.com">Mail</a>
        </body>
      </html>
    `;

    expect(extractLinks(html, "https://example.com")).toEqual([
      "https://example.com/page1",
      "https://example.com/page2",
    ]);
  });

  it("analyzes a reachable website and collects same-site linked pages one level deep", async () => {
    const rootHtml = `
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
          <a href="https://other-site.example/contact">Contact</a>
          <img src="/hero.png" alt="hero" />
        </body>
      </html>
    `;
    const childHtml = `
      <html lang="de">
        <head>
          <title>About Example</title>
          <meta name="description" content="About sub page" />
        </head>
        <body>
          <h1>About Us</h1>
          <p>Linked page content for one level deep crawling.</p>
        </body>
      </html>
    `;
    const fetchMock = jest.fn(async (input: RequestInfo | URL) => {
      const requestedUrl = input.toString();

      if (requestedUrl === "https://example.com") {
        return createResponse(rootHtml, "https://example.com/final-page");
      }

      if (requestedUrl === "https://example.com/about") {
        return createResponse(childHtml, "https://example.com/about");
      }

      throw new Error(`Unexpected URL requested during test: ${requestedUrl}`);
    }) as jest.MockedFunction<typeof fetch>;

    const payload = await analyzeWebsite("https://example.com", fetchMock);

    expect(payload.finalUrl).toBe("https://example.com/final-page");
    expect(payload.title).toBe("Integration Test Page");
    expect(payload.metaDescription).toBe("Metadata from integration test");
    expect(payload.language).toBe("de");
    expect(payload.paragraphCount).toBe(2);
    expect(payload.linkCount).toBe(2);
    expect(payload.imageCount).toBe(1);
    expect(payload.headingCount).toBe(2);
    expect(payload.topHeadings).toEqual(["Headline One", "Headline Two"]);
    expect(payload.links).toEqual(["https://example.com/about", "https://other-site.example/contact"]);
    expect(payload.linkedPages).toHaveLength(1);
    expect(payload.linkedPages[0]).toMatchObject({
      finalUrl: "https://example.com/about",
      title: "About Example",
      metaDescription: "About sub page",
      paragraphCount: 1,
      linkCount: 0,
      headingCount: 1,
      topHeadings: ["About Us"],
      error: null,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("limits headings and crawls each same-site link only once", async () => {
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
    const fetchMock = jest.fn(async (input: RequestInfo | URL) =>
      createResponse(html, input.toString())
    ) as jest.MockedFunction<typeof fetch>;

    const payload = await analyzeWebsite("https://example.com/articles", fetchMock);

    expect(payload.headingCount).toBe(9);
    expect(payload.topHeadings).toEqual(["One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight"]);
    expect(payload.links).toEqual(["https://example.com/same-link"]);
    expect(payload.linkedPages).toHaveLength(1);
    expect(payload.linkedPages[0]?.error).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("keeps the root analysis successful when a linked page fails", async () => {
    const fetchMock = jest.fn(async (input: RequestInfo | URL) => {
      const requestedUrl = input.toString();

      if (requestedUrl === "https://example.com") {
        return createResponse(
          `
            <html>
              <head>
                <title>Root Page</title>
              </head>
              <body>
                <h1>Root</h1>
                <a href="/broken">Broken</a>
              </body>
            </html>
          `,
          "https://example.com"
        );
      }

      if (requestedUrl === "https://example.com/broken") {
        return createResponse("", requestedUrl, 404);
      }

      throw new Error(`Unexpected URL requested during test: ${requestedUrl}`);
    }) as jest.MockedFunction<typeof fetch>;

    const payload = await analyzeWebsite("https://example.com", fetchMock);

    expect(payload.title).toBe("Root Page");
    expect(payload.linkedPages).toHaveLength(1);
    expect(payload.linkedPages[0]).toMatchObject({
      url: "https://example.com/broken",
      statusCode: null,
      error: "Webseite nicht erreichbar (Status 404).",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("rejects invalid URLs before calling fetch", async () => {
    const fetchMock = jest.fn() as jest.MockedFunction<typeof fetch>;

    await expect(analyzeWebsite("not-a-valid-url", fetchMock)).rejects.toThrow("gültige http/https URL");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("surfaces upstream status errors", async () => {
    const fetchMock = jest.fn(async () => createResponse("", "https://example.com/missing", 404)) as jest.MockedFunction<
      typeof fetch
    >;

    await expect(analyzeWebsite("https://example.com/missing", fetchMock)).rejects.toThrow("Status 404");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("surfaces browser fetch errors for blocked cross-origin requests", async () => {
    const fetchMock = jest.fn(async () => {
      throw new TypeError("Failed to fetch");
    }) as jest.MockedFunction<typeof fetch>;

    await expect(analyzeWebsite("https://example.com/offline", fetchMock)).rejects.toThrow("CORS-Freigabe");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

function createResponse(html: string, url: string, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    url,
    text: async () => html,
  } as Response;
}
