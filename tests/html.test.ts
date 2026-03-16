// ABOUTME: Direct unit tests for the escapeHtml security-critical utility.
// ABOUTME: Ensures XSS prevention by testing all HTML special character escaping.

import { describe, it, expect } from "vitest";
import { escapeHtml } from "../shared/html";

describe("escapeHtml", () => {
  it("escapes angle brackets", () => {
    expect(escapeHtml("<div>")).toBe("&lt;div&gt;");
  });

  it("escapes ampersands", () => {
    expect(escapeHtml("a & b")).toBe("a &amp; b");
  });

  it("escapes double quotes", () => {
    expect(escapeHtml('value="x"')).toBe("value=&quot;x&quot;");
  });

  it("escapes single quotes", () => {
    expect(escapeHtml("it's")).toBe("it&#39;s");
  });

  it("returns empty string unchanged", () => {
    expect(escapeHtml("")).toBe("");
  });

  it("returns safe string unchanged", () => {
    expect(escapeHtml("hello world 123")).toBe("hello world 123");
  });

  it("escapes all special chars in combination", () => {
    expect(escapeHtml('<script>alert("x\'ss")</script> & more')).toBe(
      "&lt;script&gt;alert(&quot;x&#39;ss&quot;)&lt;/script&gt; &amp; more"
    );
  });

  it("handles already-escaped entities (re-escapes)", () => {
    expect(escapeHtml("&amp;")).toBe("&amp;amp;");
  });

  it("handles multi-line strings with HTML", () => {
    const input = '<p>Line 1</p>\n<p class="x">Line 2</p>';
    const expected =
      '&lt;p&gt;Line 1&lt;/p&gt;\n&lt;p class=&quot;x&quot;&gt;Line 2&lt;/p&gt;';
    expect(escapeHtml(input)).toBe(expected);
  });

  it("returns type string", () => {
    expect(typeof escapeHtml("test")).toBe("string");
    expect(typeof escapeHtml("")).toBe("string");
  });
});
