export interface FetchCall {
  input: RequestInfo | URL;
  init?: RequestInit;
}

export class SuccessfulWebsiteFetchDouble {
  public readonly calls: FetchCall[] = [];

  public constructor(
    private readonly html: string,
    private readonly finalUrl: string = "https://example.com/final"
  ) {}

  public async fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    this.calls.push({ input, init });

    return {
      ok: true,
      status: 200,
      url: this.finalUrl,
      text: async () => this.html,
    } as Response;
  }
}
