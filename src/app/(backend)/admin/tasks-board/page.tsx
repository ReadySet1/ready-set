import { Metadata } from "next";
import { TasksBoard } from "@/components/internal-boards/TasksBoard";
import tasksData from "@/data/tasks-board.json";
import qaData from "@/data/qa-board.json";
import { buildQaSummaryByKey } from "@/lib/internal-boards";
import type { QaBoardData, TasksBoardData } from "@/types/internal-boards";

export const metadata: Metadata = {
  title: "Ready Set | Tasks Board",
  description: "Internal tasks dashboard — promoted QA failures + meeting action items.",
};

const tasks = tasksData as TasksBoardData;
const qa = qaData as QaBoardData;
const qaSummaryByKey = buildQaSummaryByKey(qa);

export default function TasksBoardPage() {
  return <TasksBoard data={tasks} qaSummaryByKey={qaSummaryByKey} />;
}
