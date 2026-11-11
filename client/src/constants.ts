// Fixed option lists. The matching algorithm compares these slugs, so the seed data
// and the backend should use exactly the same values.

export type Option = { value: string; label: string; emoji?: string }

export const CATEGORIES: Option[] = [
  { value: 'technology', label: 'Tech', emoji: '💻' },
  { value: 'sports', label: 'Sports', emoji: '⚽' },
  { value: 'tools', label: 'Tools', emoji: '🔧' },
  { value: 'games', label: 'Games', emoji: '🎲' },
  { value: 'books', label: 'Books', emoji: '📚' },
  { value: 'music', label: 'Music gear', emoji: '🎸' },
  { value: 'clothing', label: 'Clothing', emoji: '👕' },
  { value: 'home', label: 'Home', emoji: '🛋️' },
  { value: 'garden', label: 'Garden', emoji: '🌱' },
  { value: 'kids', label: 'Kids', emoji: '🧸' },
  { value: 'art', label: 'Art', emoji: '🎨' },
  { value: 'collectibles', label: 'Collectibles', emoji: '🏺' },
  { value: 'vehicles', label: 'Vehicles', emoji: '🛵' },
  { value: 'other', label: 'Other', emoji: '📦' },
]

export const CONDITIONS: Option[] = [
  { value: 'new', label: 'New' },
  { value: 'like_new', label: 'Like new' },
  { value: 'good', label: 'Good' },
  { value: 'fair', label: 'Fair' },
  { value: 'for_parts', label: 'For parts' },
]

export const INTERESTS: Option[] = [
  { value: 'cycling', label: 'Cycling' },
  { value: 'electronics', label: 'Electronics' },
  { value: '3d-printing', label: '3D printing' },
  { value: 'woodworking', label: 'Woodworking' },
  { value: 'gaming', label: 'Gaming' },
  { value: 'boardgames', label: 'Board games' },
  { value: 'music', label: 'Music' },
  { value: 'reading', label: 'Reading' },
  { value: 'cooking', label: 'Cooking' },
  { value: 'gardening', label: 'Gardening' },
  { value: 'hiking', label: 'Hiking' },
  { value: 'camping', label: 'Camping' },
  { value: 'photography', label: 'Photography' },
  { value: 'fashion', label: 'Fashion' },
  { value: 'fitness', label: 'Fitness' },
  { value: 'travel', label: 'Travel' },
  { value: 'art', label: 'Art' },
  { value: 'diy', label: 'DIY' },
  { value: 'collecting', label: 'Collecting' },
  { value: 'movies', label: 'Movies' },
  { value: 'fishing', label: 'Fishing' },
  { value: 'pets', label: 'Pets' },
  { value: 'crafts', label: 'Crafts' },
  { value: 'cars', label: 'Cars' },
]

/** Fallback location when the browser doesn't give us GPS: city centre coordinates. */
export const CITIES: { name: string; lat: number; lon: number }[] = [
  { name: 'Tallinn', lat: 59.437, lon: 24.754 },
  { name: 'Tartu', lat: 58.378, lon: 26.729 },
  { name: 'Narva', lat: 59.377, lon: 28.19 },
  { name: 'Pärnu', lat: 58.385, lon: 24.497 },
  { name: 'Kohtla-Järve', lat: 59.398, lon: 27.273 },
  { name: 'Jõhvi', lat: 59.359, lon: 27.413 },
  { name: 'Viljandi', lat: 58.364, lon: 25.59 },
  { name: 'Rakvere', lat: 59.346, lon: 26.355 },
  { name: 'Maardu', lat: 59.476, lon: 25.025 },
  { name: 'Kuressaare', lat: 58.253, lon: 22.485 },
  { name: 'Sillamäe', lat: 59.399, lon: 27.763 },
  { name: 'Valga', lat: 57.777, lon: 26.047 },
  { name: 'Võru', lat: 57.834, lon: 27.019 },
  { name: 'Haapsalu', lat: 58.943, lon: 23.541 },
  { name: 'Keila', lat: 59.304, lon: 24.413 },
  { name: 'Paide', lat: 58.886, lon: 25.557 },
  { name: 'Rapla', lat: 59.007, lon: 24.793 },
  { name: 'Põlva', lat: 58.061, lon: 27.069 },
  { name: 'Jõgeva', lat: 58.746, lon: 26.394 },
  { name: 'Kärdla', lat: 58.998, lon: 22.749 },
]

export const WEIGHT_LABELS: { key: 'category' | 'value' | 'distance' | 'condition' | 'interests'; label: string; hint: string }[] = [
  { key: 'category', label: 'Item category', hint: 'They offer the kind of thing you want' },
  { key: 'value', label: 'Value', hint: 'Their item is in your price range' },
  { key: 'distance', label: 'Distance', hint: 'They live close to you' },
  { key: 'condition', label: 'Condition', hint: 'Their item is in a condition you accept' },
  { key: 'interests', label: 'Shared interests', hint: 'You have hobbies in common' },
]

export function labelFor(options: Option[], value: string): string {
  return options.find((o) => o.value === value)?.label ?? value
}

export function emojiFor(category: string): string {
  return CATEGORIES.find((c) => c.value === category)?.emoji ?? '📦'
}
