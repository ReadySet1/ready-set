import { render, screen } from "@testing-library/react";
import { AdminFooter } from "../admin-footer";

describe("AdminFooter", () => {
  const hrefs = () =>
    screen.getAllByRole("link").map((link) => link.getAttribute("href"));

  it("links only to routes that exist (no /signin, /signup or /help)", () => {
    render(<AdminFooter />);

    expect(hrefs()).not.toContain("/signin");
    expect(hrefs()).not.toContain("/signup");
    expect(hrefs()).not.toContain("/help");
  });

  it("lists each menu destination once and leaves out Home", () => {
    render(<AdminFooter />);

    const all = hrefs();
    expect(new Set(all).size).toBe(all.length);
    expect(all).toEqual(expect.arrayContaining(["/about", "/contact", "/blog", "/free-resources"]));
    expect(all).not.toContain("/");
  });

  it("does not offer Sign In or Sign Up to signed-in admins", () => {
    render(<AdminFooter />);

    expect(screen.queryByRole("link", { name: "Sign In" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Sign Up" })).not.toBeInTheDocument();
  });
});
