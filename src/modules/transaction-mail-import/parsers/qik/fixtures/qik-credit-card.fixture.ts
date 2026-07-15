import { GmailMessage } from '@/modules/gmail-reader/gmail-reader.types';
import { MailImportRule } from '../../../contracts';

export const qikCreditCardRuleFixture: MailImportRule = {
  institutionId: 'qik-institution-id',
  institutionName: 'Qik',
  senderAddresses: ['notificaciones@qik.do'],
  subjectKeywords: ['Usaste tu tarjeta de crédito Qik'],
  parserKey: 'qik.credit-card',
  parserVersion: 1,
  accountType: 'credit_card',
};

export const qikCreditCardMessageFixture: GmailMessage = {
  id: 'qik-message-fixture-1',
  from: 'notificaciones@qik.do',
  to: ['customer@example.com'],
  subject: 'Usaste tu tarjeta de crédito Qik',
  sentAt: new Date('2026-07-13T04:10:29.000Z'),
  snippet: 'Se hizo una transacción con tu tarjeta de crédito Qik.',
  mimeType: 'text/html',
  body: `
    <html lang="es">
      <body>
        <p>¡Hola, cliente!</p>
        <p>Tarjeta 53*************6747</p>
        <p>
          Se hizo una transacción de <b>RD$ 611.63</b> en
          <strong>APPLE.COM/BILL</strong> con tu tarjeta crédito Qik que termina
          en <strong>53*************6747</strong>.
        </p>
        <table>
          <tr><td>Localidad</td><td><strong>APPLE.COM/BILL</strong></td></tr>
          <tr><td>Fecha y hora</td><td><strong>07-13-2026 12:09 AM (AST)</strong></td></tr>
          <tr><td>Monto</td><td><b>RD$ 611.63</b></td></tr>
          <tr><td>Balance Disponible</td><td><strong>RD$ 2,144.37</strong></td></tr>
        </table>
      </body>
    </html>
  `,
};
