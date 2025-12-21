import type { ReactNode } from "react";

const SERVICE_POINTS = [
  "You receive and manage your own catering orders.",
  "When the order is ready, you book us for pickup and drop-off.",
  "You only pay a delivery fee. There are no commissions or marketplace charges.",
];

const DRIVER_POINTS = [
  "Certified in proper food handling",
  "Required insulated bags & suitable vehicles",
  "Set up assistance as instructed",
  "Professional and customer-friendly",
  "GPS-tracked for on-time delivery",
];

const Card = ({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) => {
  return (
    <article className="flex h-full flex-col rounded-[32px] border-4 border-gray-300 bg-white p-8 shadow-sm sm:p-10">
      <div className="mx-auto mb-8 w-full max-w-[360px] rounded-2xl bg-[#333333] px-6 py-4 text-center text-2xl font-extrabold text-white sm:text-3xl">
        {title}
      </div>
      <div className="mx-auto w-full max-w-md space-y-4 text-[15px] leading-relaxed text-gray-800 sm:text-base">
        {children}
      </div>
    </article>
  );
};

const VendorServiceDrivers = () => {
  return (
    <section
      className="w-full bg-white py-14 sm:py-16 lg:py-20"
      aria-labelledby="vendor-service-drivers-heading"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid gap-6 md:grid-cols-2 md:gap-8">
          <Card title="Our Service Model">
            <p>
              Our focus is on providing professional delivery that keeps your
              customers happy and your operations smooth.{" "}
              <strong>We are not a marketplace or broker.</strong>{" "}
              <strong>We do not take customer orders or list you on an app.</strong> We
              provide logistics support and professional drivers for your team.
            </p>
            <ul className="list-disc space-y-3 pl-5">
              {SERVICE_POINTS.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          </Card>

          <Card title="Our Drivers">
            <p>
              Our drivers are carefully vetted and thoroughly trained to meet the
              demands of catering delivery. They uphold strict service standards
              to ensure every order arrives safely and on time.
            </p>
            <ul className="list-disc space-y-3 pl-5">
              {DRIVER_POINTS.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
            <p>
              With over <strong>200+</strong> drivers across the SF Bay Area, Austin,
              Atlanta, and Dallas, we deliver dependable service in every market.
            </p>
          </Card>
        </div>
      </div>
    </section>
  );
};

export default VendorServiceDrivers;

