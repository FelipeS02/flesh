import { describe, expect, it } from "vitest";
import { toSafeHtml } from "./sanitize";

// Threat-matrix case (b): merchant description HTML is the one field that
// reaches the DOM as markup. Today the fixtures are ours, but this function
// is the guard that has to already be in place at the live-API swap — which
// is the whole reason the port exists.

describe("toSafeHtml — attacks", () => {
  it("discards a <script> tag AND its contents, not just the tag", () => {
    const result = toSafeHtml('<p>hola</p><script>alert("xss")</script>');

    expect(result).not.toContain("script");
    expect(result).not.toContain("alert");
    expect(result).toContain("<p>hola</p>");
  });

  it("strips event-handler attributes from otherwise allowlisted tags", () => {
    const result = toSafeHtml('<p onclick="alert(1)">hola</p>');

    expect(result).toBe("<p>hola</p>");
  });

  it("drops a tag carrying onerror entirely when the tag is not allowlisted", () => {
    const result = toSafeHtml('<img src="x" onerror="alert(1)">');

    expect(result).not.toContain("img");
    expect(result).not.toContain("onerror");
  });

  it("drops a javascript: href while keeping the link text", () => {
    const result = toSafeHtml('<a href="javascript:alert(1)">click</a>');

    expect(result).not.toContain("javascript:");
    expect(result).toContain("click");
  });

  it("drops non-http(s) schemes such as data:", () => {
    const result = toSafeHtml(
      '<a href="data:text/html;base64,PHNjcmlwdD4=">click</a>',
    );

    expect(result).not.toContain("data:");
    expect(result).toContain("click");
  });
});

describe("toSafeHtml — allowlist", () => {
  it("keeps the formatting merchants actually use", () => {
    const markup =
      "<p><strong>Bold</strong> <em>italic</em> <b>b</b> <i>i</i> <u>u</u><br /></p>" +
      "<h2>H2</h2><h3>H3</h3><h4>H4</h4>" +
      "<ul><li>one</li></ul><ol><li>two</li></ol>" +
      "<span>span</span>";

    const result = toSafeHtml(markup);

    for (const tag of [
      "p",
      "strong",
      "em",
      "b",
      "i",
      "u",
      "br",
      "h2",
      "h3",
      "h4",
      "ul",
      "ol",
      "li",
      "span",
    ]) {
      expect(result).toContain(`<${tag}`);
    }
  });

  it("keeps an http(s) link with its href and title", () => {
    const result = toSafeHtml(
      '<a href="https://flesh.example/x" title="ficha">ver</a>',
    );

    expect(result).toContain('href="https://flesh.example/x"');
    expect(result).toContain('title="ficha"');
  });

  it("forces rel=\"noopener noreferrer\" on links it keeps", () => {
    const result = toSafeHtml('<a href="https://flesh.example/x">ver</a>');

    expect(result).toContain('rel="noopener noreferrer"');
  });

  it("overwrites an attacker-supplied rel rather than trusting it", () => {
    const result = toSafeHtml(
      '<a href="https://flesh.example/x" rel="opener">ver</a>',
    );

    expect(result).toContain('rel="noopener noreferrer"');
    expect(result).not.toContain('rel="opener"');
  });

  it("drops attributes that are not allowlisted for a kept tag", () => {
    const result = toSafeHtml('<p class="danger" style="color:red">hola</p>');

    expect(result).toBe("<p>hola</p>");
  });
});
