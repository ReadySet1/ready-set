import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TasksBoard } from "../TasksBoard";
import type { TasksBoardData } from "@/types/internal-boards";

// Minimal fixture covering all four statuses and two filter-matchable tags.
const fixture: TasksBoardData = {
  title: "Tasks Board",
  subtitle: "Test subtitle",
  generated: "2026-10-12",
  sources: ["meeting"],
  columns: [
    { key: "done", title: "✓ Done" },
    { key: "progress", title: "◐ In Progress" },
    { key: "open", title: "○ Open" },
    { key: "new", title: "★ New" },
  ],
  owners: { fernando: "Fernando", emmanuel: "Emmanuel" },
  sourceLabels: { meeting: "Meeting" },
  tasks: [
    {
      id: "t1",
      status: "done",
      title: "Done task",
      owner: "fernando",
      source: "meeting",
    },
    {
      id: "t2",
      status: "progress",
      title: "Progress task",
      owner: "emmanuel",
      source: "meeting",
      tags: ["bug"],
    },
    {
      id: "t3",
      status: "open",
      title: "Open task",
      owner: "fernando",
      source: "meeting",
      tags: ["critical"],
    },
    {
      id: "t4",
      status: "new",
      title: "New task",
      owner: "emmanuel",
      source: "meeting",
    },
    {
      id: "t5",
      status: "new",
      title: "Another new task",
      owner: "fernando",
      source: "meeting",
      tags: ["bug"],
      description: "A description",
    },
  ],
};

const emptyQaSummary: Record<string, { summary: string; verdict: string }> = {};

describe("TasksBoard", () => {
  it("renders one tab per column with the correct counts", () => {
    render(<TasksBoard data={fixture} qaSummaryByKey={emptyQaSummary} />);

    const tablist = screen.getByRole("tablist");
    const tabs = within(tablist).getAllByRole("tab");
    expect(tabs).toHaveLength(4);

    // Tab labels include the status label and count
    expect(tabs[0]).toHaveTextContent("Done");
    expect(tabs[0]).toHaveTextContent("1");
    expect(tabs[1]).toHaveTextContent("In Progress");
    expect(tabs[1]).toHaveTextContent("1");
    expect(tabs[2]).toHaveTextContent("Open");
    expect(tabs[2]).toHaveTextContent("1");
    expect(tabs[3]).toHaveTextContent("New");
    expect(tabs[3]).toHaveTextContent("2");
  });

  it("selects the 'new' tab by default and hides other columns", () => {
    render(<TasksBoard data={fixture} qaSummaryByKey={emptyQaSummary} />);

    const tabs = screen.getAllByRole("tab");
    const newTab = tabs[3]!;
    expect(newTab).toHaveAttribute("aria-selected", "true");

    // The other three tabs are not selected
    expect(tabs[0]).toHaveAttribute("aria-selected", "false");
    expect(tabs[1]).toHaveAttribute("aria-selected", "false");
    expect(tabs[2]).toHaveAttribute("aria-selected", "false");

    // Non-active columns carry the "hidden" class (CSS-driven mobile show/hide)
    const donePanel = document.getElementById("tasks-col-done")!;
    const newPanel = document.getElementById("tasks-col-new")!;
    expect(donePanel.className).toContain("hidden");
    expect(newPanel.className).not.toContain("hidden");
  });

  it("clicking a tab switches selection", async () => {
    const user = userEvent.setup();
    render(<TasksBoard data={fixture} qaSummaryByKey={emptyQaSummary} />);

    const tabs = screen.getAllByRole("tab");
    const doneTab = tabs[0]!;
    await user.click(doneTab);

    expect(doneTab).toHaveAttribute("aria-selected", "true");
    expect(tabs[3]).toHaveAttribute("aria-selected", "false");

    const donePanel = document.getElementById("tasks-col-done")!;
    const newPanel = document.getElementById("tasks-col-new")!;
    expect(donePanel.className).not.toContain("hidden");
    expect(newPanel.className).toContain("hidden");
  });

  it("toggling a filter updates column and tab counts, Clear resets", async () => {
    const user = userEvent.setup();
    render(<TasksBoard data={fixture} qaSummaryByKey={emptyQaSummary} />);

    // Click the "bug" filter
    const bugButton = screen.getByRole("button", { name: /bug · 2/i });
    await user.click(bugButton);

    // Tab counts should reflect the filter
    const tabs = screen.getAllByRole("tab");
    // Done: 0 bug tasks, Progress: 1 bug, Open: 0, New: 1 bug
    expect(tabs[0]).toHaveTextContent("0");
    expect(tabs[1]).toHaveTextContent("1");
    expect(tabs[2]).toHaveTextContent("0");
    expect(tabs[3]).toHaveTextContent("1");

    // Clear resets
    const clearButton = screen.getByRole("button", { name: /clear/i });
    await user.click(clearButton);

    expect(tabs[0]).toHaveTextContent("1");
    expect(tabs[3]).toHaveTextContent("2");
  });

  it("clicking a card opens the dialog with the task title", async () => {
    const user = userEvent.setup();
    render(<TasksBoard data={fixture} qaSummaryByKey={emptyQaSummary} />);

    // Switch to the "done" tab so the card is visible
    const doneTab = screen.getAllByRole("tab")[0]!;
    await user.click(doneTab);

    const card = screen.getByRole("button", { name: /done task/i });
    await user.click(card);

    // The modal renders the task title as an h2 heading (via DialogPrimitive.Title).
    // The column headers are also h2 but use uppercase text like "DONE", so matching
    // the exact mixed-case "Done task" uniquely targets the modal.
    expect(
      screen.getByRole("heading", { name: "Done task", level: 2 }),
    ).toBeInTheDocument();

    // Dismiss hint is only rendered inside the modal
    expect(screen.getByText(/esc or click outside/i)).toBeInTheDocument();
  });
});
