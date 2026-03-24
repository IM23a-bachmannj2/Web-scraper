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
                        links: ["https://example.com/about", "https://example.com/contact"],
                        imageCount: 1,
                        headingCount: 2,
                        topHeadings: ["Hello"],
                        textSample: "Sample text",
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
    });
});
