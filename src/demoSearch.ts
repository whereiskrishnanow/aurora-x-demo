import type { SearchResult } from './chat'

/**
 * Built-in demo results, used when the AI search can't run (Google's free
 * quota is used up or busy). The whole search is simulated anyway, so the
 * demo keeps working: results are assembled from templates for the kind of
 * request, with a little randomness so repeated searches differ.
 */

interface Kind {
  match: RegExp
  plural: string
  names: string[]
  price: () => string
  details: string[]
  quotes: string[]
  ask: string
}

const pick = <T,>(list: T[], n: number) => [...list].sort(() => Math.random() - 0.5).slice(0, n)
const between = (lo: number, hi: number, step = 50) => Math.round((lo + Math.random() * (hi - lo)) / step) * step
const rupees = (n: number) => `₹${n.toLocaleString('en-IN')}`

const KINDS: Kind[] = [
  {
    match: /pharma|chemist|medic|insulin|tablet|drug/i,
    plural: 'pharmacies',
    names: ['CarePlus Pharmacy', 'MedBox Chemists', 'Sanjeevani Medicals', 'WellCare Pharma', 'Apex Health Store', 'GreenCross Medicals'],
    price: () => rupees(between(600, 1400, 10)),
    details: ['In stock · Ready for pickup now', 'Home delivery in 30 min', 'Open till 11 PM · Prescription needed', 'Cold-chain stored · Delivery in 45 min'],
    quotes: ['Yes, we have it in stock right now, you can pick it up anytime.', 'We have two boxes left, we can deliver within half an hour.', 'It’s available, please bring your prescription along.', 'In stock, and we can send it with our delivery person in 45 minutes.'],
    ask: 'Do you have this in stock right now?',
  },
  {
    match: /flor|rose|flower|bouquet/i,
    plural: 'florists',
    names: ['Petal & Stem', 'Bloom Street', 'The Rose Room', 'Fern & Petal House', 'Lily Lane Florist', 'Garden Glow'],
    price: () => rupees(between(1200, 2600)),
    details: ['Delivers by 4:30 PM · Fresh stock', 'Same-day delivery · Hand-tied bouquet', 'Ready in 1 hour · Free card', 'Delivery by 5 PM · Premium long-stem'],
    quotes: ['We have fresh roses today and can deliver well before 5.', 'Yes, our delivery person can reach you by 4:30.', 'We can make the bouquet in an hour and send it right away.', 'Same-day delivery is no problem, the roses came in this morning.'],
    ask: 'Can you deliver this today, and what would it cost?',
  },
  {
    match: /plumb|leak|tap|pipe/i,
    plural: 'plumbers',
    names: ['QuickFix Plumbing', 'PipeCare Services', 'FlowRight Plumbers', 'HomeServe Plumbing', 'AquaFix Experts', 'LeakAway Services'],
    price: () => `${rupees(between(250, 600))}/visit`,
    details: ['Can come by 5 PM · Visit charge only', 'Arrives within 2 hours', 'Available this evening · Parts extra', 'Free inspection with repair'],
    quotes: ['Our plumber is nearby and can come by 5 today.', 'We can send someone within two hours, visit charge is fixed.', 'Yes, this evening works, parts would be extra if needed.', 'We’ll inspect for free if you go ahead with the repair.'],
    ask: 'Can someone come today, and what’s the visit charge?',
  },
  {
    match: /cake|bak|dessert/i,
    plural: 'bakeries',
    names: ['Sugar Loft Bakery', 'Cocoa Lane', 'The Whisk House', 'Crumb & Co.', 'Butter Bloom', 'Oven Story Cakes'],
    price: () => rupees(between(1400, 3200)),
    details: ['Ready by 6:30 PM · Eggless option', 'Delivered by 7 PM · Custom message', 'Ready in 3 hours · 2 kg', 'Free delivery nearby'],
    quotes: ['We can have it ready by 6:30 this evening.', 'Yes, we’ll deliver by 7 with your message on top.', 'A 2 kg cake works for that, ready in about three hours.', 'We can do it, and delivery is free in your area.'],
    ask: 'Can you have this ready by this evening?',
  },
  {
    match: /\bac\b|air ?con|cooling/i,
    plural: 'AC technicians',
    names: ['CoolBreeze AC Care', 'FrostLine Services', 'ChillPro AC Repair', 'Arctic Air Experts', 'Polar Point AC', 'BreezeFix'],
    price: () => rupees(between(600, 1600)),
    details: ['Visit by 6:30 PM · Gas check included', 'Available this evening', 'Arrives within 3 hours · 30-day warranty', 'Free diagnosis with service'],
    quotes: ['Our technician is close by and can come this evening.', 'We can check it today, the gas check is included.', 'Someone can be there in about three hours.', 'Diagnosis is free if you go ahead with the service.'],
    ask: 'Can a technician come this evening?',
  },
  {
    match: /cater|food for|guests/i,
    plural: 'caterers',
    names: ['Feast & Co. Caterers', 'Spice Route Catering', 'Banana Leaf Kitchens', 'The Party Pot', 'Annapoorna Caterers', 'Tiffin Table'],
    price: () => `${rupees(between(350, 750, 10))}/plate`,
    details: ['Veg & non-veg · Staff included', 'Minimum 30 plates · Free tasting', 'Buffet setup · 2 servers', 'Delivery and setup included'],
    quotes: ['We can do a mixed menu with serving staff for that number.', 'Yes, and we offer a free tasting before you confirm.', 'We’d send two servers and set up the buffet.', 'Delivery and setup are included in the per-plate price.'],
    ask: 'Can you cater this, and what’s the per-plate cost?',
  },
  {
    match: /bhk|rent|flat|apartment|pg\b|room|house|studio/i,
    plural: 'owners and agents',
    names: ['Prestige Lane Homes', 'GreenLeaf Residency', 'Sunrise Apartments', 'Maple Court', 'Palm Grove Residency', 'Lakeview Homes'],
    price: () => `${rupees(between(14000, 42000, 500))}/month`,
    details: ['Semi furnished · Ready to move', 'Covered parking · Gated society', 'Fully furnished · 2 months deposit', 'Near metro · Pets allowed'],
    quotes: ['It’s available from next week, you can visit tomorrow.', 'Yes, the flat is vacant and comes with covered parking.', 'It’s fully furnished, the deposit is two months’ rent.', 'Still available, and pets are fine with the owner.'],
    ask: 'Is it still available, and what’s the rent?',
  },
]

