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

  it("uses the capitalized category as the link text when present", () => {
    const html = buildJobApplicationEmailHtml(baseApplication, [
      { category: "resume", fileName: "cv.pdf", fileUrl: "https://files.example.com/cv.pdf" },
    ]);

    expect(html).toContain("<li><strong>Resume:</strong> <a href=");
  });
});
