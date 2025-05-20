// src/app/(site)/sales/book/page.tsx
import { Metadata } from 'next';
import { Suspense } from 'react';
import BookingForm from '@/components/VirtualAssistant/Sales/BookingForm';

export const metadata: Metadata = {
  title: 'Book Your Virtual Assistant Package | Expert VA Services',
  description: 'Complete your booking for professional virtual assistant services. Get started with your customized VA package today.',
};

export default function BookingPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-white to-gray-50 py-16">
      <Suspense fallback={<div className="max-w-2xl mx-auto px-4 pt-40">Loading...</div>}>
        <BookingForm />
      </Suspense>
    </main>
  );
}