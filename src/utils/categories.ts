import { 
  Coffee, 
  Home, 
  ShoppingBag, 
  Car, 
  Zap, 
  Film, 
  Heart, 
  Briefcase, 
  TrendingUp, 
  Landmark,
  HelpCircle
} from 'lucide-react';

export const PREDEFINED_CATEGORIES = [
  { name: 'Food', iconName: 'Coffee', color: 'text-amber-400 bg-amber-400/10' },
  { name: 'Rent', iconName: 'Home', color: 'text-blue-400 bg-blue-400/10' },
  { name: 'Tax', iconName: 'Landmark', color: 'text-amber-400 bg-amber-400/10' },
  { name: 'Shopping', iconName: 'ShoppingBag', color: 'text-pink-400 bg-pink-400/10' },
  { name: 'Transport', iconName: 'Car', color: 'text-teal-400 bg-teal-400/10' },
  { name: 'Utilities', iconName: 'Zap', color: 'text-yellow-400 bg-yellow-400/10' },
  { name: 'Entertainment', iconName: 'Film', color: 'text-red-400 bg-red-400/10' },
  { name: 'Medical', iconName: 'Heart', color: 'text-rose-400 bg-rose-400/10' },
  { name: 'Salary', iconName: 'Briefcase', color: 'text-emerald-400 bg-emerald-400/10' },
  { name: 'Investments', iconName: 'TrendingUp', color: 'text-violet-400 bg-violet-400/10' },
  { name: 'Others', iconName: 'HelpCircle', color: 'text-zinc-400 bg-zinc-400/10' }
] as const;

const iconCache = new Map<string, any>();

export const getCategoryIcon = (category: string) => {
  const c = (category || '').trim().toLowerCase();
  if (iconCache.has(c)) return iconCache.get(c);

  let icon = HelpCircle;
  if (c.includes('food') || c.includes('eat') || c.includes('dining') || c.includes('coffee')) icon = Coffee;
  else if (c.includes('tax') || c.includes('fbr') || c.includes('duty') || c.includes('levy')) icon = Landmark;
  else if (c.includes('rent') || c.includes('home') || c.includes('house')) icon = Home;
  else if (c.includes('shop') || c.includes('cloth') || c.includes('apparel') || c.includes('grocery')) icon = ShoppingBag;
  else if (c.includes('transport') || c.includes('car') || c.includes('fuel') || c.includes('travel') || c.includes('bike')) icon = Car;
  else if (c.includes('util') || c.includes('bill') || c.includes('electricity') || c.includes('water') || c.includes('gas') || c.includes('wifi') || c.includes('internet')) icon = Zap;
  else if (c.includes('entertain') || c.includes('movie') || c.includes('film') || c.includes('game') || c.includes('show')) icon = Film;
  else if (c.includes('medic') || c.includes('health') || c.includes('doctor') || c.includes('hospital') || c.includes('pharmacy')) icon = Heart;
  else if (c.includes('salary') || c.includes('income') || c.includes('work') || c.includes('wage')) icon = Briefcase;
  else if (c.includes('invest') || c.includes('stock') || c.includes('crypto')) icon = TrendingUp;

  iconCache.set(c, icon);
  return icon;
};
