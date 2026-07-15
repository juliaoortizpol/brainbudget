import { Injectable } from '@nestjs/common';
import * as cheerio from 'cheerio';
import { GmailMessage } from '@/modules/gmail-reader/gmail-reader.types';
import {
  InstitutionMailParser,
  MailImportRule,
  ParsedMailTransaction,
} from '../../contracts';

@Injectable()
export class QikCreditCardMailParser implements InstitutionMailParser {
  readonly parserKey = 'qik.credit-card';
  readonly version = 1;

  canParse(message: GmailMessage, rule: MailImportRule): boolean {
    if (
      rule.parserKey !== this.parserKey ||
      rule.parserVersion !== this.version ||
      rule.accountType !== 'credit_card'
    ) {
      return false;
    }
    const text = cheerio.load(message.body).text();
    return (
      /tarjeta\s+cr[eé]dito\s+qik/i.test(text) &&
      /fecha\s+y\s+hora/i.test(text) &&
      /monto/i.test(text)
    );
  }

  parse(message: GmailMessage, rule: MailImportRule): ParsedMailTransaction[] {
    const $ = cheerio.load(message.body);
    const fields = this.extractFields($);
    const amount = this.parseAmount(fields.get('monto'));
    const transactionDate = this.parseAstDate(fields.get('fecha y hora'));
    const description = fields.get('localidad')?.trim();
    const accountLast4 = this.extractLastFour($.text());

    if (!amount || !transactionDate || !description || !accountLast4) {
      return [];
    }

    return [
      {
        institutionId: rule.institutionId,
        accountType: 'credit_card',
        accountLast4,
        amount: amount.value,
        currency: amount.currency,
        type: 'expense',
        description,
        transactionDate,
      },
    ];
  }

  private extractFields($: cheerio.CheerioAPI): Map<string, string> {
    const fields = new Map<string, string>();
    $('tr').each((_, row) => {
      const cells = $(row).find('td');
      if (cells.length < 2) return;
      const label = this.normalizeLabel($(cells[0]).text());
      const value = $(cells[cells.length - 1])
        .text()
        .replace(/\s+/g, ' ')
        .trim();
      if (label && value && label !== value) fields.set(label, value);
    });
    return fields;
  }

  private parseAmount(
    value?: string,
  ): { value: number; currency: string } | null {
    if (!value) return null;
    const currency = /^\s*(?:RD\$|DOP)/i.test(value)
      ? 'DOP'
      : /^\s*(?:US\$|USD)/i.test(value)
        ? 'USD'
        : null;
    const numberText = value.match(/[0-9][0-9,]*(?:\.[0-9]{1,2})?/)?.[0];
    if (!currency || !numberText) return null;
    const amount = Number(numberText.replace(/,/g, ''));
    if (!Number.isFinite(amount) || amount <= 0) return null;
    return { value: amount, currency };
  }

  private parseAstDate(value?: string): Date | null {
    if (!value) return null;
    const match = value.match(
      /^(\d{2})-(\d{2})-(\d{4})\s+(\d{1,2}):(\d{2})\s+(AM|PM)\s+\(AST\)$/i,
    );
    if (!match) return null;
    const [, month, day, year, hourText, minute, period] = match;
    let hour = Number(hourText) % 12;
    if (period.toUpperCase() === 'PM') hour += 12;
    const date = new Date(
      Date.UTC(
        Number(year),
        Number(month) - 1,
        Number(day),
        hour + 4,
        Number(minute),
      ),
    );
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private extractLastFour(text: string): string | undefined {
    return text.match(/\b\d{2}\*+(\d{4})\b/)?.[1];
  }

  private normalizeLabel(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }
}
