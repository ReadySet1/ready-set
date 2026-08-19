import { vendorSchema, clientSchema } from "@/components/Auth/SignUp/FormSchemas";
import { COUNTIES } from "@/components/Auth/SignUp/ui/FormData";

/**
 * Validates that new service-area counties (Dallas, Houston, Atlanta)
 * are accepted by the signup Zod schemas that enum-constrain countiesServed.
 */
describe("County validation for new service areas", () => {
  const newCounties = ["Dallas", "Houston", "Atlanta"];

  it("COUNTIES constant includes the three new areas", () => {
    const values = COUNTIES.map((c) => c.value);
    for (const county of newCounties) {
      expect(values).toContain(county);
    }
  });

  it("COUNTIES constant still includes all original Bay Area counties", () => {
    const values = COUNTIES.map((c) => c.value);
    const originalCounties = [
      "Alameda",
      "Contra Costa",
      "Marin",
      "Napa",
      "San Francisco",
      "San Mateo",
      "Santa Clara",
      "Solano",
      "Sonoma",
    ];
    for (const county of originalCounties) {
      expect(values).toContain(county);
    }
  });

  describe.each(newCounties)("vendorSchema accepts %s", (county) => {
    it(`passes validation with countiesServed containing "${county}"`, () => {
      const data = {
        userType: "vendor" as const,
        contact_name: "Test Vendor",
        email: "vendor@example.com",
        phoneNumber: "415-555-1234",
        password: "P@ssword1!",
        company: "Test Co",
        street1: "123 Main St",
        city: "Test City",
        state: "TX",
        zip: "75001",
        countiesServed: [county],
        timeNeeded: ["Lunch"],
        frequency: "1-5 per week",
      };

      const result = vendorSchema.safeParse(data);
      expect(result.success).toBe(true);
    });
  });

  describe.each(newCounties)("clientSchema accepts %s", (county) => {
    it(`passes validation with countiesServed containing "${county}"`, () => {
      const data = {
        userType: "client" as const,
        contact_name: "Test Client",
        email: "client@example.com",
        phoneNumber: "415-555-5678",
        password: "P@ssword1!",
        company: "Test Corp",
        street1: "456 Oak Ave",
        city: "Test City",
        state: "TX",
        zip: "75001",
        countiesServed: [county],
        timeNeeded: ["Lunch"],
        frequency: "1-5 per week",
        head_count: "1-24",
      };

      const result = clientSchema.safeParse(data);
      expect(result.success).toBe(true);
    });
  });

  it("vendorSchema rejects an invalid county", () => {
    const data = {
      userType: "vendor" as const,
      contact_name: "Test Vendor",
      email: "vendor@example.com",
      phoneNumber: "415-555-1234",
      password: "P@ssword1!",
      company: "Test Co",
      street1: "123 Main St",
      city: "Test City",
      state: "TX",
      zip: "75001",
      countiesServed: ["Nonexistent County"],
      timeNeeded: ["Lunch"],
      frequency: "1-5 per week",
    };

    const result = vendorSchema.safeParse(data);
    expect(result.success).toBe(false);
  });
});
