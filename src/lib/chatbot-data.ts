// src/lib/chatbot-data.ts

import { FAQItem } from '@/types/chatbot';

export const FAQ_DATA: FAQItem[] = [
  {
    id: '1',
    question: 'What are your service hours?',
    answer: 'We operate Monday through Friday from 8:00 AM to 8:00 PM, and weekends from 9:00 AM to 6:00 PM. We also offer 24/7 emergency delivery services for urgent requests.',
    category: 'services'
  },
  {
    id: '2',
    question: 'What areas do you cover?',
    answer: 'We provide delivery services throughout the entire Bay Area, including San Francisco, Oakland, San Jose, and surrounding cities. Contact us for specific location availability.',
    category: 'delivery'
  },
  {
    id: '3',
    question: 'How much does delivery cost?',
    answer: 'Our pricing varies based on distance, delivery type, and urgency. Standard deliveries start at $15 within the city. For an accurate quote, please provide your pickup and delivery locations.',
    category: 'pricing'
  },
  {
    id: '4',
    question: 'How long does delivery take?',
    answer: 'Standard deliveries typically take 1-3 hours. Express delivery (1 hour) and urgent delivery (30 minutes) options are also available for an additional fee.',
    category: 'delivery'
  },
  {
    id: '5',
    question: 'What payment methods do you accept?',
    answer: 'We accept all major credit cards, debit cards, PayPal, and cash payments. Corporate accounts can also pay via invoice.',
    category: 'general'
  },
  {
    id: '6',
    question: 'Do you deliver food from restaurants?',
    answer: 'Yes! We specialize in food delivery and are Food Safety certified. We maintain proper temperature control and follow all health regulations for safe food transport.',
    category: 'services'
  },
  {
    id: '7',
    question: 'Can you deliver flowers for special occasions?',
    answer: 'Absolutely! We handle delicate flower deliveries with special care, ensuring your arrangements arrive fresh and beautiful for weddings, anniversaries, and other special events.',
    category: 'services'
  },
  {
    id: '8',
    question: 'Do you handle medical deliveries?',
    answer: 'Yes, we are HIPAA certified and can securely transport medical supplies, prescriptions, and documents while maintaining complete confidentiality and compliance.',
    category: 'services'
  },
  {
    id: '9',
    question: 'Can I track my delivery?',
    answer: 'Yes! Once your order is confirmed, you\'ll receive a tracking number that allows you to monitor your delivery in real-time through our website or mobile app.',
    category: 'delivery'
  },
  {
    id: '10',
    question: 'What if I need to cancel my order?',
    answer: 'Orders can be cancelled free of charge up to 30 minutes after placing. After that, cancellation fees may apply depending on the delivery status. Contact us immediately for assistance.',
    category: 'general'
  }
];

export const SERVICE_TYPES = [
  {
    id: 'food',
    name: 'Food Delivery',
    description: 'Restaurant pickups, catering, and food transport with temperature control',
    icon: '🍕'
  },
  {
    id: 'flower',
    name: 'Flower Delivery',
    description: 'Delicate handling for weddings, events, and special occasions',
    icon: '🌸'
  },
  {
    id: 'bakery',
    name: 'Bakery Items',
    description: 'Cakes, pastries, and baked goods with careful transport',
    icon: '🍰'
  },
  {
    id: 'special',
    name: 'Special Delivery',
    description: 'Documents, medical supplies, and other specialized items',
    icon: '📦'
  }
];

export const QUICK_RESPONSES = [
  'Get a Quote',
  'Track Order',
  'Service Hours',
  'Coverage Areas',
  'Pricing Info',
  'Contact Support'
];

export const GREETING_MESSAGES = [
  "Hi! I'm Ready Set's virtual assistant. How can I help you today?",
  "Hello! Welcome to Ready Set. I'm here to help with quotes, tracking, and questions about our delivery services.",
  "Hi there! Need help with a delivery quote or have questions about our services?"
];
