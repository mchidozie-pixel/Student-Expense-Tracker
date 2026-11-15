import { Transaction, RecurringCluster } from '../types';

/**
 * Analyzes transaction history to detect repeating expenses by amount, category, and recipient.
 * Meets FR 8.1.
 */
export function detectRecurringExpenses(transactions: Transaction[]): {
  clusters: RecurringCluster[];
  recurringTransactionIds: Set<string>;
  totalEstimatedMonthly: number;
} {
  const recurringTransactionIds = new Set<string>();
  const clusters: RecurringCluster[] = [];

  if (transactions.length < 2) {
    return { clusters, recurringTransactionIds, totalEstimatedMonthly: 0 };
  }

  // Group by (category + ':' + amount) or (recipient + ':' + amount)
  const groups = new Map<string, Transaction[]>();

  for (const tx of transactions) {
    // Primary key: Category + Amount
    const keyCat = `${tx.category.toLowerCase()}::${tx.amount}`;
    if (!groups.has(keyCat)) {
      groups.set(keyCat, []);
    }
    groups.get(keyCat)!.push(tx);

    // If recipient is present and distinct from category
    if (tx.recipient && tx.recipient.trim() !== '') {
      const keyRec = `rec::${tx.recipient.toLowerCase().trim()}::${tx.amount}`;
      if (!groups.has(keyRec)) {
        groups.set(keyRec, []);
      }
      groups.get(keyRec)!.push(tx);
    }
  }

  const processedClusterSignatures = new Set<string>();

  for (const [key, items] of groups.entries()) {
    // Needs at least 2 occurrences
    if (items.length < 2) continue;

    // Deduplicate items and filter only valid dates
    const uniqueItems = Array.from(new Set(items)).filter((t) => t && t.date);
    if (uniqueItems.length < 2) continue;

    // Sort by date ascending
    uniqueItems.sort((a, b) => {
      const timeA = new Date(a.date).getTime() || 0;
      const timeB = new Date(b.date).getTime() || 0;
      return timeA - timeB;
    });

    // Check intervals between consecutive transactions (in days)
    const intervals: number[] = [];
    for (let i = 1; i < uniqueItems.length; i++) {
      const d1 = new Date(uniqueItems[i - 1].date).getTime();
      const d2 = new Date(uniqueItems[i].date).getTime();
      const diffDays = Math.round(Math.abs(d2 - d1) / (1000 * 60 * 60 * 24));
      intervals.push(diffDays);
    }

    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;

    let estimatedFrequency: 'weekly' | 'bi-weekly' | 'monthly' = 'monthly';
    let monthlyEstimate = uniqueItems[0].amount;

    if (avgInterval <= 9) {
      estimatedFrequency = 'weekly';
      monthlyEstimate = uniqueItems[0].amount * 4.3;
    } else if (avgInterval <= 18) {
      estimatedFrequency = 'bi-weekly';
      monthlyEstimate = uniqueItems[0].amount * 2.15;
    } else {
      estimatedFrequency = 'monthly';
      monthlyEstimate = uniqueItems[0].amount;
    }

    const sample = uniqueItems[0];
    const signature = `${sample.category}-${sample.amount}-${sample.recipient || ''}`;

    if (!processedClusterSignatures.has(signature)) {
      processedClusterSignatures.add(signature);

      const cluster: RecurringCluster = {
        id: `rec-${clusters.length + 1}`,
        category: sample.category,
        amount: sample.amount,
        recipient: sample.recipient,
        occurrences: uniqueItems.length,
        estimatedFrequency,
        monthlyEstimate: Math.round(monthlyEstimate),
        transactions: uniqueItems,
        lastDate: uniqueItems[uniqueItems.length - 1].date,
      };

      clusters.push(cluster);

      for (const item of uniqueItems) {
        recurringTransactionIds.add(item.id);
      }
    }
  }

  // Sort clusters by monthly estimate descending
  clusters.sort((a, b) => b.monthlyEstimate - a.monthlyEstimate);

  const totalEstimatedMonthly = clusters.reduce((acc, c) => acc + c.monthlyEstimate, 0);

  return {
    clusters,
    recurringTransactionIds,
    totalEstimatedMonthly,
  };
}
