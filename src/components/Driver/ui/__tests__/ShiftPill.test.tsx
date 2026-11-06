import React from "react";
import { act, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ShiftPill } from "../ShiftPill";
import { useDriverTracking } from "@/contexts/DriverTrackingContext";

jest.mock("@/contexts/DriverTrackingContext", () => ({
  useDriverTracking: jest.fn(),
}));

jest.mock("next/navigation", () => ({
  usePathname: () => "/driver",
}));

const mockUseDriverTracking = useDriverTracking as jest.MockedFunction<
  typeof useDriverTracking
>;

// Exactly what /api/tracking/shifts/active serializes (timestamptz → ISO Z).
const START_ISO = "2026-10-14T23:31:00.000Z";
const START_MS = Date.parse(START_ISO);

function ctx(clockOffsetMs: number) {
  return {
    isShiftActive: true,
    currentShift: { id: "s1", startTime: START_ISO, status: "active" },
    activeDeliveries: [],
    clockOffsetMs,
  } as any;
}

describe("ShiftPill", () => {
  afterEach(() => jest.useRealTimers());

  it("counts up from the shift start", () => {
    jest.useFakeTimers();
    jest.setSystemTime(START_MS + 90_000);
    mockUseDriverTracking.mockReturnValue(ctx(0));
    render(<ShiftPill />);
    expect(screen.getByText("1:30")).toBeInTheDocument();
    act(() => {
      jest.advanceTimersByTime(2_000);
    });
    expect(screen.getByText("1:32")).toBeInTheDocument();
  });

  // 2026-10-14: phone clock ~3,648 s behind the server → stuck at 0:00.
  it("does not stick at 0:00 when the device clock runs an hour behind", () => {
    const deviceSkewMs = -3_648_000;
    jest.useFakeTimers();
    jest.setSystemTime(START_MS + 90_000 + deviceSkewMs);
    mockUseDriverTracking.mockReturnValue(ctx(-deviceSkewMs));
    render(<ShiftPill />);
    expect(screen.queryByText("0:00")).not.toBeInTheDocument();
    expect(screen.getByText("1:30")).toBeInTheDocument();
  });
});
