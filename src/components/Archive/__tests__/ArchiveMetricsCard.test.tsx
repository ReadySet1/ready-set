/**
 * Tests for ArchiveMetricsCard component (REA-313)
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import { ArchiveMetricsCard } from "../ArchiveMetricsCard";
import type { ArchiveStatusResponse } from "@/types/archive";

describe("ArchiveMetricsCard", () => {
  const mockMetrics: ArchiveStatusResponse["metrics"] = {
    driverLocations: {
      eligibleCount: 100,
      oldestDate: "2024-01-01T00:00:00Z",
      activeCount: 5000,
      archivedCount: 10000,
    },
    driverShifts: {
      eligibleCount: 50,
      oldestDate: "2024-01-05T00:00:00Z",
      activeCount: 200,
      archivedCount: 500,
    },
    orders: {
      eligibleCateringCount: 20,
      eligibleOnDemandCount: 30,
      totalEligibleCount: 50,
      oldestCateringDate: "2024-01-02T00:00:00Z",
      oldestOnDemandDate: "2024-01-03T00:00:00Z",
      archivedCateringCount: 100,
      archivedOnDemandCount: 150,
      totalArchivedCount: 250,
    },
    weeklySummaries: {
      count: 100,
    },
  };

  const mockConfiguration: ArchiveStatusResponse["configuration"] = {
    locationsRetentionDays: 30,
    ordersRetentionDays: 30,
    shiftsRetentionWeeks: 5,
    batchSize: 1000,
    dryRunEnabled: false,
  };

  it("renders all metric categories", () => {
    render(
      <ArchiveMetricsCard
        metrics={mockMetrics}
        configuration={mockConfiguration}
      />
    );

    expect(screen.getByText("Driver Locations")).toBeInTheDocument();
    expect(screen.getByText("Driver Shifts")).toBeInTheDocument();
    expect(screen.getByText("Orders")).toBeInTheDocument();
    expect(screen.getByText("Weekly Summaries")).toBeInTheDocument();
  });

  it("displays active and archived counts", () => {
    render(
      <ArchiveMetricsCard
        metrics={mockMetrics}
        configuration={mockConfiguration}
      />
    );

    // Driver locations
    expect(screen.getByText("5,000")).toBeInTheDocument(); // active
    expect(screen.getByText("10,000")).toBeInTheDocument(); // archived
  });

  it("displays eligible count badges", () => {
    render(
      <ArchiveMetricsCard
        metrics={mockMetrics}
        configuration={mockConfiguration}
      />
    );

    expect(
      screen.getByText("100 eligible for archive")
    ).toBeInTheDocument();
    // There are two items with 50 eligible (shifts and orders)
    expect(
      screen.getAllByText("50 eligible for archive")
    ).toHaveLength(2);
  });

  it("displays retention periods", () => {
    render(
      <ArchiveMetricsCard
        metrics={mockMetrics}
        configuration={mockConfiguration}
      />
    );

    // There are two items with 30 days retention (locations and orders)
    expect(screen.getAllByText("Retention: 30 days")).toHaveLength(2);
    expect(screen.getByText("Retention: 5 weeks")).toBeInTheDocument();
    expect(screen.getByText("Retention: Permanent")).toBeInTheDocument();
  });

  it("shows dry-run warning when enabled", () => {
    const dryRunConfig = { ...mockConfiguration, dryRunEnabled: true };

    render(
      <ArchiveMetricsCard metrics={mockMetrics} configuration={dryRunConfig} />
    );

    expect(
      screen.getByText(/Dry-run mode is enabled/i)
    ).toBeInTheDocument();
  });

  it("does not show dry-run warning when disabled", () => {
    render(
      <ArchiveMetricsCard
        metrics={mockMetrics}
        configuration={mockConfiguration}
      />
    );

    expect(
      screen.queryByText(/Dry-run mode is enabled/i)
    ).not.toBeInTheDocument();
  });
});
