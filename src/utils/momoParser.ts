import { ParsedMoMoResult, Category } from '../types';
import { suggestCategory } from './categorizer';
import { toLocalDateString } from './storage';

export const SAMPLE_MOMO_MESSAGES = [
  {
    title: 'MTN MoMo - Simba Supermarket',
    sms: 'You have paid 4,500 RWF to SIMBA SUPERMARKET KIMIHURURA (code 18293) on 2026-10-28 18:45:10. Fee was 0 RWF. New balance: 37,500 RWF. TxId: 1029381923.',
  },
  {
    title: 'MTN MoMo - Yego Moto ride',
    sms: 'Your payment of 1,200 RWF to YEGO MOTO (plate RA 492 B) at 2026-10-29 09:15:00 has been completed. Fee was 0 RWF. TxId: 882910245.',
  },
  {
    title: 'MTN MoMo - Student Data Bundle',
    sms: 'Yello! You have purchased an Internet Pack of 2,000 RWF on 2026-10-27 11:20:00. Your new MoMo balance: 41,300 RWF. Financial TxId: 7726182901.',
  },
  {
    title: 'MTN MoMo - ALU Campus Cafeteria',
    sms: 'TxId: 99182371. You paid 2,500 RWF to ALU CAFETERIA BUMBOGO on 2026-10-30 13:15:00. New balance: 38,800 RWF.',
  },
  {
    title: 'Airtel Money - Campus Printing',
    sms: 'Payment of Rwf 1,500 to INNOVATION CITY PRINT SHOP completed on 2026-10-26 15:30:12. Ref: AM9182931.',
  },
  {
    title: 'MTN MoMo - Cashpower Electricity',
    sms: 'You have paid 5,000 RWF to REG CASHPOWER TOKEN (meter 04291820) on 2026-10-20 10:05:00. TxId: 661928401.',
  },
];

/**
 * Parses raw MoMo SMS text using pattern matching.
 * Extracts amount, recipient, date, time, and transaction reference.
 */
export function parseMoMoMessage(
  rawText: string,
  categories?: Category[]
): ParsedMoMoResult {
  if (!rawText || rawText.trim().length === 0) {
    return {
      success: false,
      rawText,
      confidence: 0,
      error: 'Please paste or type a mobile money SMS message.',
    };
  }

  const clean = rawText.trim();

  // Incoming money (salary, transfer received, refund) has an amount too, but
  // it is not spending. Flag it before the amount rules grab a balance figure.
  const looksIncoming =
    /(received|credited|deposit|refund|cash in|has sent you)/i.test(clean) &&
    !/(paid|payment of|purchased|transferred|you sent|bought|withdrew|withdrawal)/i.test(clean);
  if (looksIncoming) {
    return {
      success: false,
      rawText: clean,
      confidence: 0.15,
      error: 'This message looks like money coming in, not an expense. Add it manually only if you actually spent it.',
    };
  }

  // 1. Extract Amount
  // Matches: "4,500 RWF", "Rwf 5,000", "FRW 1200", "transferred 3,500", "paid 2,500"
  let amount: number | undefined;
  const amountRegexes = [
    /(?:paid|transferred|sent|payment of|pack of|purchased.*?of)\s*(?:RWF|Rwf|FRW|Frw)?\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?|[0-9]+)\s*(?:RWF|Rwf|FRW|Frw)?/i,
    /([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?|[0-9]+)\s*(?:RWF|Rwf|FRW|Frw)/i,
    /(?:RWF|Rwf|FRW|Frw)\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?|[0-9]+)/i,
  ];

  for (const regex of amountRegexes) {
    const match = clean.match(regex);
    if (match && match[1]) {
      const parsed = parseFloat(match[1].replace(/,/g, ''));
      if (!isNaN(parsed) && parsed > 0) {
        amount = parsed;
        break;
      }
    }
  }

  // 2. Extract Recipient / Merchant
  // Matches: "to SIMBA SUPERMARKET KIMIHURURA (code ...)", "to YEGO MOTO", "to KEZA CLAIRE"
  let recipient: string | undefined;
  const recipientMatch = clean.match(
    /\bto\s+([A-Z0-9\s&'-]+?)(?:\s*\([^)]*\))?(?:\s+on|\s+at|\s+completed|\s+with|\s+fee|\.|\n|$)/i
  );

  if (recipientMatch && recipientMatch[1]) {
    const candidate = recipientMatch[1].trim();
    if (candidate.length > 1 && !/^(the|a|an|new|fee|rwf|frw)$/i.test(candidate)) {
      recipient = candidate;
    }
  }

  // Fallback for Internet Pack or specific purchase phrases
  if (!recipient && /internet pack|data bundle/i.test(clean)) {
    recipient = 'MTN Internet Pack';
  } else if (!recipient && /cashpower/i.test(clean)) {
    recipient = 'REG Cashpower Electricity';
  }

  // 3. Extract Date & Time
  // Matches: 2026-10-28 18:45:10, 2026-10-28, 28/10/2026
  let date: string | undefined;
  let time: string | undefined;

  const dateTimeMatch = clean.match(/(\d{4}-\d{2}-\d{2})(?:\s+(\d{2}:\d{2}(?::\d{2})?))?/);
  if (dateTimeMatch) {
    date = dateTimeMatch[1];
    if (dateTimeMatch[2]) {
      time = dateTimeMatch[2].substring(0, 5); // HH:mm
    }
  } else {
    // Check DD/MM/YYYY or DD-MM-YYYY
    const dmyMatch = clean.match(/(\d{2})[\/\-](\d{2})[\/\-](\d{4})(?:\s+(\d{2}:\d{2}))?/);
    if (dmyMatch) {
      date = `${dmyMatch[3]}-${dmyMatch[2]}-${dmyMatch[1]}`;
      if (dmyMatch[4]) time = dmyMatch[4];
    }
  }

  // Fallback date to today if none detected (local calendar day)
  if (!date) {
    date = toLocalDateString();
  }

  // 4. Extract Transaction ID / Reference
  let reference: string | undefined;
  const refMatch = clean.match(/(?:TxId|Financial TxId|Ref|Reference)[:\s]+([A-Za-z0-9]+)/i);
  if (refMatch) {
    reference = refMatch[1];
  }

  if (!amount) {
    return {
      success: false,
      rawText: clean,
      confidence: 0.2,
      error: 'Could not detect an expense amount in the message. You can enter details manually.',
    };
  }

  // 5. Suggest Category based on recipient and note
  const suggestionText = `${recipient || ''} ${clean}`;
  const catResult = suggestCategory(suggestionText, categories);

  const confidence = 0.5 + (recipient ? 0.25 : 0) + (reference ? 0.15 : 0);

  return {
    success: true,
    amount,
    currency: 'RWF',
    recipient: recipient || 'MoMo Merchant/Recipient',
    date,
    time: time || '12:00',
    reference,
    suggestedCategory: catResult.categoryName,
    rawText: clean,
    confidence: Math.min(1.0, confidence),
  };
}
