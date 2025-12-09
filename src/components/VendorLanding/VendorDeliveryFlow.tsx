import clsx from "clsx";

const scheduleBullets = [
  "Schedule deliveries 1 week in advance for optimal service.",
  "Late order submissions may be accepted with 24 hours notice.",
  "On-demand deliveries are accepted, but driver alignment isn’t guaranteed.",
  "Client order sheet submit via dashboard, Slack, text, or email.",
];

const confirmationBullets = [
  "Items (food trays, etc.)",
  "Food cost/headcount",
  "Pickup time & restaurant address",
  "Pickup driver assignment",
  "Assigned pickup window",
  "Drop-off address & ETA time",
  "Special instructions",
];

const assignmentBullets = [
  "Assign the nearest driver (week in advance or same day).",
  "Send delivery details to the driver.",
  "Drivers confirm the order.",
  "Client portal for tracking deliveries and live map.",
  "Share driver contact info and driver info with vendors.",
];

const completionBullets = [
  "Take photo/video proof for the catering company and ensure all instructions are followed.",
];

const onsiteBullets = [
  "Sanitize the setup area, wash hands, and prep workspace.",
  "Set up catering according to the guide or placement details in the instructions.",
  "Confirm completion with Office Manager.",
];

const pickupBullets = [
  "Arrive at Caterer 15 minutes early from pickup window start time.",
  "Confirm items list with Caterer (quantity and tray sizes).",
  "Inform customer of delivery ETA and send confirmation to required parties.",
];

const cardData: Array<{
  title: string;
  bullets: string[];
  icon: JSX.Element;
  className?: string;
}> = [
  {
    title: "Schedule Drives",
    bullets: scheduleBullets,
    icon: (
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        className="h-9 w-9 text-gray-900"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="4" y="5" width="16" height="15" rx="2.5" />
        <path d="M8 3v4M16 3v4M4 10h16" />
        <circle cx="9" cy="14" r="1" />
        <circle cx="15" cy="14" r="1" />
      </svg>
    ),
  },
  {
    title: "Order Confirmation",
    bullets: confirmationBullets,
    icon: (
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        className="h-9 w-9 text-gray-900"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M6 6h12v12H6z" />
        <path d="M8 9h8M8 12h5M8 15h4" />
        <path d="M15.5 5.5l2 2M6.5 5.5l-2 2" />
      </svg>
    ),
  },
  {
    title: "Driver Assignment",
    bullets: assignmentBullets,
    icon: (
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        className="h-9 w-9 text-gray-900"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="8" width="12" height="8" rx="2" />
        <path d="M15 12h3l2 2.5V16h-5" />
        <path d="M3 12h12" />
        <circle cx="7" cy="17" r="1.4" />
        <circle cx="16" cy="17" r="1.4" />
      </svg>
    ),
  },
  {
    title: "Completion",
    bullets: completionBullets,
    icon: (
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        className="h-9 w-9 text-gray-900"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M8.5 12.5l2.5 2.5 4.5-5.5" />
      </svg>
    ),
  },
  {
    title: "On-Site Setup",
    bullets: onsiteBullets,
    icon: (
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        className="h-9 w-9 text-gray-900"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="7.5" r="2.5" />
        <path d="M6 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
        <path d="M10 11v2M14 11v2" />
      </svg>
    ),
  },
  {
    title: "Order Pickup",
    bullets: pickupBullets,
    icon: (
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        className="h-9 w-9 text-gray-900"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 21s7-4.35 7-10a7 7 0 10-14 0c0 5.65 7 10 7 10z" />
        <circle cx="12" cy="11" r="2.6" />
        <path d="M12 8.5v1.5M12 12.5V14" />
      </svg>
    ),
  },
];

const VendorDeliveryFlow = () => {
  return (
    <section className="bg-[#f7cd2a] px-4 py-16 sm:px-6 lg:px-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-10">
        <div className="text-center text-gray-900">
          <h2 className="text-2xl font-extrabold sm:text-3xl">
            End-to-End Delivery Service
          </h2>
          <p className="mt-3 text-sm leading-relaxed sm:text-base">
            We handle everything from orders to setup, making catering deliveries
            easy, reliable, and stress-free for restaurants and caterers.
          </p>
        </div>

        <div className="relative">
          {/* Connector lines for large screens */}
          <div className="pointer-events-none absolute inset-0 hidden lg:block">
            {/* Horizontal dashed line top row */}
            <span className="absolute left-[8%] right-[8%] top-[26%] border-t-2 border-white border-dashed" />
            {/* Horizontal dashed line bottom row */}
            <span className="absolute left-[8%] right-[8%] bottom-[33%] border-t-2 border-white border-dashed" />
            {/* Vertical dashed line middle column */}
            <span className="absolute left-1/2 top-[26%] bottom-[34%] -translate-x-1/2 border-l-2 border-white border-dashed" />
            {/* Vertical dashed line left column */}
            <span className="absolute left-[16.5%] top-[26%] bottom-[34%] border-l-2 border-white border-dashed" />
            {/* Vertical dashed line right column */}
            <span className="absolute right-[16.5%] top-[26%] bottom-[34%] border-l-2 border-white border-dashed" />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {cardData.map((card, idx) => (
              <div
                key={card.title}
                className={clsx(
                  "relative flex h-full flex-col gap-4 rounded-2xl border-2 border-[#d6d9e7] bg-white p-6 shadow-md",
                  card.className
                )}
              >
                <div className="flex items-start gap-3">
                  <div className="rounded-xl bg-[#f1f2f8] p-3">{card.icon}</div>
                  <h3 className="text-lg font-extrabold text-gray-900 sm:text-xl">
                    {card.title}
                  </h3>
                </div>
                <ul className="ml-1 space-y-2 text-sm leading-relaxed text-gray-700 sm:text-base">
                  {card.bullets.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <span aria-hidden className="mt-2 h-1.5 w-1.5 rounded-full bg-gray-700" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl bg-[#f7cd2a] px-5 py-6 text-center text-gray-900 shadow-[0_10px_30px_-12px_rgba(0,0,0,0.25)] sm:px-8 sm:py-7">
          <div className="mx-auto flex max-w-4xl flex-col gap-2 sm:gap-3">
            <div className="flex items-center justify-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border-2 border-gray-900 text-lg font-extrabold">
                !
              </span>
              <p className="text-lg font-extrabold sm:text-xl">Same-Day Delivery</p>
            </div>
            <p className="text-sm leading-relaxed sm:text-base">
              Please note that while we may accept same-day delivery requests,
              driver availability cannot be guaranteed. To secure driver and ensure
              optimal service quality, we highly recommend submitting orders at least
              one week in advance or with a minimum of 24 hours notice.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default VendorDeliveryFlow;

