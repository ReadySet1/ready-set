"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";
import { VideoPlayer } from "./VideoPlayer";
import {
  DriverButton,
  DriverCard,
  DriverScreen,
  Segmented,
} from "@/components/Driver/ui";

interface TrainingVideo {
  id: string;
  title: string;
  description: string;
  videoUrl: string;
}

const trainingVideos: TrainingVideo[] = [
  {
    id: "1",
    title: "Safe Driving Techniques",
    description: "Learn essential safe driving techniques for delivery drivers.",
    videoUrl: "KyxprzEto3Y",
  },
  {
    id: "2",
    title: "Efficient Route Planning",
    description: "Master the art of planning efficient delivery routes.",
    videoUrl: "KyxprzEto3Y",
  },
  {
    id: "3",
    title: "Customer Service Excellence",
    description:
      "Discover how to provide excellent customer service during deliveries.",
    videoUrl: "KyxprzEto3Y",
  },
];

type Filter = "all" | "todo" | "done";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "todo", label: "To do" },
  { value: "done", label: "Completed" },
];

/** Circular progress ring (% complete). */
function ProgressRing({ value }: { value: number }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const offset = c - (value / 100) * c;
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" className="shrink-0">
      <circle cx="32" cy="32" r={r} fill="none" strokeWidth="6" className="stroke-driver-surface-alt" />
      <circle
        cx="32"
        cy="32"
        r={r}
        fill="none"
        strokeWidth="6"
        strokeLinecap="round"
        className="stroke-driver-brand"
        strokeDasharray={c}
        strokeDashoffset={offset}
        transform="rotate(-90 32 32)"
      />
      <text
        x="32"
        y="32"
        textAnchor="middle"
        dominantBaseline="central"
        className="fill-driver-text text-[14px] font-extrabold"
      >
        {value}%
      </text>
    </svg>
  );
}

export function DeliveryDriverTraining() {
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [mounted, setMounted] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem("completedVideos");
    if (saved) setCompleted(new Set(JSON.parse(saved)));
  }, []);

  const toggle = (id: string) => {
    setCompleted((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      localStorage.setItem("completedVideos", JSON.stringify([...next]));
      return next;
    });
  };

  const progress = Math.round((completed.size / trainingVideos.length) * 100);
  const remaining = trainingVideos.length - completed.size;

  const visible = useMemo(() => {
    if (filter === "todo") return trainingVideos.filter((v) => !completed.has(v.id));
    if (filter === "done") return trainingVideos.filter((v) => completed.has(v.id));
    return trainingVideos;
  }, [filter, completed]);

  return (
    <DriverScreen title="Training" subtitle="Keep your training current">
      <div className="space-y-4">
        <DriverCard className="flex items-center gap-4">
          <ProgressRing value={mounted ? progress : 0} />
          <div className="min-w-0">
            <div className="text-[15px] font-extrabold text-driver-text">
              {progress === 100 ? "All caught up!" : "Keep your training current"}
            </div>
            <div className="text-[12.5px] font-semibold text-driver-muted">
              {completed.size} of {trainingVideos.length} modules complete
              {remaining > 0 ? ` · ${remaining} to go` : ""}
            </div>
          </div>
        </DriverCard>

        <Segmented options={FILTERS} value={filter} onChange={setFilter} aria-label="Training filter" />

        <div className="grid gap-4 md:grid-cols-2">
          {visible.map((video) => {
            const isDone = completed.has(video.id);
            return (
              <DriverCard key={video.id} className="space-y-3 p-0">
                <div className="relative overflow-hidden rounded-t-2xl">
                  <VideoPlayer videoUrl={video.videoUrl} title={video.title} />
                  {isDone ? (
                    <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-driver-success px-2 py-1 text-[11px] font-extrabold text-white shadow">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Done
                    </span>
                  ) : null}
                </div>
                <div className="space-y-3 p-4 pt-0">
                  <div className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.06em] text-driver-on-brand">
                    <GraduationCap className="h-3.5 w-3.5" />
                    Module
                  </div>
                  <div>
                    <h2 className="text-[14.5px] font-extrabold text-driver-text">
                      {video.title}
                    </h2>
                    <p className="mt-1 text-[12px] font-medium leading-relaxed text-driver-muted">
                      {video.description}
                    </p>
                  </div>
                  <DriverButton
                    variant={isDone ? "success" : "brand"}
                    size="sm"
                    full
                    onClick={() => toggle(video.id)}
                  >
                    {isDone ? "Mark as incomplete" : "Mark as complete"}
                  </DriverButton>
                </div>
              </DriverCard>
            );
          })}
        </div>
      </div>
    </DriverScreen>
  );
}
