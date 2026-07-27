import { GmailMessage } from '@/modules/gmail-reader/gmail-reader.types';
import { MailImportRule } from '../../../contracts';

export const apapCreditCardRuleFixture: MailImportRule = {
  institutionId: 'apap-institution-id',
  institutionName: 'Asociación Popular de Ahorros y Préstamos',
  senderAddresses: ['no-reply@apap.com.do'],
  subjectKeywords: ['APAP, Notificaciones'],
  parserKey: 'apap.credit-card',
  parserVersion: 1,
  accountType: 'credit_card',
};

export const apapCreditCardMessageFixture: GmailMessage = {
  id: 'apap-message-fixture-1',
  from: 'HOLAPAP <no-reply@apap.com.do>',
  to: ['customer@example.com'],
  subject: 'APAP, Notificaciones',
  sentAt: new Date('2026-07-26T14:25:00.000Z'),
  snippet: 'Tu tarjeta de Crédito APAP presenta una transacción.',
  mimeType: 'text/html',
  body: `
    <html lang="es">
      <body>
        <p>Hola CLIENTE</p>
        <p>
          Tu tarjeta de Crédito titular-Visa Rose Gold APAP terminada en 2324
          presenta una transacción, con el siguiente detalle:
        </p>
        <p><b>Detalle de la transacción</b></p>
        <p><b>Fecha:</b> 26/07/2026</p>
        <p><b>Hora:</b> 10:25</p>
        <p><b>Moneda:</b> RD pesos dominicanos</p>
        <p><b>Monto:</b> 129.79</p>
        <p><b>Comercio:</b> UBER RIDES-W*UBER RIDE</p>
        <p><b>Estado:</b> APROBADA</p>
        <p><b>Balance disponible:</b> RD$78,355.72</p>
      </body>
    </html>
  `,
};
