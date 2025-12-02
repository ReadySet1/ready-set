import {
  renderDeliveryTemplate,
  type DeliveryTemplateVariables,
  type DeliveryEmailTemplateId,
} from "@/lib/email/renderTemplate";

/**
 * TODO: REA-211 - Email template tests have template rendering issues
 */
describe.skip("renderDeliveryTemplate", () => {
  const vars: DeliveryTemplateVariables = {
    customerName: "Jane Doe",
    orderNumber: "ORD-999",
    driverName: "Alex Driver",
    estimatedArrival: "10:30 AM",
    deliveryAddress: "123 Main St, City, ST 12345",
    trackingLink: "https://test.readysetllc.com/orders/ORD-999",
    supportLink: "https://test.readysetllc.com/contact",
    unsubscribeLink: "https://test.readysetllc.com/account/preferences?tab=notifications",
    currentYear: "2025",
  };

  describe("variable interpolation", () => {
    it("replaces variables in HTML and produces text fallback", () => {
      const { html, text } = renderDeliveryTemplate("delivery-assigned", vars);

      expect(html).toContain("ORD-999");
      expect(html).toContain("Jane Doe");
      expect(html).toContain("https://test.readysetllc.com/orders/ORD-999");
      expect(html).toContain("2025");

      expect(text).toContain("ORD-999");
      expect(text).not.toContain("<div");
    });

    it("includes unsubscribe link in footer", () => {
      const { html, text } = renderDeliveryTemplate("delivery-assigned", vars);

      expect(html).toContain("account/preferences?tab=notifications");
      expect(html).toContain("Unsubscribe");
      expect(text).toContain("Unsubscribe");
    });

    it("includes current year in footer", () => {
      const { html } = renderDeliveryTemplate("delivery-assigned", vars);

      expect(html).toContain("2025");
      expect(html).toContain("Ready Set");
    });
  });

  describe("HTML escaping (XSS prevention)", () => {
    it("escapes HTML special characters in variables", () => {
      const xssVars: DeliveryTemplateVariables = {
        ...vars,
        customerName: '<script>alert("xss")</script>',
        deliveryAddress: '123 Main St <img src=x onerror=alert(1)>',
      };

      const { html } = renderDeliveryTemplate("delivery-assigned", xssVars);

      expect(html).not.toContain("<script>");
      expect(html).not.toContain("<img src=x");
      expect(html).toContain("&lt;script&gt;");
    });
  });

  describe("optional variables", () => {
    it("handles missing driver name gracefully", () => {
      const varsWithoutDriver: DeliveryTemplateVariables = {
        ...vars,
        driverName: undefined,
      };

      const { html, text } = renderDeliveryTemplate(
        "delivery-assigned",
        varsWithoutDriver
      );

      expect(html).toBeDefined();
      expect(text).toBeDefined();
      // Should not have error or undefined text
      expect(html).not.toContain("undefined");
    });

    it("handles missing estimated arrival gracefully", () => {
      const varsWithoutETA: DeliveryTemplateVariables = {
        ...vars,
        estimatedArrival: undefined,
      };

      const { html, text } = renderDeliveryTemplate(
        "delivery-assigned",
        varsWithoutETA
      );

      expect(html).toBeDefined();
      expect(text).toBeDefined();
      expect(html).not.toContain("undefined");
    });
  });

  describe("all template types render", () => {
    const templateIds: DeliveryEmailTemplateId[] = [
      "delivery-assigned",
      "driver-en-route-pickup",
      "driver-arrived-pickup",
      "order-picked-up",
      "driver-en-route-delivery",
      "driver-arrived-delivery",
      "delivery-completed",
    ];

    templateIds.forEach((templateId) => {
      it(`renders ${templateId} template without error`, () => {
        const { html, text } = renderDeliveryTemplate(templateId, vars);

        expect(html).toBeDefined();
        expect(html.length).toBeGreaterThan(100);
        expect(text).toBeDefined();
        expect(text.length).toBeGreaterThan(10);
      });
    });
  });

  describe("text fallback generation", () => {
    it("strips HTML tags from text version", () => {
      const { text } = renderDeliveryTemplate("delivery-assigned", vars);

      expect(text).not.toContain("<div");
      expect(text).not.toContain("<p>");
      expect(text).not.toContain("<style");
      expect(text).not.toContain("<html");
    });

    it("preserves meaningful content in text version", () => {
      const { text } = renderDeliveryTemplate("delivery-assigned", vars);

      expect(text).toContain("Jane Doe");
      expect(text).toContain("ORD-999");
      expect(text).toContain("Ready Set");
    });
  });
});
