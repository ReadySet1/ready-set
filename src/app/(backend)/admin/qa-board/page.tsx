import { Metadata } from "next";
import { QaBoard } from "@/components/internal-boards/QaBoard";
import qaData from "@/data/qa-board.json";
import tasksData from "@/data/tasks-board.json";
import { buildRelatedTasksByQaKey } from "@/lib/internal-boards";
import type { QaBoardData, TasksBoardData } from "@/types/internal-boards";

export const metadata: Metadata = {
  title: "Ready Set | QA Board",
  description: "Internal QA test case dashboard.",
};

const qa = qaData as QaBoardData;
const tasks = tasksData as TasksBoardData;
const relatedTasksByQaKey = buildRelatedTasksByQaKey(tasks.tasks);

export default function QaBoardPage() {
  return <QaBoard data={qa} relatedTasksByQaKey={relatedTasksByQaKey} />;
}
