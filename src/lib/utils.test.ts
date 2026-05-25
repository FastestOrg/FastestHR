import { describe, it, expect } from "vitest";
import { escapeHtml } from "./utils";

describe("escapeHtml", () => {
  it("should escape special HTML characters", () => {
    expect(escapeHtml("&")).toBe("&amp;");
    expect(escapeHtml("<")).toBe("&lt;");
    expect(escapeHtml(">")).toBe("&gt;");
    expect(escapeHtml('"')).toBe("&quot;");
    expect(escapeHtml("'")).toBe("&#039;");
  });

  it("should escape multiple occurrences of special HTML characters", () => {
    expect(escapeHtml("<<&>>")).toBe("&lt;&lt;&amp;&gt;&gt;");
    expect(escapeHtml("'\"'\"")).toBe("&#039;&quot;&#039;&quot;");
  });

  it("should escape special characters within normal text", () => {
    expect(escapeHtml('<script>alert("XSS & hacks")</script>')).toBe(
      "&lt;script&gt;alert(&quot;XSS &amp; hacks&quot;)&lt;/script&gt;"
    );
  });

  it("should return the original string if no special characters are present", () => {
    expect(escapeHtml("Hello World!")).toBe("Hello World!");
  });

  it("should return an empty string when given an empty string", () => {
    expect(escapeHtml("")).toBe("");
  });

  it("should return non-string inputs unmodified", () => {
    expect(escapeHtml(123 as any)).toBe(123 as any);
    expect(escapeHtml(null as any)).toBe(null as any);
    expect(escapeHtml(undefined as any)).toBe(undefined as any);

    const obj = { key: "value" };
    expect(escapeHtml(obj as any)).toBe(obj as any);

    const arr = [1, 2, 3];
    expect(escapeHtml(arr as any)).toBe(arr as any);
  });
});
