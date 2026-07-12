export interface GmailMessage {
  id: string;
  threadId?: string;
  historyId?: string;
  internalDate?: Date;
  from: string;
  to: string[];
  subject: string;
  sentAt?: Date;
  snippet: string;
  body: string;
  mimeType: string;
}

export interface GmailMessagePage {
  messages: GmailMessage[];
  nextPageToken?: string;
  resultSizeEstimate: number;
}
