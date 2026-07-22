export enum PortfolioCategory {
  ALL = 'All',
  COMMERCIAL = 'Commercial',
  EVENTS = 'Events',
  LIFESTYLE = 'Lifestyle',
  CINEMATIC = 'Cinematic',
  EDITORIAL = 'Editorial'
}

export interface Project {
  id: string;
  title: string;
  category: PortfolioCategory;
  image: string;
  videoUrl?: string; // Added for hover preview
  description: string;
  tags: string[];
}

export interface Service {
  id: string;
  title: string;
  price: string;
  description: string;
  features: string[];
  icon: string;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  isThinking?: boolean;
}