import { Metadata } from "next";
import { QaBoard } from "@/components/internal-boards/QaBoard";
import qaData from "@/data/qa-board.json";
import tasksData from "@/data/tasks-board.json";
import type { QaBoardData, TasksBoardData } from "@/types/internal-boards";

export const metadata: Metadata = {
  title: "Ready Set | QA Board",
  description: "Internal QA test case dashboard.",
};

const qa = qaData as QaBoardData;
const tasks = tasksData as TasksBoardData;

const relatedTasksByQaKey: Record<string, { id: string; title: string; status: string }[]> = {};
for (const t of tasks.tasks) {
  if (!t.relatedQa) continue;
  const list = relatedTasksByQaKey[t.relatedQa] ?? [];
  list.push({ id: t.id, title: t.title, status: t.status });
  relatedTasksByQaKey[t.relatedQa] = list;
}

export default function QaBoardPage() {
  return <QaBoard data={qa} relatedTasksByQaKey={relatedTasksByQaKey} />;
}
