import type { FetchCall } from "./SuccessfulWebsiteFetchDouble";

export class ThrowingWebsiteFetchDouble {
  public readonly calls: FetchCall[] = [];

  public constructor(private readonly error: Error = new Error("Network request failed")) {}

  public async fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    this.calls.push({ input, init });
    throw this.error;
  }
}
