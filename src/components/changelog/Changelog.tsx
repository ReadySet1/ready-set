import { ExternalLink, Sparkles, Wrench, Bug } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  ChangelogChangeType,
  ChangelogData,
} from "@/types/changelog";

const TYPE_META: Record<
  ChangelogChangeType,
  { label: string; icon: React.ElementType; badge: string; dot: string }
> = {
  new: {
    label: "New",
    icon: Sparkles,
    badge: "bg-emerald-100 text-emerald-700",
    dot: "bg-emerald-500",
  },
  improved: {
    label: "Improved",
    icon: Wrench,
    badge: "bg-sky-100 text-sky-700",
    dot: "bg-sky-500",
  },
  fixed: {
    label: "Fixed",
    icon: Bug,
    badge: "bg-amber-100 text-amber-700",
    dot: "bg-amber-500",
  },
};

function formatDate(iso: string): string {
  // iso is YYYY-MM-DD; render in a readable, locale-stable form.
  const [y, m, d] = iso.split("-").map((n) => Number(n));
  if (!y || !m || !d) return iso;
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function Changelog({ data }: { data: ChangelogData }) {
  return (
    <main className="bg-white pb-24 pt-32 dark:bg-dark">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <header className="mb-12 border-b border-gray-200 pb-8 dark:border-dark-3">
          <h1 className="text-3xl font-bold text-dark dark:text-white sm:text-4xl">
            {data.title}
          </h1>
          <p className="mt-3 text-lg text-body-color dark:text-dark-6">
            {data.subtitle}
          </p>
        </header>

        {data.entries.length === 0 ? (
          <p className="text-body-color dark:text-dark-6">
            No updates to show yet. Check back soon.
          </p>
        ) : (
          <ol className="space-y-14">
            {data.entries.map((entry) => (
              <li key={entry.version}>
                <article>
                  <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
                      v{entry.version}
                    </span>
                    <time className="text-sm text-body-color dark:text-dark-6">
                      {formatDate(entry.date)}
                    </time>
                  </div>

                  <h2 className="text-2xl font-semibold text-dark dark:text-white">
                    {entry.title}
                  </h2>
                  {entry.summary ? (
                    <p className="mt-2 text-base text-body-color dark:text-dark-6">
                      {entry.summary}
                    </p>
                  ) : null}

                  <ul className="mt-6 space-y-3">
                    {entry.changes.map((change, i) => {
                      const meta = TYPE_META[change.type];
                      const Icon = meta.icon;
                      return (
                        <li
                          key={`${entry.version}-${i}`}
                          className="flex items-start gap-3"
                        >
                          <span
                            className={cn(
                              "mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium",
                              meta.badge,
                            )}
                          >
                            <Icon className="h-3 w-3" aria-hidden="true" />
                            {meta.label}
                          </span>
                          <span className="text-base text-dark dark:text-gray-200">
                            {change.text}
                          </span>
                        </li>
                      );
                    })}
                  </ul>

                  {entry.link ? (
                    <a
                      href={entry.link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                    >
                      {entry.link.label}
                      <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                    </a>
                  ) : null}
                </article>
              </li>
            ))}
          </ol>
        )}
      </div>
    </main>
  );
}

export default Changelog;
