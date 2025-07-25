import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { OrderSuccessData, SuccessAction } from '@/types/order-success';
import { useSmartRedirect } from '@/hooks/useSmartRedirect';

interface UseOrderSuccessOptions {
  onSuccess?: (orderData: OrderSuccessData) => void;
  redirectDelay?: number;
}

export const useOrderSuccess = (options: UseOrderSuccessOptions = {}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [orderData, setOrderData] = useState<OrderSuccessData | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const router = useRouter();
  const { redirectToDashboard, redirectToOrderSuccess, getSuccessPageUrl, userRole } = useSmartRedirect();
  
  const { onSuccess, redirectDelay = 0 } = options;

  const showSuccessModal = useCallback((data: OrderSuccessData) => {
    setOrderData(data);
    setIsModalOpen(true);
    onSuccess?.(data);
  }, [onSuccess]);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    // Keep order data for potential navigation
  }, []);

  const handleAction = useCallback(async (action: SuccessAction) => {
    if (!orderData) return;
    
    setIsProcessing(true);
    
    try {
      switch (action) {
        case 'VIEW_DETAILS':
          setIsModalOpen(false);
          console.log('Navigating to order details for orderNumber:', orderData.orderNumber);
          // Navigate to the universal order status page
          const orderDetailsUrl = `/order-status/${encodeURIComponent(orderData.orderNumber)}`;
          if (redirectDelay > 0) {
            setTimeout(() => {
              router.push(orderDetailsUrl);
            }, redirectDelay);
          } else {
            router.push(orderDetailsUrl);
          }
          break;
          
        case 'CREATE_ANOTHER':
          setIsModalOpen(false);
          console.log('Navigating to create new order form');
          // Navigate to the appropriate form based on user role instead of reloading
          
          if (userRole === 'ADMIN' || userRole === 'SUPER_ADMIN' || userRole === 'HELPDESK') {
            // Admin users go to admin catering order form
            router.push('/admin/catering-orders/new');
          } else {
            // Regular users go to public catering request form  
            router.push('/catering-request');
          }
          break;
          
        case 'GO_TO_DASHBOARD':
          setIsModalOpen(false);
          console.log('Navigating to dashboard');
          if (redirectDelay > 0) {
            setTimeout(() => {
              redirectToDashboard();
            }, redirectDelay);
          } else {
            redirectToDashboard();
          }
          break;
          
        case 'DOWNLOAD_CONFIRMATION':
          // Handle PDF download
          try {
            const response = await fetch(`/api/orders/${orderData.orderNumber}/confirmation`);
            if (response.ok) {
              const confirmationData = await response.json();
              // Convert JSON data to downloadable content
              const dataStr = JSON.stringify(confirmationData, null, 2);
              const dataBlob = new Blob([dataStr], { type: 'application/json' });
              const url = window.URL.createObjectURL(dataBlob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `order-${orderData.orderNumber}-confirmation.json`;
              document.body.appendChild(a);
              a.click();
              window.URL.revokeObjectURL(url);
              document.body.removeChild(a);
            } else {
              console.error('Failed to fetch confirmation data');
            }
          } catch (error) {
            console.error('Failed to download confirmation:', error);
          }
          break;
          
        case 'SHARE_ORDER':
          // Handle order sharing using smart redirect
          const shareUrl = window.location.origin + getSuccessPageUrl(orderData.orderNumber);
          if (navigator.share) {
            await navigator.share({
              title: `Order ${orderData.orderNumber} Confirmation`,
              text: `Order ${orderData.orderNumber} has been successfully created for ${orderData.clientName}`,
              url: shareUrl
            });
          } else {
            // Fallback to clipboard
            const shareText = `Order ${orderData.orderNumber} confirmed for ${orderData.clientName}. View details: ${shareUrl}`;
            await navigator.clipboard.writeText(shareText);
          }
          break;
          
        case 'CONTACT_SUPPORT':
          // Open support contact
          router.push('/contact');
          break;
          
        default:
          console.warn(`Unhandled action: ${action}`);
      }
    } catch (error) {
      console.error(`Error handling action ${action}:`, error);
    } finally {
      setIsProcessing(false);
    }
  }, [orderData, router, redirectDelay, redirectToDashboard, getSuccessPageUrl, userRole]);

  const reset = useCallback(() => {
    setIsModalOpen(false);
    setOrderData(null);
    setIsProcessing(false);
  }, []);

  return {
    isModalOpen,
    orderData,
    isProcessing,
    showSuccessModal,
    closeModal,
    handleAction,
    reset
  };
};
