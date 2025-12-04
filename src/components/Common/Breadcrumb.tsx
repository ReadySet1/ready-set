import Link from "next/link";
import { getCloudinaryUrl } from "@/lib/cloudinary";

const Breadcrumb = ({
  pageName,
  pageDescription,
}: {
  pageName: string;
  pageDescription?: string;
}) => {
  return (
    <>
      <div
        className="relative z-10 overflow-hidden bg-cover bg-center bg-no-repeat pb-[40px] pt-[80px] sm:pb-[50px] sm:pt-[100px] md:pb-[60px] md:pt-[130px] lg:pt-[160px]"
        style={{
          backgroundImage: `url('${getCloudinaryUrl("header/header-bg")}')`,
        }}
      >
        <div className="absolute bottom-0 left-0 h-px w-full bg-gradient-to-r from-stroke/0 via-stroke to-stroke/0 dark:via-dark-3"></div>
        <div className="relative px-3 sm:px-4 md:px-6 lg:px-8">
          <div className="-mx-3 flex flex-wrap items-center sm:-mx-4">
            <div className="w-full px-3 sm:px-4">
              <div className="text-center">
                <h1 className="mb-3 text-2xl font-bold text-black sm:mb-4 sm:text-3xl md:text-4xl lg:text-[40px] lg:leading-[1.2]">
                  {pageName}
                </h1>
                <p className="mb-4 text-sm text-gray-800 sm:mb-5 sm:text-base">
                  {pageDescription}
                </p>

                <ul className="flex items-center justify-center gap-[8px] sm:gap-[10px]">
                  <li>
                    <Link
                      href="/"
                      className="flex items-center gap-[8px] text-sm font-medium text-gray-900 hover:text-gray-700 sm:gap-[10px] sm:text-base"
                    >
                      Home
                    </Link>
                  </li>
                  {/* <li>
                    <p className="flex items-center gap-[10px] text-base font-medium text-gray-800">
                      {pageName}
                    </p>
                  </li> */}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Breadcrumb;
