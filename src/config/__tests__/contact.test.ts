import { CONTACT_EMAIL, CONTACT_MAILTO } from "../contact";

describe("contact config", () => {
  it("uses the readysetllc.com domain", () => {
    expect(CONTACT_EMAIL).toBe("info@readysetllc.com");
  });

  it("CONTACT_MAILTO is a mailto: URI of CONTACT_EMAIL", () => {
    expect(CONTACT_MAILTO).toBe(`mailto:${CONTACT_EMAIL}`);
  });
});
