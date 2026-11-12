export interface Question {
  key: string
  text: string
  options: string[]
}

export interface SearchResult {
  found: number
  called: number
  summary: string
  results: {
    name: string
    rating: number
    reviews: number
    distance: string
    price: string
    detail: string
    quote: string
    badge: string
  }[]
}

export interface Listing {
  title: string
  area: string
  rent: string
  meta: string
  art: string
}

export type Message =
  | { id: number; kind: 'user'; text: string }
  | { id: number; kind: 'assistant'; text: string }
  | { id: number; kind: 'question'; question: Question; answer?: string }
  | { id: number; kind: 'listings'; listings: Listing[] }
  | { id: number; kind: 'search'; brief: string; result?: SearchResult; failed?: string }

export const QUESTIONS: Question[] = [
  {
    key: 'rent',
    text: 'What monthly rent range works for you?',
    options: ['Less than ₹15K', '₹15K - ₹20K', '₹20K - ₹25K', '₹25K - ₹30K', '₹30K and above'],
  },
  {
    key: 'furnishing',
    text: 'What furnishing level do you prefer?',
    options: ['Unfurnished', 'Semi Furnished', 'Fully furnished', 'Any on the above'],
  },
  {
    key: 'movein',
    text: 'When are you planning to move in?',
    options: ['Immediately', 'Within 15 days', 'Within a month', 'Just exploring'],
  },
  {
    key: 'tenant',
    text: 'Who will be staying?',
    options: ['Family', 'Working professionals', 'Students'],
  },
]

export const LISTINGS: Listing[] = [
  {
    title: 'Sunlit penthouse with private terrace',
    area: 'HSR Layout, Sector 2',
    rent: '₹18,500',
    meta: '1 BHK · 620 sqft · 4th floor',
    art: 'linear-gradient(135deg, #ffb36b 0%, #ff6f91 55%, #845ec2 100%)',
  },
  {
    title: 'Garden-facing penthouse near 27th Main',
    area: 'HSR Layout, Sector 1',
    rent: '₹19,000',
    meta: '1 BHK · 580 sqft · 3rd floor',
    art: 'linear-gradient(135deg, #2bd2a4 0%, #1e9bd7 60%, #3a57c9 100%)',
  },
  {
    title: 'Corner penthouse with skyline view',
    area: 'HSR Layout, Sector 6',
    rent: '₹16,800',
    meta: '1 BHK · 540 sqft · 5th floor',
    art: 'linear-gradient(135deg, #ffe06b 0%, #ff9a3d 50%, #e8475f 100%)',
  },
]

export const RECENT_SEARCHES = [
  { title: '2bhk house for rent', place: 'Indiranagar' },
  { title: '1bhk near metro', place: 'Koramangala' },
  { title: 'Pet friendly villa', place: 'Whitefield' },
  { title: 'Studio under ₹15K', place: 'BTM Layout' },
  { title: '3bhk for family', place: 'Jayanagar' },
]

let counter = 0
export const nextId = () => ++counter

/** The conversation exactly as it stands in the reference screen. */
export function seedConversation(): Message[] {
  return [
    { id: nextId(), kind: 'user', text: 'adopt a more sustainable lifestyle' },
    {
      id: nextId(),
      kind: 'assistant',
      text: 'Got it — I’ll look for a 1BHK penthouse to rent in HSR Layout. A few details will help me find suitable listings; typical rents are around ₹25,000–\u2060₹50,000/\u200Bmonth.',
    },
    { id: nextId(), kind: 'question', question: QUESTIONS[0], answer: '₹15K - ₹20K' },
    { id: nextId(), kind: 'user', text: '₹15K - ₹20K' },
    { id: nextId(), kind: 'question', question: QUESTIONS[1] },
  ]
}

export function nextQuestion(messages: Message[]): Question | undefined {
  const asked = new Set(messages.flatMap((m) => (m.kind === 'question' ? [m.question.key] : [])))
  return QUESTIONS.find((q) => !asked.has(q.key))
}

export function answerFor(messages: Message[], key: string): string | undefined {
  for (const m of messages) if (m.kind === 'question' && m.question.key === key) return m.answer
  return undefined
}
