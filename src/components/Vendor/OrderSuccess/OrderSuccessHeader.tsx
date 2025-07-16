"use client";

import React from 'react';
import { CheckCircle, ArrowLeft, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { useRouter } from 'next/navigation';

interface Props {
  orderNumber: string;
  clientName: string;
  createdAt: Date;
  fromModal?: boolean;
}

export const OrderSuccessHeader: React.FC<Props> = ({
  orderNumber,
  clientName,
  createdAt,
  fromModal = false
}) => {
  const router = useRouter();

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <div className="rounded-full bg-green-100 p-3">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          
          <div>
            <h1 className="text-3xl font-bold text-green-800 mb-2">
              Order Created Successfully!
            </h1>
            <div className="space-y-2">
              <p className="text-xl text-gray-700">
                Order <span className="font-semibold">#{orderNumber}</span>
              </p>
              <p className="text-gray-600">
                Client: <span className="font-medium">{clientName}</span>
              </p>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Calendar className="h-4 w-4" />
                Created on {format(createdAt, 'PPPp')}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Badge variant="secondary" className="bg-green-100 text-green-800">
            Confirmed
          </Badge>
          
          {fromModal && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.back()}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
