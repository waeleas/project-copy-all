import { describe, expect, test } from "bun:test";
import { arabicError, errorReason } from "../src/lib/errors";

describe("truthful error causes", () => {
  test("login configuration failure is not missing username", () => {
    expect(errorReason(new Error("Missing Supabase environment variable(s): SUPABASE_URL"))).toBe("login_configuration");
  });
  test("unavailable server function is a page version problem", () => {
    expect(errorReason(new Error("Server function info not found for abc123"))).toBe("app_version");
  });
  test("non-single account lookup retains its database code", () => {
    expect(errorReason({ code: "PGRST116", message: "Rejected" })).toBe("multiple_records");
  });
  test("known server failures survive a plain Arabic result boundary", () => {
    const message = arabicError({ status: 503, message: "Rejected" });
    expect(arabicError({ message })).toBe(arabicError({ message: "Service unavailable" }));
    expect(message).not.toContain("Rejected");
  });
  test("generic TypeError is not evidence of weak internet", () => {
    expect(errorReason(new TypeError("Cannot read properties of null"))).toBe("unknown");
  });
  test("actual failed fetch is a connection failure", () => {
    expect(errorReason(new TypeError("Failed to fetch"))).toBe("network");
  });
  test("storage quota is not photo size", () => {
    expect(errorReason({ message: "Storage quota exceeded" })).toBe("quota");
  });
  test("actual payload rejection is file size", () => {
    expect(errorReason({ statusCode: "413", message: "Rejected" })).toBe("file_size");
  });
  test("expired login and denied permission are distinct", () => {
    expect(errorReason({ status: 401 })).toBe("session");
    expect(errorReason({ code: "42501" })).toBe("permission");
  });
  test("a server outage is not bad credentials", () => {
    expect(errorReason({ status: 503 })).toBe("server");
    expect(errorReason({ message: "Invalid login credentials" })).toBe("credentials");
  });
  test("broken JSON is a file parsing failure", () => {
    expect(errorReason(new SyntaxError("Unexpected token"))).toBe("file_parse");
  });
});