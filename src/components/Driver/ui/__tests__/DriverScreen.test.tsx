import { render, screen } from "@testing-library/react";
import { DriverScreen } from "../DriverScreen";

describe("DriverScreen bottom clearance", () => {
  it("pads the body past the fixed bottom nav, shift pill and iOS home indicator", () => {
    render(
      <DriverScreen title="Live tracking">
        <p>last item</p>
      </DriverScreen>,
    );
    const main = screen.getByRole("main");
    // 2026-10 iPhone X (375px): the last card's hint + return link sat under
    // the bottom nav because the padding ignored the safe-area inset.
    expect(main.className).toContain("env(safe-area-inset-bottom)");
    expect(main.className).not.toMatch(/(^|\s)pb-28(\s|$)/);
  });

  it("drops the nav clearance on flush (pushed) screens", () => {
    render(
      <DriverScreen title="Delivery" flush>
        <p>detail</p>
      </DriverScreen>,
    );
    expect(screen.getByRole("main").className).not.toContain("safe-area-inset-bottom");
  });
});
