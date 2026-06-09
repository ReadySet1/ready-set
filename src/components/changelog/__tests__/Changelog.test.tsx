import { render, screen, within } from "@testing-library/react";
import { Changelog } from "@/components/changelog/Changelog";
import type { ChangelogData } from "@/types/changelog";

const data: ChangelogData = {
  title: "What's New at Ready Set",
  subtitle: "Product updates, in plain language",
  entries: [
    {
      version: "2.2.0",
      date: "2026-06-01",
      title: "Newer release",
      summary: "Summary two",
      changes: [
        { type: "new", text: "Added a new thing." },
        { type: "improved", text: "Improved a thing." },
        { type: "fixed", text: "Fixed a thing." },
      ],
    },
    {
      version: "2.1.0",
      date: "2026-05-13",
      title: "Older release",
      summary: "Summary one",
      changes: [{ type: "new", text: "First feature." }],
    },
  ],
};

describe("Changelog", () => {
  it("renders the header title and subtitle", () => {
    render(<Changelog data={data} />);
    expect(screen.getByText("What's New at Ready Set")).toBeInTheDocument();
    expect(
      screen.getByText("Product updates, in plain language"),
    ).toBeInTheDocument();
  });

  it("renders entries newest-first", () => {
    render(<Changelog data={data} />);
    const headings = screen.getAllByRole("heading", { level: 2 });
    expect(headings[0]).toHaveTextContent("Newer release");
    expect(headings[1]).toHaveTextContent("Older release");
  });

  it("maps change types to New/Improved/Fixed badge labels", () => {
    render(<Changelog data={data} />);
    const newer = screen.getByText("Newer release").closest("article")!;
    const scoped = within(newer);
    expect(scoped.getByText("New")).toBeInTheDocument();
    expect(scoped.getByText("Improved")).toBeInTheDocument();
    expect(scoped.getByText("Fixed")).toBeInTheDocument();
    expect(scoped.getByText("Added a new thing.")).toBeInTheDocument();
  });

  it("renders an empty-state message when there are no entries", () => {
    render(
      <Changelog data={{ title: "t", subtitle: "s", entries: [] }} />,
    );
    expect(screen.getByText(/No updates to show yet/i)).toBeInTheDocument();
  });
});
