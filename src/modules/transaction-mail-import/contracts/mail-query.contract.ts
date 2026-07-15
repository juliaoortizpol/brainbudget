export interface MailQueryOptions {
  after?: Date;
  newerThanDays?: number;
}

export interface BuiltMailQuery {
  query: string | null;
  senderAddresses: string[];
  subjectKeywords: string[];
  supportedAccountIds: string[];
}
