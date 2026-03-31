import { type Express } from "express";
export declare const app: Express;
export declare function startServer(): import("node:http").Server<typeof import("node:http").IncomingMessage, typeof import("node:http").ServerResponse>;
export declare function isValidHttpUrl(value: string): boolean;
export declare function extractLinks(html: string, baseUrl: string): string[];
//# sourceMappingURL=backend.d.ts.map