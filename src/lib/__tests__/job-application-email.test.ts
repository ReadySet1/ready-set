import { buildJobApplicationEmailHtml } from "@/lib/job-application-email";

jest.mock("@/lib/site-url", () => ({
  siteUrl: (path: string) => `https://readysetllc.com${path}`,
}));

const baseApplication = {
  id: "app-123",
  firstName: "Ada",
  lastName: "Lovelace",
  email: "ada@example.com",
  position: "Driver",
  message: null,
};

describe("buildJobApplicationEmailHtml", () => {
  it("lists every applicant field with a readable label", () => {
    const html = buildJobApplicationEmailHtml(baseApplication, []);

    expect(html).toContain("<li><strong>First Name:</strong> Ada</li>");
    expect(html).toContain("<li><strong>Position:</strong> Driver</li>");
    expect(html).toContain("<li><strong>Message:</strong> N/A</li>");
  });

  it("links the application ID to the admin list dialog", () => {
    const html = buildJobApplicationEmailHtml(baseApplication, []);

    expect(html).toContain(
      '<a href="https://readysetllc.com/admin/job-applications?id=app-123">app-123</a>',
    );
  });

  it("escapes HTML in applicant-supplied fields", () => {
    const html = buildJobApplicationEmailHtml(
      {
        ...baseApplication,
        firstName: '<img src=x onerror="alert(1)">',
        message: "<script>steal()</script> & more",
      },
      [],
    );

    expect(html).not.toContain("<img");
    expect(html).not.toContain("<script>");
    expect(html).toContain(
      "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;",
    );
    expect(html).toContain("&lt;script&gt;steal()&lt;/script&gt; &amp; more");
  });

  it("escapes uploaded file names and URLs", () => {
    const html = buildJobApplicationEmailHtml(baseApplication, [
      {
        category: null,
        fileName: "<b>cv</b>.pdf",
        fileUrl: 'https://files.example.com/cv.pdf" onmouseover="x()',
      },
      { category: null, fileName: "<i>id</i>.png", fileUrl: null },
    ]);

    expect(html).not.toContain("<b>");
    expect(html).not.toContain("<i>");
    expect(html).toContain(
      '<a href="https://files.example.com/cv.pdf&quot; onmouseover=&quot;x()" target="_blank">Open File</a>',
    );
    expect(html).toContain("Link unavailable (Original Name: &lt;i&gt;id&lt;/i&gt;.png)");
  });

  it("only links https file URLs", () => {
    const html = buildJobApplicationEmailHtml(baseApplication, [
      { category: "license", fileName: "license.png", fileUrl: "javascript:alert(1)" },
      { category: "insurance", fileName: "ins.pdf", fileUrl: "not a url" },
    ]);

    expect(html).not.toContain("href=\"javascript:");
    expect(html).toContain(
      "<li><strong>License:</strong> Link unavailable (Original Name: license.png)</li>",
    );
    expect(html).toContain(
      "<li><strong>Insurance:</strong> Link unavailable (Original Name: ins.pdf)</li>",
    );
  });

  it("formats the shapes a real application row carries", () => {
    const html = buildJobApplicationEmailHtml(
      {
        ...baseApplication,
        resumeFilePath: "applications/app-123/cv.pdf",
        phone: "",
        createdAt: new Date("2026-01-01T00:00:00Z"),
      },
      [],
    );

    expect(html).toContain(
      "<li><strong>Resume File Path:</strong> applications/app-123/cv.pdf</li>",
    );
    expect(html).toContain("<li><strong>Phone:</strong> N/A</li>");
    expect(html).toContain(
      "<li><strong>Created At:</strong> 2026-01-01T00:00:00.000Z</li>",
    );
  });

  it("closes the applicant list before the documents section", () => {
    const html = buildJobApplicationEmailHtml(baseApplication, [
      { category: "resume", fileName: "cv.pdf", fileUrl: "https://files.example.com/cv.pdf" },
    ]);

    expect(html).toContain("</ul><h2>Uploaded Documents:</h2><ul>");
    expect(html.endsWith("</ul>")).toBe(true);
    expect(html.match(/<ul>/g)).toHaveLength(2);
    expect(html.match(/<\/ul>/g)).toHaveLength(2);
  });

  it("uses the capitalized category as the link text when present", () => {
    const html = buildJobApplicationEmailHtml(baseApplication, [
      { category: "resume", fileName: "cv.pdf", fileUrl: "https://files.example.com/cv.pdf" },
    ]);

    expect(html).toContain("<li><strong>Resume:</strong> <a href=");
  });
});
