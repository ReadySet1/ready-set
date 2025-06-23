// src/types/chatbot.ts

export interface ChatMessage {
  id: string;
  content: string;
  sender: 'user' | 'bot';
  timestamp: Date;
  type?: 'text' | 'quick_reply' | 'options';
  options?: string[];
}

export interface ChatbotState {
  messages: ChatMessage[];
  isOpen: boolean;
  isTyping: boolean;
  currentStep?: string;
  userContext?: {
    serviceType?: string;
    origin?: string;
    destination?: string;
    email?: string;
    phone?: string;
  };
}

export interface QuoteRequest {
  serviceType: 'food' | 'flower' | 'bakery' | 'special';
  origin: string;
  destination: string;
  weight?: string;
  size?: string;
  urgency?: 'standard' | 'express' | 'urgent';
  specialInstructions?: string;
  contactInfo: {
    email: string;
    phone?: string;
    name?: string;
  };
}

export interface FAQItem {
  id: string;
  question: string;
  answer: string;
  category: 'services' | 'pricing' | 'delivery' | 'general';
}
