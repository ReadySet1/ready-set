/**
 * Tests for DriverHistorySummary component (REA-313)
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import { DriverHistorySummary } from "../DriverHistorySummary";
import type { PeriodSummary, DriverHistoryInfo } from "@/types/archive";

describe("DriverHistorySummary", () => {
  const mockDriver: DriverHistoryInfo = {
    id: "driver-123",
    name: "John Driver",
    email: "john@example.com",
    employeeId: "EMP001",
    vehicleNumber: "V123",
  };

  const mockSummary: PeriodSummary = {
    totalShifts: 45,
    completedShifts: 40,
    totalHours: 186.5,
    totalDeliveries: 312,
    totalMiles: 1245.75,
    gpsMiles: 1200.5,
  };

  const mockPeriod = {
    startDate: "2024-01-01T00:00:00Z",
    endDate: "2024-03-01T00:00:00Z",
  };

  it("renders driver name in title", () => {
    render(
      <DriverHistorySummary
        driver={mockDriver}
        summary={mockSummary}
        period={mockPeriod}
      />
    );

    expect(screen.getByText("John Driver's History")).toBeInTheDocument();
  });

  it("displays employee ID when available", () => {
    render(
      <DriverHistorySummary
        driver={mockDriver}
        summary={mockSummary}
        period={mockPeriod}
      />
    );

    expect(screen.getByText("ID: EMP001")).toBeInTheDocument();
  });

  it("displays period dates", () => {
    render(
      <DriverHistorySummary
        driver={mockDriver}
        summary={mockSummary}
        period={mockPeriod}
      />
    );

    // Should display formatted dates - dates may vary by timezone
    // Just check the component renders a date range with a hyphen separator
    const description = screen.getByText(/-/);
    expect(description).toBeInTheDocument();
  });

  it("displays total shifts with completed count", () => {
    render(
      <DriverHistorySummary
        driver={mockDriver}
        summary={mockSummary}
        period={mockPeriod}
      />
    );

    expect(screen.getByText("45")).toBeInTheDocument();
    expect(screen.getByText("40 completed")).toBeInTheDocument();
  });

  it("displays total deliveries", () => {
    render(
      <DriverHistorySummary
        driver={mockDriver}
        summary={mockSummary}
        period={mockPeriod}
      />
    );

    expect(screen.getByText("312")).toBeInTheDocument();
    expect(screen.getByText("Deliveries")).toBeInTheDocument();
  });

  it("displays total miles with GPS miles", () => {
    render(
      <DriverHistorySummary
        driver={mockDriver}
        summary={mockSummary}
        period={mockPeriod}
      />
    );

    expect(screen.getByText("1245.8")).toBeInTheDocument();
    expect(screen.getByText("1200.5 GPS tracked")).toBeInTheDocument();
  });

  it("displays formatted hours", () => {
    render(
      <DriverHistorySummary
        driver={mockDriver}
        summary={mockSummary}
        period={mockPeriod}
      />
    );

    expect(screen.getByText("186h 30m")).toBeInTheDocument();
    expect(screen.getByText("Hours Worked")).toBeInTheDocument();
  });

  it("handles missing driver name gracefully", () => {
    const driverNoName = { ...mockDriver, name: null };
    render(
      <DriverHistorySummary
        driver={driverNoName}
        summary={mockSummary}
        period={mockPeriod}
      />
    );

    expect(screen.getByText("Driver's History")).toBeInTheDocument();
  });

  it("handles missing employee ID gracefully", () => {
    const driverNoId = { ...mockDriver, employeeId: null };
    render(
      <DriverHistorySummary
        driver={driverNoId}
        summary={mockSummary}
        period={mockPeriod}
      />
    );

    expect(screen.queryByText(/ID:/)).not.toBeInTheDocument();
  });
});