const GENERAL: Kind = {
  match: /./,
  plural: 'local businesses',
  names: ['Metro Services Hub', 'City Quick Help', 'Prime Local Co.', 'TrustPoint Services', 'Swift Assist', 'Neighbourhood Pros'],
  price: () => rupees(between(400, 2500)),
  details: ['Available today · Fixed price', 'Can start within 2 hours', 'Open late · Free quote', 'Same-day service'],
  quotes: ['Yes, we can take that up today.', 'We can start within a couple of hours.', 'We’re open late and can give you a fixed quote.', 'Same-day works, just confirm and we’ll be there.'],
  ask: 'Can you help with this today?',
}

const BADGES = ['Best price', 'Fastest', 'Closest', 'Top rated']

export function demoSearch(brief: string, place: string): SearchResult {
  const kind = KINDS.find((k) => k.match.test(brief)) ?? GENERAL
  const found = between(24, 140, 1)
  const called = between(8, Math.min(30, found - 4), 1)
  const names = pick(kind.names, 4)
  const results = names.map((name, i) => {
    const price = kind.price()
    const quote = kind.quotes[i % kind.quotes.length]
    const minutes = between(1, 3, 1)
    return {
      name,
      rating: Math.round((4.3 + Math.random() * 0.6) * 10) / 10,
      reviews: between(40, 380, 1),
      distance: `${(0.4 + Math.random() * 3).toFixed(1)} km`,
      price,
      detail: kind.details[i % kind.details.length],
      quote,
      badge: BADGES[i],
      duration: `${minutes}:${String(between(5, 55, 1)).padStart(2, '0')}`,
      transcript: [
        { speaker: 'Aurora', text: `Hi, I’m calling for a customer${place ? ` in ${place}` : ''}. ${kind.ask}` },
        { speaker: 'Business', text: quote },
        { speaker: 'Aurora', text: 'Great, and what would the total be?' },
        { speaker: 'Business', text: `It would be ${price}.` },
      ],
    }
  })
  const best = results[0]
  return {
    found,
    called,
    results,
    summary: `I called ${called} ${kind.plural} and ${results.length} can help. ${best.name} looks best at ${best.price}.`,
  }
}
