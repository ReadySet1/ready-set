import React from "react";
import { render, screen } from "@testing-library/react";
import { TasksBoard } from "../TasksBoard";
import type { TasksBoardData, TasksBoardTask } from "@/types/internal-boards";

const baseTask: TasksBoardTask = {
  id: "t1",
  title: "Example card",
  status: "open",
  owner: "emmanuel",
  source: "qa",
};

function makeData(tasks: TasksBoardTask[]): TasksBoardData {
  return {
    title: "Tasks",
    subtitle: "",
    generated: "2026-10-15",
    sources: ["qa"],
    columns: [
      { key: "done", title: "Done" },
      { key: "progress", title: "In progress" },
      { key: "open", title: "Open" },
      { key: "new", title: "New" },
    ],
    owners: { emmanuel: "Emmanuel" },
    sourceLabels: { qa: "QA" },
    tasks,
  };
}

describe("TasksBoard date pills", () => {
  it("shows an 'added' pill when the card has a created date", () => {
    render(
      <TasksBoard
        data={makeData([{ ...baseTask, created: "2026-09-23" }])}
        qaSummaryByKey={{}}
      />,
    );
    expect(screen.getByText("added 2026-09-23")).toBeInTheDocument();
    expect(screen.queryByText(/^closed /)).not.toBeInTheDocument();
  });

  it("shows a 'closed' pill only on done cards", () => {
    render(
      <TasksBoard
        data={makeData([
          {
            ...baseTask,
            id: "done-card",
            status: "done",
            created: "2026-09-23",
            closed: "2026-10-12",
          },
          {
            ...baseTask,
            id: "open-card",
            title: "Still open",
            closed: "2026-10-12",
          },
        ])}
        qaSummaryByKey={{}}
      />,
    );
    expect(screen.getAllByText("closed 2026-10-12")).toHaveLength(1);
  });

  it("renders no date pills for undated cards", () => {
    render(<TasksBoard data={makeData([baseTask])} qaSummaryByKey={{}} />);
    expect(screen.queryByText(/^added /)).not.toBeInTheDocument();
    expect(screen.queryByText(/^closed /)).not.toBeInTheDocument();
  });
});
