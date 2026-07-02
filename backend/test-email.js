// Isolated SMTP test — patakbuhin: node test-email.js
// Layunin: i-verify na tama ang SMTP credentials mo BAGO mag-test ng buong
// checkout/order flow, para alam mo agad kung saan nagkaroon ng problema.
require('dotenv').config();
const { sendStatusEmail, isEmailConfigured } = require('./utils/email');

(async () => {
  console.log('SMTP configured:', isEmailConfigured());

  if (!isEmailConfigured()) {
    console.log('❌ Wala pang laman ang SMTP_HOST / SMTP_USER / SMTP_PASS sa .env mo.');
    process.exit(1);
  }

  console.log('Sending test email...');

  const result = await sendStatusEmail({
    to: 'test@furnitureshop.local',
    title: 'Test Email',
    message: 'Kung nabasa mo ito sa Mailtrap inbox, gumagana na ang SMTP config mo!',
  });

  console.log('Result:', result);
  console.log('✅ Pumunta ka sa Mailtrap.io → Inboxes → tingnan mo kung dumating.');
})();