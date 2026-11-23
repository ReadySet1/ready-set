/**
 * Regression test for GlitchTip issue 17 (React error #418, args[]=text) on /blog.
 *
 * SingleBlog is a client component, so it is rendered twice: once on the server
 * (the VPS runs in UTC) and once in the browser during hydration. Every event of
 * issue 17 came from a browser in Asia/Shanghai. A post updated at 17:33 UTC is
 * "July 25" in UTC but "July 26" in UTC+8, so the date text differed between the
 * server HTML and the client's first render.
 */
import { renderToString } from "react-dom/server";
import SingleBlog from "../SingleBlog";
import { SimpleBlogCard } from "@/types/simple-blog-card";

jest.mock("@/sanity/lib/client", () => ({
  urlFor: () => ({ url: () => "https://cdn.example.com/image.jpg" }),
}));

const post = (id: string, updatedAt: string): SimpleBlogCard => ({
  _id: id,
  _updatedAt: updatedAt,
  title: `Post ${id}`,
  slug: { current: `post-${id}`, _type: "slug" },
});

// Real _updatedAt values from the production Sanity dataset (featured + grid post).
const posts = [
  post("featured", "2025-07-25T17:33:38Z"),
  post("grid", "2025-05-29T19:25:05Z"),
  // An evening-Pacific edit: the previous calendar day for CT/PT browsers.
  post("late", "2025-03-01T03:00:00Z"),
];

type LocaleMethod = "toLocaleDateString" | "toLocaleString" | "toLocaleTimeString";
const LOCALE_METHODS: LocaleMethod[] = [
  "toLocaleDateString",
  "toLocaleString",
  "toLocaleTimeString",
];

/**
 * Renders as if the runtime's default timezone were `timeZone`.
 *
 * Jest sandboxes process.env, so assigning process.env.TZ inside a test does not
 * change V8's default zone. Instead, locale-aware date APIs are wrapped so that a
 * call WITHOUT an explicit timeZone falls back to `timeZone` — exactly what the
 * real runtime does with its own default zone. Calls that pass a timeZone are
 * left untouched.
 */
const renderUnderTimeZone = (timeZone: string): string => {
  const originals = LOCALE_METHODS.map((m) => [m, Date.prototype[m]] as const);
  const OriginalDateTimeFormat = Intl.DateTimeFormat;

  for (const [method, original] of originals) {
    Date.prototype[method] = function (
      this: Date,
      locales?: Intl.LocalesArgument,
      options?: Intl.DateTimeFormatOptions,
    ) {
      return original.call(this, locales, { timeZone, ...options });
    };
  }
  const PatchedDateTimeFormat = function (
    locales?: Intl.LocalesArgument,
    options?: Intl.DateTimeFormatOptions,
  ) {
    return new OriginalDateTimeFormat(locales, { timeZone, ...options });
  } as unknown as typeof Intl.DateTimeFormat;
  Intl.DateTimeFormat = Object.assign(PatchedDateTimeFormat, OriginalDateTimeFormat);

  try {
    return renderToString(<SingleBlog data={posts} basePath="blog" />);
  } finally {
    for (const [method, original] of originals) {
      Date.prototype[method] = original as never;
    }
    Intl.DateTimeFormat = OriginalDateTimeFormat;
  }
};

describe("SingleBlog hydration", () => {
  it.each(["America/Chicago", "America/Los_Angeles", "Asia/Shanghai"])(
    "renders the same markup on a UTC server and a %s browser",
    (browserTimeZone) => {
      const serverHtml = renderUnderTimeZone("UTC");
      const clientHtml = renderUnderTimeZone(browserTimeZone);

      expect(clientHtml).toBe(serverHtml);
    },
  );

  it("shows the same calendar day as the server render (UTC) in a UTC+8 browser", () => {
    const html = renderUnderTimeZone("Asia/Shanghai");

    expect(html).toContain("July 25, 2025");
    expect(html).toContain("May 29, 2025");
  });
});
