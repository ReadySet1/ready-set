/**
 * Forms QA G5: on iOS Safari `100vh` is the viewport with the toolbar
 * collapsed, so a panel sized with it runs under the visible toolbar and the
 * bottom-pinned Sign In link could not be reached in portrait.
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import MobileMenu from "../MobileMenu";

jest.mock("framer-motion", () => {
  const React = jest.requireActual("react");
  const MOTION_PROPS = ["initial", "animate", "exit", "transition", "variants", "whileHover", "whileTap"];
  const motion = new Proxy(
    {},
    {
      get: (_target, tag: string) =>
        ({ children, ...props }: any) => {
          MOTION_PROPS.forEach((key) => delete props[key]);
          return React.createElement(tag, props, children);
        },
    },
  );
  return { motion, AnimatePresence: ({ children }: any) => children };
});
jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock("@/utils/supabase/client", () => ({ createClient: jest.fn(async () => ({})) }));
jest.mock("@/utils/auth/cookies", () => ({ clearAuthCookies: jest.fn() }));
jest.mock("@/contexts/UserContext", () => ({
  useUser: () => ({ user: null, userRole: null, isLoading: false }),
}));

function renderOpenMenu() {
  return render(
    <MobileMenu
      navbarOpen
      menuData={[{ id: 1, title: "Home", path: "/", newTab: false }] as any}
      openIndex={-1}
      handleSubmenu={jest.fn()}
      closeNavbarOnNavigate={jest.fn()}
      navbarToggleHandler={jest.fn()}
      pathUrl="/"
      sticky={false}
      isHomePage
      isVirtualAssistantPage={false}
      isLogisticsPage={false}
    />,
  );
}

describe("MobileMenu panel height", () => {
  it("sizes the panel to the dynamic viewport, not 100vh", () => {
    renderOpenMenu();

    const panel = screen.getByRole("link", { name: "Sign In" }).closest("nav")!;
    expect(panel.style.height).not.toBe("100vh");
    expect(panel).toHaveClass("h-dvh");
  });

  it("lets the content grow past the panel so Sign In can scroll into view", () => {
    renderOpenMenu();

    const signIn = screen.getByRole("link", { name: "Sign In" });
    const column = signIn.closest(".flex-col");
    expect(column).toHaveClass("min-h-full");
    expect(column).not.toHaveClass("h-full");
  });
});
