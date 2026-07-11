import { ParserDefinition } from '../types';
import { Logger } from '@nestjs/common';
import * as cheerio from 'cheerio';

const logger = new Logger('BanreservasCreditCardParser');

export const banreservasCreditCardParser: ParserDefinition = {
  id: 'banreservas_tc_v1',
  parse: (body: string, subject: string) => {
    logger.debug('Executing banreservas_tc_v1 parser');
    try {
      const $ = cheerio.load(body);
      let amount = 0;
      let description = 'Banreservas Transaction';
      let date = new Date();

      $('td').each((i, el) => {
        const text = $(el).text().trim();
        
        if (text === 'Monto:') {
          const amountText = $(el).parent().next('tr').find('td').text().trim();
          const match = amountText.match(/([0-9,.]+)/);
          if (match) {
            amount = parseFloat(match[1].replace(/,/g, ''));
          }
        }

        if (text === 'Comercio:') {
          description = $(el).parent().next('tr').find('td').text().trim();
        }

        if (text === 'Fecha de transacción:') {
          const dateText = $(el).parent().next('tr').find('td').text().trim();
          const match = dateText.match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})\s+(AM|PM)/i);
          if (match) {
            let [_, day, month, year, hours, minutes, ampm] = match;
            let h = parseInt(hours, 10);
            if (ampm.toUpperCase() === 'PM' && h < 12) h += 12;
            if (ampm.toUpperCase() === 'AM' && h === 12) h = 0;
            date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), h, parseInt(minutes));
          }
        }
      });

      const type = subject.toLowerCase().includes('consumo') ? 'expense' : 'expense';

      return {
        amount,
        date,
        description,
        type,
        accountType: 'credit',
      };
    } catch (error) {
      logger.error('Failed to parse with banreservas_tc_v1', error);
      return null;
    }
  },
};
