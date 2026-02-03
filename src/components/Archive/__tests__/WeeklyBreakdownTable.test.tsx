/**
 * Tests for WeeklyBreakdownTable component (REA-313)
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import { WeeklyBreakdownTable } from "../WeeklyBreakdownTable";
import type { WeeklySummary } from "@/types/archive";

describe("WeeklyBreakdownTable", () => {
  const mockSummaries: WeeklySummary[] = [
    {
      weekStart: "2024-02-26T00:00:00Z",
      weekEnd: "2024-03-03T00:00:00Z",
      year: 2024,
      weekNumber: 9,
      totalShifts: 5,
      completedShifts: 5,
      totalShiftHours: 40,
      totalDeliveries: 35,
      completedDeliveries: 35,
      totalMiles: 150.5,
      gpsMiles: 145,
    },
    {
      weekStart: "2024-02-19T00:00:00Z",
      weekEnd: "2024-02-25T00:00:00Z",
      year: 2024,
      weekNumber: 8,
      totalShifts: 4,
      completedShifts: 3,
      totalShiftHours: 32.5,
      totalDeliveries: 28,
      completedDeliveries: 25,
      totalMiles: 120,
      gpsMiles: 115,
    },
  ];

  it("renders weekly breakdown table", () => {
    render(<WeeklyBreakdownTable summaries={mockSummaries} />);

    expect(screen.getByText("Weekly Breakdown")).toBeInTheDocument();
    expect(
      screen.getByText("Performance data broken down by week")
    ).toBeInTheDocument();
  });

  it("displays week numbers", () => {
    render(<WeeklyBreakdownTable summaries={mockSummaries} />);

    expect(screen.getByText("Week 9")).toBeInTheDocument();
    expect(screen.getByText("Week 8")).toBeInTheDocument();
  });

  it("displays shifts column with completed count", () => {
    render(<WeeklyBreakdownTable summaries={mockSummaries} />);

    // Week 9: 5 shifts (5 completed)
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("(5)")).toBeInTheDocument();
  });

  it("displays deliveries", () => {
    render(<WeeklyBreakdownTable summaries={mockSummaries} />);

    expect(screen.getByText("35")).toBeInTheDocument();
    expect(screen.getByText("28")).toBeInTheDocument();
  });

  it("displays miles with decimal", () => {
    render(<WeeklyBreakdownTable summaries={mockSummaries} />);

    expect(screen.getByText("150.5")).toBeInTheDocument();
    expect(screen.getByText("120.0")).toBeInTheDocument();
  });

  it("displays formatted hours", () => {
    render(<WeeklyBreakdownTable summaries={mockSummaries} />);

    expect(screen.getByText("40h")).toBeInTheDocument();
    expect(screen.getByText("32h 30m")).toBeInTheDocument();
  });

  it("displays totals row", () => {
    render(<WeeklyBreakdownTable summaries={mockSummaries} />);

    expect(screen.getByText("Total")).toBeInTheDocument();
    // Total shifts: 5 + 4 = 9
    expect(screen.getByText("9")).toBeInTheDocument();
    // Total deliveries: 35 + 28 = 63
    expect(screen.getByText("63")).toBeInTheDocument();
  });

  it("displays empty state when no summaries", () => {
    render(<WeeklyBreakdownTable summaries={[]} />);

    expect(
      screen.getByText("No weekly summary data available for the selected period")
    ).toBeInTheDocument();
  });
});
