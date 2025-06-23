// src/lib/chatbot-logic.ts

import { ChatMessage, ChatbotState, QuoteRequest } from '@/types/chatbot';
import { FAQ_DATA, SERVICE_TYPES, QUICK_RESPONSES, GREETING_MESSAGES } from './chatbot-data';

export class ChatbotLogic {
  private state: ChatbotState;

  constructor(initialState?: Partial<ChatbotState>) {
    this.state = {
      messages: [],
      isOpen: false,
      isTyping: false,
      userContext: {},
      ...initialState
    };
  }

  getState(): ChatbotState {
    return this.state;
  }

  setState(newState: Partial<ChatbotState>): void {
    this.state = { ...this.state, ...newState };
  }

  generateId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  addMessage(content: string, sender: 'user' | 'bot', options?: string[]): ChatMessage {
    const message: ChatMessage = {
      id: this.generateId(),
      content,
      sender,
      timestamp: new Date(),
      type: options ? 'options' : 'text',
      options
    };
    
    this.state.messages.push(message);
    return message;
  }

  getGreeting(): string {
    const randomIndex = Math.floor(Math.random() * GREETING_MESSAGES.length);
    return GREETING_MESSAGES[randomIndex];
  }

  findFAQAnswer(userMessage: string): string | null {
    const lowerMessage = userMessage.toLowerCase();
    
    // Simple keyword matching - in production, you'd use more sophisticated NLP
    const keywords = [
      { terms: ['hours', 'time', 'open', 'close'], faqId: '1' },
      { terms: ['area', 'location', 'where', 'coverage', 'deliver to'], faqId: '2' },
      { terms: ['cost', 'price', 'pricing', 'how much', 'fee'], faqId: '3' },
      { terms: ['how long', 'delivery time', 'fast', 'quick'], faqId: '4' },
      { terms: ['payment', 'pay', 'credit card', 'cash'], faqId: '5' },
      { terms: ['food', 'restaurant', 'meal'], faqId: '6' },
      { terms: ['flower', 'bouquet', 'wedding', 'roses'], faqId: '7' },
      { terms: ['medical', 'prescription', 'hipaa', 'medicine'], faqId: '8' },
      { terms: ['track', 'tracking', 'status', 'where is'], faqId: '9' },
      { terms: ['cancel', 'cancellation', 'refund'], faqId: '10' }
    ];

    for (const keyword of keywords) {
      if (keyword.terms.some(term => lowerMessage.includes(term))) {
        const faq = FAQ_DATA.find(item => item.id === keyword.faqId);
        return faq ? faq.answer : null;
      }
    }

    return null;
  }

  detectIntent(userMessage: string): string {
    const lowerMessage = userMessage.toLowerCase();
    
    if (lowerMessage.includes('quote') || lowerMessage.includes('price') || lowerMessage.includes('estimate')) {
      return 'get_quote';
    }
    
    if (lowerMessage.includes('track') || lowerMessage.includes('tracking')) {
      return 'track_order';
    }
    
    if (lowerMessage.includes('contact') || lowerMessage.includes('support') || lowerMessage.includes('human')) {
      return 'contact_support';
    }
    
    if (lowerMessage.includes('service') || lowerMessage.includes('delivery type')) {
      return 'service_info';
    }
    
    return 'faq_or_general';
  }

  processUserMessage(userMessage: string): ChatMessage[] {
    const responses: ChatMessage[] = [];
    
    // Add user message first
    this.addMessage(userMessage, 'user');
    
    const intent = this.detectIntent(userMessage);
    
    switch (intent) {
      case 'get_quote':
        responses.push(this.handleQuoteRequest());
        break;
        
      case 'track_order':
        responses.push(this.handleTrackingRequest());
        break;
        
      case 'contact_support':
        responses.push(this.handleContactRequest());
        break;
        
      case 'service_info':
        responses.push(this.handleServiceInfo());
        break;
        
      default:
        // Try to find FAQ answer
        const faqAnswer = this.findFAQAnswer(userMessage);
        if (faqAnswer) {
          responses.push(this.addMessage(faqAnswer, 'bot'));
          responses.push(this.addMessage('Is there anything else I can help you with?', 'bot', QUICK_RESPONSES));
        } else {
          responses.push(this.handleGeneralQuery(userMessage));
        }
        break;
    }
    
    return responses;
  }

