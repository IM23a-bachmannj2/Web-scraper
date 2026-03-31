import type { FetchCall } from "./SuccessfulWebsiteFetchDouble";

export class UnavailableWebsiteFetchDouble {
  public readonly calls: FetchCall[] = [];

  public constructor(
    private readonly statusCode: number = 503,
    private readonly finalUrl: string = "https://example.com/unavailable"
  ) {}

  public async fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    this.calls.push({ input, init });

    return {
      ok: false,
      status: this.statusCode,
      url: this.finalUrl,
      text: async () => "",
    } as Response;
  }
}
