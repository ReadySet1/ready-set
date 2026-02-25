"use client";

import UserOrderDetail from "@/components/User/UserOrder";

const OrderPage = () => {
  return (
    <div className="relative z-10 overflow-hidden pb-[60px] pt-[120px] dark:bg-dark md:pt-[130px] lg:pt-[160px]">
      <div className="absolute bottom-0 left-0 h-px w-full bg-gradient-to-r from-stroke/0 via-stroke to-stroke/0 dark:via-dark-3"></div>
      <div className="container">
        <UserOrderDetail />
      </div>
    </div>
  );
};

export default OrderPage;