  handleQuoteRequest(): ChatMessage {
    this.state.currentStep = 'quote_service_type';
    const serviceOptions = SERVICE_TYPES.map(service => `${service.icon} ${service.name}`);
    
    return this.addMessage(
      'I\'d be happy to help you get a quote! What type of delivery do you need?',
      'bot',
      serviceOptions
    );
  }

  handleServiceSelection(selection: string): ChatMessage[] {
    const responses: ChatMessage[] = [];
    
    // Find the selected service
    const service = SERVICE_TYPES.find(s => selection.includes(s.name));
    if (service) {
      this.state.userContext = { ...this.state.userContext, serviceType: service.id };
      this.state.currentStep = 'quote_pickup_location';
      
      responses.push(this.addMessage(`Great choice! ${service.description}`, 'bot'));
      responses.push(this.addMessage('What\'s the pickup address or location?', 'bot'));
    }
    
    return responses;
  }

  handleTrackingRequest(): ChatMessage {
    return this.addMessage(
      'To track your order, please enter your tracking number. You can find it in the confirmation email we sent you.',
      'bot'
    );
  }

  handleContactRequest(): ChatMessage {
    return this.addMessage(
      'I\'d be happy to connect you with our support team! You can:\n\n📞 Call us at: (415) 555-0123\n📧 Email: support@readysetllc.com\n\nOr would you like me to collect your information and have someone call you back?',
      'bot',
      ['Request Callback', 'Continue with Chat']
    );
  }

  handleServiceInfo(): ChatMessage {
    const serviceList = SERVICE_TYPES.map(service => 
      `${service.icon} **${service.name}**: ${service.description}`
    ).join('\n\n');
    
    return this.addMessage(
      `Here are our delivery services:\n\n${serviceList}\n\nWhich service interests you?`,
      'bot',
      SERVICE_TYPES.map(s => s.name)
    );
  }

  handleGeneralQuery(userMessage: string): ChatMessage {
    const responses = [
      "I'm not sure I understand that completely. Could you rephrase your question?",
      "Let me help you with that. Could you be more specific about what you're looking for?",
      "I want to make sure I give you the right information. Could you clarify what you need help with?"
    ];
    
    const randomResponse = responses[Math.floor(Math.random() * responses.length)];
    return this.addMessage(`${randomResponse}`, 'bot', QUICK_RESPONSES);
  }

  handleLocationInput(location: string, type: 'pickup' | 'delivery'): ChatMessage[] {
    const responses: ChatMessage[] = [];
    
    if (type === 'pickup') {
      this.state.userContext = { ...this.state.userContext, origin: location };
      this.state.currentStep = 'quote_delivery_location';
      
      responses.push(this.addMessage(`Perfect! Pickup location: ${location}`, 'bot'));
      responses.push(this.addMessage('Now, what\'s the delivery address?', 'bot'));
    } else {
      this.state.userContext = { ...this.state.userContext, destination: location };
      this.state.currentStep = 'quote_contact_info';
      
      responses.push(this.addMessage(`Great! Delivery location: ${location}`, 'bot'));
      responses.push(this.generateQuoteEstimate());
      responses.push(this.addMessage('Would you like me to prepare a formal quote? I\'ll need your email address.', 'bot', ['Yes, send quote', 'Just browsing']));
    }
    
    return responses;
  }

  generateQuoteEstimate(): ChatMessage {
    // Simple pricing logic - in production, this would be more sophisticated
    const basePrice = 15;
    const distance = Math.floor(Math.random() * 20) + 5; // Mock distance
    const estimatedPrice = basePrice + (distance * 1.5);
    const estimatedTime = Math.floor(distance / 10) + 1;
    
    return this.addMessage(
      `Based on your locations:\n\n💰 **Estimated Cost**: $${estimatedPrice.toFixed(2)}\n⏱️ **Estimated Time**: ${estimatedTime}-${estimatedTime + 1} hours\n📏 **Distance**: ~${distance} miles\n\n*This is a preliminary estimate. Final pricing may vary based on specific requirements.*`,
      'bot'
    );
  }

  initializeChat(): ChatMessage[] {
    const greeting = this.getGreeting();
    return [
      this.addMessage(greeting, 'bot'),
      this.addMessage('What can I help you with today?', 'bot', QUICK_RESPONSES)
    ];
  }
}
