import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { NavigateButton } from "../NavigateButton";
import { DriverThemeProvider } from "../DriverThemeProvider";

function renderWithTheme(ui: React.ReactElement) {
  return render(<DriverThemeProvider>{ui}</DriverThemeProvider>);
}

describe("NavigateButton", () => {
  const openSpy = jest.fn();

  beforeEach(() => {
    window.localStorage.clear();
    openSpy.mockReset();
    // jsdom has no real window.open
    window.open = openSpy as unknown as typeof window.open;
  });

  it("opens the default app (Google) with a directions URL on tap", () => {
    renderWithTheme(
      <NavigateButton
        target={{ lat: 37.79, lng: -122.45 }}
        label="Directions to pickup"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Directions to pickup" }));

    expect(openSpy).toHaveBeenCalledTimes(1);
    const url = String(openSpy.mock.calls[0][0]);
    expect(url).toContain("google.com/maps/dir/");
    expect(url).toContain(encodeURIComponent("37.79,-122.45"));
  });

  it("lets the driver switch maps app and remembers the choice", async () => {
    renderWithTheme(
      <NavigateButton target={{ lat: 37.79, lng: -122.45 }} label="Navigate" />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Choose navigation app" }));
    fireEvent.click(await screen.findByRole("button", { name: "Waze" }));

    expect(openSpy).toHaveBeenCalledTimes(1);
    expect(String(openSpy.mock.calls[0][0])).toContain("waze.com/ul");
    expect(window.localStorage.getItem("rs:driverNavApp")).toBe("waze");
  });
});
