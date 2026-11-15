import { Category } from '../types';

export const DEFAULT_CATEGORIES: Category[] = [
  {
    id: 'food',
    name: 'Food & Dining',
    color: '#059669', // Emerald
    bgLight: '#ecfdf5',
    iconName: 'Utensils',
    keywords: [
      'canteen', 'cafeteria', 'lunch', 'dinner', 'breakfast', 'simba', 'sawa city',
      'supermarket', 'market', 'kimironko', 'food', 'snacks', 'coffee', 'java house',
      'restaurant', 'brochette', 'chapati', 'meat', 'bakery', 'meal', 'chips', 'groceries'
    ],
  },
  {
    id: 'transport',
    name: 'Transport',
    color: '#0284c7', // Sky
    bgLight: '#f0f9ff',
    iconName: 'Bike',
    keywords: [
      'moto', 'yego', 'yego moto', 'move', 'tap&go', 'bus', 'transport', 'taxi',
      'boda', 'fare', 'ride', 'fuel', 'petrol', 'transportation', 'plate'
    ],
  },
  {
    id: 'academics',
    name: 'Academics & Study',
    color: '#7c3aed', // Purple
    bgLight: '#f5f3ff',
    iconName: 'GraduationCap',
    keywords: [
      'tuition', 'printing', 'print', 'stationery', 'notebook', 'books', 'textbook',
      'pens', 'alu', 'course', 'exam', 'binder', 'project', 'materials', 'library'
    ],
  },
  {
    id: 'housing',
    name: 'Housing & Living',
    color: '#d97706', // Amber
    bgLight: '#fffbeb',
    iconName: 'Home',
    keywords: [
      'rent', 'hostel', 'room', 'landlord', 'electricity', 'cashpower', 'water',
      'wasac', 'reg', 'cleaning', 'trash', 'accommodation', 'deposit'
    ],
  },
  {
    id: 'telecom',
    name: 'Data & Airtime',
    color: '#0891b2', // Cyan
    bgLight: '#ecfeff',
    iconName: 'Wifi',
    keywords: [
      'airtime', 'mtn', 'airtel', 'bundle', 'internet', 'data', 'pack', 'liquid',
      'wifi', 'momo', 'gigabytes', 'broadband', 'recharge'
    ],
  },
  {
    id: 'personal',
    name: 'Personal Care & Health',
    color: '#e11d48', // Rose
    bgLight: '#fff1f2',
    iconName: 'HeartPulse',
    keywords: [
      'pharmacy', 'medicine', 'clinic', 'hospital', 'haircut', 'salon', 'barber',
      'laundry', 'soap', 'toiletries', 'cosmetics', 'toothpaste', 'hygiene'
    ],
  },
  {
    id: 'leisure',
    name: 'Leisure & Social',
    color: '#4f46e5', // Indigo
    bgLight: '#eef2ff',
    iconName: 'Film',
    keywords: [
      'cinema', 'century cinema', 'netflix', 'spotify', 'movie', 'drinks', 'outing',
      'party', 'football', 'gym', 'games', 'entertainment', 'concert'
    ],
  },
  {
    id: 'other',
    name: 'General / Other',
    color: '#64748b', // Slate
    bgLight: '#f8fafc',
    iconName: 'Tag',
    keywords: ['miscellaneous', 'other', 'general', 'fee', 'service'],
  },
];

/**
 * Suggests the best matching category from transaction note and recipient text.
 * Scores keyword matches based on word boundaries and length.
 */
export function suggestCategory(
  text: string,
  categories: Category[] = DEFAULT_CATEGORIES
): { categoryName: string; confidence: number; matchedKeyword?: string } {
  if (!text || text.trim() === '') {
    return { categoryName: 'General / Other', confidence: 0 };
  }

  const normalized = text.toLowerCase();
  let bestMatch = { categoryName: 'General / Other', score: 0, matchedKeyword: '' };

  for (const cat of categories) {
    for (const kw of cat.keywords) {
      const kwLower = kw.toLowerCase();
      if (normalized.includes(kwLower)) {
        // Give higher score to longer or more specific keyword matches
        const score = kwLower.length + (normalized.startsWith(kwLower) ? 3 : 0);
        if (score > bestMatch.score) {
          bestMatch = {
            categoryName: cat.name,
            score,
            matchedKeyword: kw,
          };
        }
      }
    }
  }

  const confidence = bestMatch.score > 0 ? Math.min(0.95, 0.4 + bestMatch.score * 0.08) : 0;
  return {
    categoryName: bestMatch.categoryName,
    confidence,
    matchedKeyword: bestMatch.matchedKeyword,
  };
}
