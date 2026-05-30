import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Metadata } from "next";
import { remark } from "remark";
import remarkHtml from "remark-html";

export const metadata: Metadata = {
  title: "Ready Set | Technical Changelog",
  description: "Internal technical changelog (CHANGELOG.md).",
};

// Read + render at build time. CHANGELOG.md lives at the repo root.
async function getChangelogHtml(): Promise<string> {
  try {
    const filePath = join(process.cwd(), "CHANGELOG.md");
    const markdown = readFileSync(filePath, "utf8");
    const processed = await remark().use(remarkHtml).process(markdown);
    return processed.toString();
  } catch {
    return "<p>CHANGELOG.md could not be loaded.</p>";
  }
}

export default async function AdminChangelogPage() {
  const html = await getChangelogHtml();

  return (
    <div className="flex min-h-full flex-1 flex-col bg-slate-50/50">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-4 py-4 backdrop-blur sm:px-6">
        <div className="mx-auto max-w-[900px]">
          <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">
            Technical Changelog
          </h1>
          <p className="mt-0.5 text-sm text-slate-600">
            Rendered from <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">CHANGELOG.md</code>{" "}
            · release-please generated
          </p>
        </div>
      </header>

      <div className="mx-auto w-full max-w-[900px] px-4 py-8 sm:px-6">
        <article
          className="changelog-prose text-slate-700"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
            .changelog-prose h1 { font-size: 1.5rem; font-weight: 700; color: #0f172a; margin: 1.5rem 0 0.75rem; }
            .changelog-prose h2 { font-size: 1.25rem; font-weight: 600; color: #0f172a; margin: 2rem 0 0.5rem; padding-bottom: 0.25rem; border-bottom: 1px solid #e2e8f0; }
            .changelog-prose h3 { font-size: 1.05rem; font-weight: 600; color: #1e293b; margin: 1.25rem 0 0.5rem; }
            .changelog-prose h4 { font-size: 0.95rem; font-weight: 600; color: #334155; margin: 1rem 0 0.25rem; }
            .changelog-prose p { margin: 0.5rem 0; line-height: 1.6; }
            .changelog-prose ul { list-style: disc; margin: 0.5rem 0 0.5rem 1.25rem; }
            .changelog-prose ol { list-style: decimal; margin: 0.5rem 0 0.5rem 1.25rem; }
            .changelog-prose li { margin: 0.25rem 0; line-height: 1.55; }
            .changelog-prose li > ul, .changelog-prose li > ol { margin-top: 0.25rem; }
            .changelog-prose a { color: #2563eb; text-decoration: underline; }
            .changelog-prose code { background: #f1f5f9; border-radius: 4px; padding: 0.1rem 0.35rem; font-size: 0.85em; }
            .changelog-prose pre { background: #0f172a; color: #e2e8f0; border-radius: 8px; padding: 1rem; overflow-x: auto; }
            .changelog-prose pre code { background: transparent; padding: 0; }
            .changelog-prose strong { font-weight: 600; color: #0f172a; }
            .changelog-prose hr { border: none; border-top: 1px solid #e2e8f0; margin: 2rem 0; }
            .changelog-prose blockquote { border-left: 3px solid #cbd5e1; padding-left: 1rem; color: #475569; margin: 0.75rem 0; }
          `,
        }}
      />
    </div>
  );
}
