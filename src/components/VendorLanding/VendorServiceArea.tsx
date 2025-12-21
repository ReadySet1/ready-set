type ServiceAreaColumn = {
  title: string;
  areaLabel: string;
  locations: string[];
};

const serviceAreaColumns: ServiceAreaColumn[] = [
  {
    title: "Bay Area California",
    areaLabel: "Areas",
    locations: [
      "SAN FRANCISCO",
      "MARIN",
      "CONTRA COSTA",
      "ALAMEDA",
      "SANTA CLARA",
      "SAN MATEO",
      "SANTA CRUZ",
    ],
  },
  {
    title: "Austin Texas",
    areaLabel: "Areas",
    locations: [
      "Northwest Austin",
      "North Austin",
      "Northeast Austin",
      "East Austin",
      "Central Austin",
      "Southeast Austin",
      "South Austin",
      "Southwest Austin",
      "West Austin",
    ],
  },
  {
    title: "Dallas Area",
    areaLabel: "Areas",
    locations: [
      "Collin County",
      "Dallas County",
      "Denton County",
      "Rockwall County",
      "Tarrant County",
    ],
  },
];

const VendorServiceArea = () => {
  return (
    <section
      aria-labelledby="vendor-service-area-heading"
      className="bg-white px-4 py-16 sm:px-6 lg:px-10"
    >
      <div className="mx-auto max-w-6xl space-y-10">
        <div className="text-center">
          <h2
            id="vendor-service-area-heading"
            className="text-2xl font-extrabold text-gray-900 sm:text-3xl"
          >
            Our Service Area
          </h2>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {serviceAreaColumns.map((column) => (
            <article
              key={column.title}
              className="flex flex-col rounded-2xl border border-gray-200 bg-white shadow-[0_12px_35px_-20px_rgba(15,23,42,0.35)]"
            >
              <header className="border-b border-gray-200 px-5 py-4">
                <h3 className="text-lg font-semibold text-gray-900 sm:text-xl">
                  {column.title}
                </h3>
              </header>

              <div className="flex-1 space-y-4 px-5 py-5">
                <p className="text-sm font-semibold text-gray-800">
                  {column.areaLabel}
                </p>

                <ul className="space-y-2">
                  {column.locations.map((location) => (
                    <li key={location}>
                      <div className="rounded-md bg-gray-50 px-3 py-2 text-sm font-semibold text-gray-800 shadow-[0_1px_2px_rgba(15,23,42,0.08)]">
                        {location}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};

export default VendorServiceArea;

