/**
 * @jest-environment jsdom
 */

describe("Frontend Form Test", () => {
    beforeEach(() => {
        document.body.innerHTML = `
      <form id="w-form">
        <input id="website" />
        <p id="error"></p>
        <button type="submit">Submit</button>
      </form>
      <div id="results"></div>
    `;

        global.fetch = jest.fn(() =>
            Promise.resolve({
                ok: true,
                json: () =>
                    Promise.resolve({
                        statusCode: 200,
                        finalUrl: "https://example.com",
                        title: "Example Domain",
                        metaDescription: "Test",
                        language: "en",
                        paragraphCount: 3,
                        linkCount: 5,
                        links: ["https://example.com/about", "https://external.example/contact"],
                        imageCount: 1,
                        headingCount: 2,
                        topHeadings: ["Hello"],
                        textSample: "Sample text",
                        linkedPages: [
                            {
                                url: "https://example.com/about",
                                finalUrl: "https://example.com/about",
                                statusCode: 200,
                                title: "About Example",
                                metaDescription: "About page",
                                language: "en",
                                paragraphCount: 1,
                                linkCount: 0,
                                imageCount: 0,
                                headingCount: 1,
                                topHeadings: ["About"],
                                links: ["https://example.com/team", "https://external.example/legal"],
                                textSample: "Child sample text",
                                error: null,
                            },
                        ],
                    }),
            } as Response)
        ) as jest.Mock;

        jest.resetModules();
        require("../public/index.js");
    });

    it("should submit form and display results", async () => {
        // Arrange
        const input = document.getElementById("website") as HTMLInputElement;
        const form = document.getElementById("w-form") as HTMLFormElement;
        const results = document.getElementById("results")!;

        input.value = "https://example.com";

        // Act
        form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

        await new Promise((r) => setTimeout(r, 0));

        // Assert
        expect(fetch).toHaveBeenCalled();
        expect(results.innerHTML).toContain("Example Domain");
        expect(results.innerHTML).toContain("Interne Links");
        expect(results.innerHTML).toContain("Externe Links");
        expect(results.innerHTML).toContain("https://external.example/contact");
        expect(results.innerHTML).toContain("Tiefenanalyse (1 Ebene tief)");
        expect(results.innerHTML).toContain("Interne Unterseiten-Links");
        expect(results.innerHTML).toContain("Externe Unterseiten-Links");
        expect(results.innerHTML).toContain("https://example.com/team");
        expect(results.innerHTML).toContain("https://external.example/legal");
        expect(results.innerHTML).not.toContain("Seitenstruktur");
        expect(results.innerHTML).toContain("About Example");
    });
});
