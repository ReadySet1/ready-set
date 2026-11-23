import { Metadata } from "next";
import { ArchivedBoardNotice } from "@/components/internal-boards/ArchivedBoardNotice";
import { TasksBoard } from "@/components/internal-boards/TasksBoard";
import tasksData from "@/data/tasks-board.json";
import qaData from "@/data/qa-board.json";
import { buildQaSummaryByKey } from "@/lib/internal-boards";
import type { QaBoardData, TasksBoardData } from "@/types/internal-boards";

export const metadata: Metadata = {
  title: "Ready Set | Tasks Board (archived)",
  description:
    "Archived internal tasks dashboard. Pending work is tracked in the Slack list Dev Team Pendings.",
};

const tasks = tasksData as TasksBoardData;
const qa = qaData as QaBoardData;
const qaSummaryByKey = buildQaSummaryByKey(qa);

export default function TasksBoardPage() {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <ArchivedBoardNotice />
      <TasksBoard data={tasks} qaSummaryByKey={qaSummaryByKey} />
    </div>
  );
}
