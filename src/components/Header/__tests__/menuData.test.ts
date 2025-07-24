import menuData from "../menuData";

describe("Header menuData", () => {
  it("includes all main menu items in correct order", () => {
    const titles = menuData.map((item) => item.title);
    expect(titles).toContain("Home");
    expect(titles).toContain("About");
    expect(titles).toContain("Virtual Assistant");
    expect(titles).toContain("Join Us");
    expect(titles).toContain("Contact");
    expect(titles).toContain("Blog");
    expect(titles).toContain("Resources");
  });

  it("has 'Catering Request' submenu at the end of the menu", () => {
    const lastItem = menuData[menuData.length - 1];
    expect(lastItem.title).toBe("Orders");
    expect(lastItem.submenu?.some((sub) => sub.title === "Catering Request")).toBe(true);
  });

  it("'Catering Request' submenu has correct path", () => {
    const ordersMenu = menuData.find((item) => item.title === "Orders");
    expect(ordersMenu).toBeDefined();
    const cateringSub = ordersMenu?.submenu?.find((sub) => sub.title === "Catering Request");
    expect(cateringSub?.path).toBe("/catering-request");
  });
}); 