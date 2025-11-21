import {
  renderDeliveryTemplate,
  type DeliveryTemplateVariables,
} from "@/lib/email/renderTemplate";

describe("renderDeliveryTemplate", () => {
  const vars: DeliveryTemplateVariables = {
    customerName: "Jane Doe",
    orderNumber: "ORD-999",
    driverName: "Alex Driver",
    estimatedArrival: "10:30 AM",
    deliveryAddress: "123 Main St, City, ST 12345",
    trackingLink: "https://test.readysetllc.com/orders/ORD-999",
    supportLink: "https://test.readysetllc.com/contact",
    currentYear: "2025",
  };

  it("replaces variables in HTML and produces text fallback", () => {
    const { html, text } = renderDeliveryTemplate(
      "delivery-assigned",
      vars
    );

    expect(html).toContain("ORD-999");
    expect(html).toContain("Jane Doe");
    expect(html).toContain("https://test.readysetllc.com/orders/ORD-999");
    expect(html).toContain("2025");

    expect(text).toContain("ORD-999");
    expect(text).not.toContain("<div");
  });
});


