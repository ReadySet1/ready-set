/**
 * Lightweight integration-style test for the push registration handler.
 * This test focuses on validation logic and does not hit external services.
 */

import { NextRequest } from "next/server";
import { POST } from "./route";

function createRequest(body: unknown): NextRequest {
  // @ts-expect-error - minimal implementation for test environment
  return new NextRequest("http://localhost/api/notifications/push/register", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/notifications/push/register", () => {
  it("rejects invalid payloads", async () => {
    const request = createRequest({ token: "" });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });
});


