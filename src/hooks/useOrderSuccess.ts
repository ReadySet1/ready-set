import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { OrderSuccessData, SuccessAction } from '@/types/order-success';

interface UseOrderSuccessOptions {
  onSuccess?: (orderData: OrderSuccessData) => void;
  redirectDelay?: number;
}

export const useOrderSuccess = (options: UseOrderSuccessOptions = {}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [orderData, setOrderData] = useState<OrderSuccessData | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const router = useRouter();
  
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
          if (redirectDelay > 0) {
            setTimeout(() => {
              router.push(`/vendor/order-success/${encodeURIComponent(orderData.orderNumber)}`);
            }, redirectDelay);
          } else {
            router.push(`/vendor/order-success/${encodeURIComponent(orderData.orderNumber)}`);
          }
          break;
          
        case 'CREATE_ANOTHER':
          setIsModalOpen(false);
          // Refresh the current page to reset the form
          window.location.reload();
          break;
          
        case 'GO_TO_DASHBOARD':
          setIsModalOpen(false);
          if (redirectDelay > 0) {
            setTimeout(() => {
              router.push('/vendor');
            }, redirectDelay);
          } else {
            router.push('/vendor');
          }
          break;
          
        case 'DOWNLOAD_CONFIRMATION':
          // Handle PDF download
          try {
            const response = await fetch(`/api/orders/${orderData.orderNumber}/confirmation.pdf`);
            if (response.ok) {
              const blob = await response.blob();
              const url = window.URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `order-${orderData.orderNumber}-confirmation.pdf`;
              document.body.appendChild(a);
              a.click();
              window.URL.revokeObjectURL(url);
              document.body.removeChild(a);
            }
          } catch (error) {
            console.error('Failed to download confirmation:', error);
          }
          break;
          
        case 'SHARE_ORDER':
          // Handle order sharing
          if (navigator.share) {
            await navigator.share({
              title: `Order ${orderData.orderNumber} Confirmation`,
              text: `Order ${orderData.orderNumber} has been successfully created for ${orderData.clientName}`,
              url: window.location.origin + `/vendor/order-success/${encodeURIComponent(orderData.orderNumber)}`
            });
          } else {
            // Fallback to clipboard
            const shareText = `Order ${orderData.orderNumber} confirmed for ${orderData.clientName}. View details: ${window.location.origin}/vendor/order-success/${encodeURIComponent(orderData.orderNumber)}`;
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
  }, [orderData, router, redirectDelay]);

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
