
export interface Task {
  id: string;
  text: string;
  completed: boolean;
}

export type StickerStyle = 'lift' | 'polaroid' | 'graphic';

export interface Sticker {
  id: string;
  data: string;
  style: StickerStyle;
}

export interface JournalEntry {
  id: string;
  date: string;
  content: string;
  vibe: string;
  location?: string;
  weather?: string;
  photos: string[];
  stickers: Sticker[];
  sharedWith: string[]; 
  isPrivate: boolean;
}

export interface Goal {
  id: string;
  text: string;
  completed: boolean;
  tasks: Task[];
}

export interface Friend {
  id: string;
  name: string;
  avatar: string;
}
