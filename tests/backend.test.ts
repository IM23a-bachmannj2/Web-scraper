import { isValidHttpUrl, extractLinks } from "../src/backend"; // Pfad anpassen

describe("Backend Unit Tests", () => {

    // -------------------------
    // TEST 1: isValidHttpUrl
    // -------------------------
    it("should validate correct URLs", () => {
        // Arrange
        const validUrl = "https://example.com";
        const invalidUrl = "not-a-url";

        // Act
        const validResult = isValidHttpUrl(validUrl);
        const invalidResult = isValidHttpUrl(invalidUrl);

        // Assert
        expect(validResult).toBe(true);
        expect(invalidResult).toBe(false);
    });

    // -------------------------
    // TEST 2: extractLinks
    // -------------------------
    it("should extract http links from HTML and normalize duplicates", () => {
        // Arrange
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

        const baseUrl = "https://example.com";

        // Act
        const result = extractLinks(html, baseUrl);

        // Assert
        expect(result).not.toBeNull();
        expect(result.length).toBe(2);

        expect(result).toContain("https://example.com/page1");
        expect(result).toContain("https://example.com/page2");
        expect(result).not.toContain("mailto:test@example.com");
    });
});
