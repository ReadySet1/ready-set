import { Metadata } from "next";
import { Changelog } from "@/components/changelog/Changelog";
import { MarkChangelogSeen } from "@/components/changelog/MarkChangelogSeen";
import changelogData from "@/data/changelog.json";
import type { ChangelogData } from "@/types/changelog";

export const metadata: Metadata = {
  title: "What's New | Ready Set",
  description: "Product updates and improvements at Ready Set, in plain language.",
};

const data = changelogData as ChangelogData;

export default function ChangelogPage() {
  return (
    <>
      <MarkChangelogSeen />
      <Changelog data={data} />
    </>
  );
}
