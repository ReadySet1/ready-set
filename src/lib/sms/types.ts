export interface SmsResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface SmsProvider {
  send(to: string, body: string): Promise<SmsResult>;
}
