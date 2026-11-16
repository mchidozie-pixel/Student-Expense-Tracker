import test from 'node:test';
import assert from 'node:assert/strict';

import { SAMPLE_MOMO_MESSAGES, parseMoMoMessage } from '../src/utils/momoParser';

/**
 * The five sample messages shown in the import sheet are the contract the
 * parser is written against: if one of them stops parsing, a student pasting
 * that exact message would be asked to type everything by hand.
 */
const expected = [
  {
    title: 'MTN MoMo - Simba Supermarket',
    amount: 4500,
    recipient: 'SIMBA SUPERMARKET KIMIHURURA',
    date: '2026-10-28',
    reference: '1029381923',
  },
  {
    title: 'MTN MoMo - Yego Moto ride',
    amount: 1200,
    recipient: 'YEGO MOTO',
    date: '2026-10-29',
    reference: '882910245',
  },
  {
    title: 'MTN MoMo - Student Data Bundle',
    amount: 2000,
    recipient: 'MTN Internet Pack',
    date: '2026-10-27',
    reference: '7726182901',
  },
  {
    title: 'MTN MoMo - ALU Campus Cafeteria',
    amount: 2500,
    recipient: 'ALU CAFETERIA BUMBOGO',
    date: '2026-10-30',
    reference: '99182371',
  },
  {
    title: 'Airtel Money - Campus Printing',
    amount: 1500,
    recipient: 'INNOVATION CITY PRINT SHOP',
    date: '2026-10-26',
    reference: 'AM9182931',
  },
  {
    title: 'MTN MoMo - Cashpower Electricity',
    amount: 5000,
    recipient: 'REG CASHPOWER TOKEN',
    date: '2026-10-20',
    reference: '661928401',
  },
];

for (const item of expected) {
  test(`reads the ${item.title} sample`, () => {
    const sample = SAMPLE_MOMO_MESSAGES.find((message) => message.title === item.title);
    assert.ok(sample, `the sample "${item.title}" is missing from the import sheet`);

    const result = parseMoMoMessage(sample.sms);

    assert.equal(result.success, true);
    assert.equal(result.amount, item.amount);
    assert.equal(result.recipient, item.recipient);
    assert.equal(result.date, item.date);
    assert.equal(result.reference, item.reference);
    assert.equal(result.currency, 'RWF');
    assert.equal(result.error, undefined);
  });
}

test('takes the paid amount, not the balance left afterwards', () => {
  const result = parseMoMoMessage(
    'You have paid 4,500 RWF to SIMBA SUPERMARKET KIMIHURURA on 2026-10-28 18:45:10. Fee was 0 RWF. New balance: 37,500 RWF.'
  );

  assert.equal(result.success, true);
  assert.equal(result.amount, 4500);
});

test('refuses money that came in, because it is not spending', () => {
  const result = parseMoMoMessage(
    'You have received 5,000 RWF from JEAN on 2026-11-01. Financial TxId: 111.'
  );

  assert.equal(result.success, false);
  assert.equal(result.amount, undefined);
  assert.match(result.error ?? '', /money coming in/i);
});

test('asks for a message when the box is empty', () => {
  const result = parseMoMoMessage('   ');

  assert.equal(result.success, false);
  assert.equal(result.confidence, 0);
  assert.match(result.error ?? '', /paste or type/i);
});

test('says so plainly when a message holds no amount', () => {
  const result = parseMoMoMessage('hello there');

  assert.equal(result.success, false);
  assert.match(result.error ?? '', /could not detect an expense amount/i);
});

test('always hands back the text it was given', () => {
  const raw = 'Payment of Rwf 1,500 to INNOVATION CITY PRINT SHOP completed on 2026-10-26 15:30:12.';

  assert.equal(parseMoMoMessage(raw).rawText, raw);
});
