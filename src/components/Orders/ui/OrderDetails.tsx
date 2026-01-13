import { Separator } from "@/components/ui/separator";
import { Order, isCateringRequest, isOnDemand } from "@/types/order";
import { formatCurrency, withCurrencySymbol } from "@/utils/currency";
import { formatDateTimeForDisplay } from "@/lib/utils/date-display";
import { Clock, Truck } from "lucide-react";

interface OrderDetailsProps {
  order: Order;
}

const OrderDetails: React.FC<OrderDetailsProps> = ({ order }) => {
  return (
    <div className="space-y-6">
      {/* Pickup and Delivery Times */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {order.pickupDateTime && (
          <div className="flex items-start gap-3 rounded-lg bg-slate-50 p-3">
            <Clock className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Pickup Time
              </div>
              <div className="mt-0.5 text-sm font-semibold text-slate-800">
                {formatDateTimeForDisplay(order.pickupDateTime)}
              </div>
            </div>
          </div>
        )}
        {order.arrivalDateTime && (
          <div className="flex items-start gap-3 rounded-lg bg-slate-50 p-3">
            <Truck className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" />
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Delivery Time
              </div>
              <div className="mt-0.5 text-sm font-semibold text-slate-800">
                {formatDateTimeForDisplay(order.arrivalDateTime)}
              </div>
            </div>
          </div>
        )}
      </div>

      <Separator />

      <div>
        <div className="grid grid-cols-2 gap-2 text-sm">
          {isCateringRequest(order) && (
            <>
              {order.headcount && (
                <div>
                  Headcount:{" "}
                  <span className="font-medium">{order.headcount}</span>
                </div>
              )}
              {order.needHost && (
                <div>
                  Need Host:{" "}
                  <span className="font-medium">{order.needHost}</span>
                </div>
              )}
              {order.numberOfHosts && (
                <div>
                  Number of Hosts:{" "}
                  <span className="font-medium">{order.numberOfHosts}</span>
                </div>
              )}
            </>
          )}
          {isOnDemand(order) && (
            <>
              {order.itemDelivered && (
                <div>
                  Item Delivered:{" "}
                  <span className="font-medium">{order.itemDelivered}</span>
                </div>
              )}
              {order.vehicleType && (
                <div>
                  Vehicle Type:{" "}
                  <span className="font-medium">{order.vehicleType}</span>
                </div>
              )}
              {order.length && order.width && order.height && (
                <div>
                  Dimensions:{" "}
                  <span className="font-medium">{`${order.length} x ${order.width} x ${order.height}`}</span>
                </div>
              )}
              {order.weight && (
                <div>
                  Weight: <span className="font-medium">{order.weight}</span>
                </div>
              )}
            </>
          )}
          {order.hoursNeeded && (
            <div>
              Hours Needed:{" "}
              <span className="font-medium">{order.hoursNeeded}</span>
            </div>
          )}
        </div>
      </div>
      <Separator />
      <div className="grid grid-cols-1 gap-4 pb-4 md:grid-cols-2">
        <div>
          <div className="mb-2 grid grid-cols-2 gap-2">
            <div className="font-semibold">
              Total: {withCurrencySymbol(formatCurrency(order.orderTotal))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>Tip: {withCurrencySymbol(formatCurrency(order.tip))}</div>
          </div>
          {isCateringRequest(order) && order.deliveryCost !== null && order.deliveryCost !== undefined && (
            <div className="mt-2 grid grid-cols-2 gap-2">
              <div>
                Delivery Cost:{" "}
                <span className="font-medium">
                  {withCurrencySymbol(formatCurrency(order.deliveryCost))}
                </span>
              </div>
            </div>
          )}
          {isCateringRequest(order) && order.deliveryDistance !== null && order.deliveryDistance !== undefined && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                Distance:{" "}
                <span className="font-medium">
                  {Number(order.deliveryDistance).toFixed(2)} mi
                </span>
              </div>
            </div>
          )}
        </div>
        {isCateringRequest(order) && order.brokerage && (
          <div>
            <h3 className="mb-2 font-semibold">Brokerage</h3>
            <div className="text-sm">{order.brokerage}</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default OrderDetails;