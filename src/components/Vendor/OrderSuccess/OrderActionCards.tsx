"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Download, 
  Share2, 
  Plus, 
  LayoutDashboard, 
  MessageCircle,
  FileText 
} from 'lucide-react';
import { useRouter } from 'next/navigation';

interface Props {
  orderNumber: string;
}

export const OrderActionCards: React.FC<Props> = ({ orderNumber }) => {
  const router = useRouter();

  const handleDownloadPDF = async () => {
    try {
      const response = await fetch(`/api/orders/${orderNumber}/confirmation.pdf`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `order-${orderNumber}-confirmation.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Failed to download PDF:', error);
    }
  };

  const handleShare = async () => {
    const shareData = {
      title: `Order ${orderNumber} Confirmation`,
      text: `Order ${orderNumber} has been successfully created and confirmed.`,
      url: window.location.href
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (error) {
        console.log('Error sharing:', error);
      }
    } else {
      // Fallback to clipboard
      try {
        await navigator.clipboard.writeText(
          `${shareData.text} View details: ${shareData.url}`
        );
        alert('Link copied to clipboard!');
      } catch (error) {
        console.error('Failed to copy to clipboard:', error);
      }
    }
  };

  const actionCards = [
    {
      title: 'Download Confirmation',
      description: 'Get a PDF copy of the order details',
      icon: Download,
      action: handleDownloadPDF,
      variant: 'default' as const
    },
    {
      title: 'Share Order',
      description: 'Share order details with your team',
      icon: Share2,
      action: handleShare,
      variant: 'outline' as const
    },
    {
      title: 'Create Another Order',
      description: 'Start a new catering order',
      icon: Plus,
      action: () => router.push('/admin/catering-orders/new'),
      variant: 'outline' as const
    },
    {
      title: 'Go to Dashboard',
      description: 'View all orders and manage delivery',
      icon: LayoutDashboard,
      action: () => router.push('/vendor'),
      variant: 'outline' as const
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {actionCards.map((card) => (
        <Card key={card.title} className="hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex flex-col items-center text-center space-y-3">
              <div className="rounded-full bg-blue-100 p-3">
                <card.icon className="h-6 w-6 text-blue-600" />
              </div>
              
              <div>
                <h3 className="font-semibold text-sm">{card.title}</h3>
                <p className="text-xs text-gray-600 mt-1">{card.description}</p>
              </div>
              
              <Button 
                size="sm" 
                variant={card.variant}
                onClick={card.action}
                className="w-full"
              >
                {card.title}
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
