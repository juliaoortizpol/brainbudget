export interface ParsedTransaction {
  amount: number;
  date: Date;
  description: string;
  type: 'income' | 'expense';
  accountType: string;
}

export type ParserFunction = (emailBody: string, subject: string) => ParsedTransaction | null;

export interface ParserDefinition {
  id: string;
  parse: ParserFunction;
}
