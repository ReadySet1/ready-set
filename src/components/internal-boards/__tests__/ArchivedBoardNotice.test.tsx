import React from "react";
import { render, screen } from "@testing-library/react";
import {
  ArchivedBoardNotice,
  DEV_TEAM_PENDINGS_URL,
} from "../ArchivedBoardNotice";

describe("ArchivedBoardNotice", () => {
  it("says the board is archived and since when", () => {
    render(<ArchivedBoardNotice />);

    const notice = screen.getByRole("note");
    expect(notice).toHaveTextContent(/archived on Nov 5, 2026/i);
    expect(notice).toHaveTextContent(/no longer updated/i);
  });

  it("links to the Slack list that replaced it, in a new tab", () => {
    render(<ArchivedBoardNotice />);

    const link = screen.getByRole("link", { name: /Dev Team Pendings/i });
    expect(link).toHaveAttribute("href", DEV_TEAM_PENDINGS_URL);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("points at the Ready Set Slack workspace", () => {
    expect(DEV_TEAM_PENDINGS_URL).toMatch(
      /^https:\/\/readysetgrouphq\.slack\.com\/lists\//,
    );
  });
});
