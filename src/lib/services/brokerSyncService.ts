import { Order, OrderStatus, isCateringRequest } from '@/types/order';
import { updateCaterValleyOrderStatus, type OrderStatus as CaterValleyOrderStatus, type CaterValleyUpdateResult } from '@/services/caterValleyService';
import toast from 'react-hot-toast';
// --- Configuration for Broker Status Mapping ---
// Example: CaterValley Mapping (as defined before)
const caterValleyStatusMap: Partial<Record<OrderStatus, CaterValleyOrderStatus>> = {
    [OrderStatus.ASSIGNED]: 'CONFIRM',
    [OrderStatus.CANCELLED]: 'CANCELLED',
    [OrderStatus.COMPLETED]: 'COMPLETED',
};
// Add mappings for other brokers here if needed
// const otherBrokerStatusMap: Partial<Record<OrderStatus, OtherBrokerStatusType>> = { ... };
/**
 * Checks the order's broker and syncs the status with the appropriate external service if configured.
 * @param order The order object (must contain broker identification, e.g., brokerage field).
 * @param newStatus The new internal OrderStatus.
 */
export async function syncOrderStatusWithBroker(order: Order, newStatus: OrderStatus): Promise<void> {
    // 1. Determine the broker and required action
    let brokerIdentifier: string | null | undefined = null;
    let requiresSync = false;
    let syncFunction: ((orderNumber: string, status: any) => Promise<any>) | null = null;
    let statusMap: Partial<Record<OrderStatus, any>> | null = null;
    // --- Broker Identification Logic --- 
    // Adapt this based on how brokers are identified in your data
    if (isCateringRequest(order) && order.brokerage) {
        brokerIdentifier = order.brokerage;
        // Configure sync based on broker
        if (brokerIdentifier === 'CaterValley') { // Use the specific identifier from your DB
            requiresSync = true;
            syncFunction = updateCaterValleyOrderStatus;
            statusMap = caterValleyStatusMap;
        }
        // --- Add else if blocks for other brokers ---
        // else if (brokerIdentifier === 'BrokerB_Identifier') {
        //     requiresSync = true;
        //     syncFunction = updateBrokerBOrderStatus; // You'd need to create this service
        //     statusMap = brokerBStatusMap;
        //     console.log(`Configured sync for BrokerB.`);
        // }
        else {
        }
    }
    else {
        // Handle OnDemand orders here if they can also have brokers/sync requirements
    }
    // --- End Broker Identification ---
    // 2. Execute Sync if Required
    if (requiresSync && syncFunction && statusMap) {
        const brokerStatus = statusMap[newStatus];
        if (brokerStatus) {
            // Handle CaterValley sync with enhanced error handling
            if (brokerIdentifier === 'CaterValley') {
                const result: CaterValleyUpdateResult = await updateCaterValleyOrderStatus(order.orderNumber, brokerStatus);
                if (result.success) {
                    // Optional success toast: toast.success(`Status synced with ${brokerIdentifier}.`);
                }
                else {
                    // Handle different types of failures
                    if (!result.orderFound && result.statusCode === 404) {
                        console.warn(`Order ${order.orderNumber} not found in ${brokerIdentifier} system`);
                        toast(`Order not found in ${brokerIdentifier} system. This may be normal for orders not managed by ${brokerIdentifier}.`, {
                            duration: 4000,
                            icon: '⚠️'
                        });
                    }
                    else {
                        const message = result.error || 'Unknown error';
                        console.warn(`${brokerIdentifier} update failed for order ${order.orderNumber}: ${message}`);
                        toast(`Warning: Internal status updated, but ${brokerIdentifier} sync failed: ${message}`, { duration: 5000 });
                    }
                }
            }
            else {
                // Handle other brokers with the old format (for backward compatibility)
                try {
                    const brokerResponse = await syncFunction(order.orderNumber, brokerStatus);
                    // Handle response generically (assuming a 'result' field, adapt if needed)
                    if (brokerResponse && typeof brokerResponse.result === 'boolean') {
                        if (brokerResponse.result) {
                            // Optional success toast: toast.success(`Status synced with ${brokerIdentifier}.`);
                        }
                        else {
                            const message = brokerResponse.message || 'Reason unknown.';
                            console.warn(`${brokerIdentifier} update failed logically for order ${order.orderNumber}: ${message}`);
                            toast(`Warning: Internal status updated, but ${brokerIdentifier} sync failed: ${message}`, { duration: 5000 });
                        }
                    }
                    else {
                        console.warn(`Received unexpected response structure from ${brokerIdentifier} for order ${order.orderNumber}`, brokerResponse);
                        toast(`Status synced with ${brokerIdentifier}, but response format was unexpected.`, { duration: 4000 });
                    }
                }
                catch (brokerError) {
                    console.error(`Error syncing status with ${brokerIdentifier} for order ${order.orderNumber}:`, brokerError);
                    toast.error(brokerError instanceof Error
                        ? `Internal status updated, but ${brokerIdentifier} sync failed: ${brokerError.message}`
                        : `Internal status updated, but failed to sync with ${brokerIdentifier}.`);
                }
            }
        }
        else {
        }
    }
    else if (requiresSync) {
        console.warn(`Sync was required for broker ${brokerIdentifier} but configuration (syncFunction or statusMap) was missing.`);
    }
}
