import { renderHook, act } from "@testing-library/react";
import { useVisualViewportInset } from "../useVisualViewportInset";

// Minimal visualViewport stand-in: jsdom doesn't implement the API, which is
// exactly the browser situation the hook must also survive (see the
// "unavailable" test). EventTarget gives us real add/remove/dispatch.
class FakeVisualViewport extends EventTarget {
  height = 800;
  offsetTop = 0;
}

const setInnerHeight = (value: number) =>
  Object.defineProperty(window, "innerHeight", {
    value,
    writable: true,
    configurable: true,
  });

describe("useVisualViewportInset", () => {
  let fakeViewport: FakeVisualViewport;

  const installViewport = () => {
    fakeViewport = new FakeVisualViewport();
    Object.defineProperty(window, "visualViewport", {
      value: fakeViewport,
      writable: true,
      configurable: true,
    });
  };

  const removeViewport = () =>
    Object.defineProperty(window, "visualViewport", {
      value: undefined,
      writable: true,
      configurable: true,
    });

  beforeEach(() => {
    setInnerHeight(800);
  });

  afterEach(() => {
    removeViewport();
  });

  it("returns 0 and does not crash when visualViewport is unavailable", () => {
    removeViewport();
    const { result } = renderHook(() => useVisualViewportInset());
    expect(result.current).toBe(0);
  });

  it("reports the keyboard occlusion height after a visualViewport resize", () => {
    installViewport();
    const { result } = renderHook(() => useVisualViewportInset());
    expect(result.current).toBe(0); // keyboard closed: viewport fills the window

    // iOS keyboard opens: the visual viewport shrinks, the layout viewport
    // (window.innerHeight) does not.
    act(() => {
      fakeViewport.height = 488;
      fakeViewport.dispatchEvent(new Event("resize"));
    });
    expect(result.current).toBe(312); // 800 - 488 - 0
  });

  it("subtracts offsetTop when the visual viewport is scrolled down", () => {
    installViewport();
    const { result } = renderHook(() => useVisualViewportInset());

    act(() => {
      fakeViewport.height = 500;
      fakeViewport.offsetTop = 100;
      fakeViewport.dispatchEvent(new Event("resize"));
    });
    expect(result.current).toBe(200); // 800 - 500 - 100
  });

  it("clamps negative occlusion to 0", () => {
    installViewport();
    const { result } = renderHook(() => useVisualViewportInset());

    // Rotation / zoom can briefly report a viewport taller than the window.
    act(() => {
      fakeViewport.height = 900;
      fakeViewport.dispatchEvent(new Event("resize"));
    });
    expect(result.current).toBe(0);
  });

  it("removes its listeners on unmount", () => {
    installViewport();
    const removeSpy = jest.spyOn(fakeViewport, "removeEventListener");
    const { unmount } = renderHook(() => useVisualViewportInset());

    unmount();
    expect(removeSpy).toHaveBeenCalledWith("resize", expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith("scroll", expect.any(Function));
  });
});
