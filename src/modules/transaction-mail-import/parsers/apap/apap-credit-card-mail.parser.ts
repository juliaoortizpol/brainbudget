import { Injectable } from '@nestjs/common';
import * as cheerio from 'cheerio';
import { GmailMessage } from '@/modules/gmail-reader/gmail-reader.types';
import {
  InstitutionMailParser,
  MailImportRule,
  ParsedMailTransaction,
} from '../../contracts';

@Injectable()
export class ApapCreditCardMailParser implements InstitutionMailParser {
  readonly parserKey = 'apap.credit-card';
  readonly version = 1;

  canParse(message: GmailMessage, rule: MailImportRule): boolean {
    if (
      rule.parserKey !== this.parserKey ||
      rule.parserVersion !== this.version ||
      rule.accountType !== 'credit_card'
    ) {
      return false;
    }

    const text = this.getNormalizedText(message.body);
    return (
      /tarjeta de credito.+apap.+terminada en \d{4}/i.test(text) &&
      /\bfecha\s*:/i.test(text) &&
      /\bmonto\s*:/i.test(text) &&
      /\bcomercio\s*:/i.test(text)
    );
  }

  parse(message: GmailMessage, rule: MailImportRule): ParsedMailTransaction[] {
    const text = this.getNormalizedText(message.body);
    const status = this.extractField(text, 'estado');
    if (status?.toUpperCase() !== 'APROBADA') return [];

    const accountLast4 = text.match(/terminada en\s+(\d{4})\b/i)?.[1];
    const date = this.extractField(text, 'fecha');
    const time = this.extractField(text, 'hora');
    const amount = this.parseAmount(
      this.extractField(text, 'moneda'),
      this.extractField(text, 'monto'),
    );
    const description = this.extractField(text, 'comercio');
    const transactionDate = this.parseDominicanDate(date, time);

    if (!accountLast4 || !amount || !description || !transactionDate) {
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

  private getNormalizedText(body: string): string {
    const $ = cheerio.load(body);
    $('br').replaceWith('\n');
    $('p, div, tr, li').each((_, element) => {
      $(element).append('\n');
    });
    return $.root()
      .text()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\r/g, '')
      .replace(/[ \t\u00a0]+/g, ' ')
      .replace(/\n+/g, '\n')
      .trim();
  }

  private extractField(text: string, label: string): string | undefined {
    const labels = 'fecha|hora|moneda|monto|comercio|estado|balance disponible';
    const match = text.match(
      new RegExp(
        `(?:^|\\n)\\s*${label}\\s*:\\s*(.+?)(?=\\n\\s*(?:${labels})\\s*:|$)`,
        'i',
      ),
    );
    return match?.[1].replace(/\s+/g, ' ').trim();
  }

  private parseAmount(
    currencyText?: string,
    amountText?: string,
  ): { value: number; currency: string } | null {
    if (!currencyText || !amountText) return null;
    const currency = /\b(?:rd|dop|pesos? dominicanos?)\b/i.test(currencyText)
      ? 'DOP'
      : /\b(?:us|usd|dolares?)\b/i.test(currencyText)
        ? 'USD'
        : null;
    const numberText = amountText.match(/[0-9][0-9,]*(?:\.[0-9]{1,2})?/)?.[0];
    if (!currency || !numberText) return null;
    const value = Number(numberText.replace(/,/g, ''));
    return Number.isFinite(value) && value > 0 ? { value, currency } : null;
  }

  private parseDominicanDate(date?: string, time?: string): Date | null {
    const dateMatch = date?.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    const timeMatch = time?.match(/^(\d{1,2}):(\d{2})$/);
    if (!dateMatch || !timeMatch) return null;

    const [, day, month, year] = dateMatch;
    const [, hour, minute] = timeMatch;
    const transactionDate = new Date(
      Date.UTC(
        Number(year),
        Number(month) - 1,
        Number(day),
        Number(hour) + 4,
        Number(minute),
      ),
    );
    return Number.isNaN(transactionDate.getTime()) ? null : transactionDate;
  }
}
