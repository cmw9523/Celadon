
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { analyzeVibe, getWeatherForLocation, extractSubject, suggestLocations } from './geminiService';
import { JournalEntry, Sticker, StickerStyle, Goal, Task } from './types';

interface User {
  id: string;
  email: string;
  passwordHash: string; 
}

const CeladonPotteryIcon = ({ isAnalyzing }: { isAnalyzing: boolean }) => (
  <div className={`relative cursor-pointer transition-all duration-700 hover:scale-110 active:scale-95 group ${isAnalyzing ? 'animate-pulse' : ''}`}>
    <svg width="100" height="100" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" className="drop-shadow-2xl">
      <defs>
        <linearGradient id="jadeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#B4C6B9" />
          <stop offset="50%" stopColor="#9EB0A1" />
          <stop offset="100%" stopColor="#8A9D8E" />
        </linearGradient>
      </defs>
      <path d="M60 110C85 110 108 92 108 62C108 38 92 20 75 14H45C28 20 12 38 12 62C12 92 35 110 60 110Z" 
            fill="url(#jadeGrad)" stroke="#7A8D7E" strokeWidth="0.8" />
      <path d="M42 14C42 10 48 8 60 8C72 8 78 10 78 14" stroke="#7A8D7E" strokeWidth="2" strokeLinecap="round" />
      <path d="M35 30C28 38 25 48 25 60" stroke="white" strokeWidth="4" strokeLinecap="round" strokeOpacity="0.15" />
      <g stroke="white" strokeWidth="1" strokeOpacity="0.5" fill="none">
        <path d="M85 45Q90 42 95 46Q90 49 87 53" />
        <path d="M25 40Q30 37 35 41Q30 44 27 48" />
        <path d="M55 75Q60 72 65 76Q60 79 57 83" />
        <g strokeOpacity="0.6" strokeWidth="1.2">
          <path d="M75 35L82 28L88 32M82 28C78 28 72 32 68 38" />
          <path d="M35 60L28 53L22 57M28 53C32 53 38 57 42 63" />
        </g>
      </g>
      <path d="M48 110H72" stroke="#8C735E" strokeWidth="2" strokeLinecap="round" />
      {isAnalyzing && <circle cx="60" cy="62" r="45" fill="white" fillOpacity="0.2" className="animate-ping" />}
    </svg>
    <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[8px] uppercase tracking-[0.4em] text-gray-400 whitespace-nowrap opacity-100 font-medium">
      {isAnalyzing ? 'Preserving...' : 'Store'}
    </div>
  </div>
);

const EMOJI_LIBRARY = [
  // Nature & Weather
  "🌸", "🌿", "🎋", "🍃", "🍄", "🐚", "🌵", "🌻", "🍀", "🍁", "🍂", "🌈", "☁️", "🌙", "✨", "☀️", "🌦️", "❄️",
  // Objects & Vibes
  "🕯️", "🍵", "🧘", "🍯", "📜", "🖋️", "🎨", "🎻", "🏛️", "🗝️", "🕊️", "📖", "🔮", "🧿", "🧺", "🎐", "🏮", "💎",
  // Animals
  " Swan", "🦋", "🐈", "🐇", "🧚", "🐝", "🦜", "🦌", "🐘", "🐋", "🐾", "🐞",
  // Food & Travel
  "🍮", "🥐", "🧁", "🍇", "🍊", "🍎", "🥝", "🍱", "🚲", "🏡", "⛰️", "🌊", "⛱️", "🏕️", "🛶", "🚂"
];

const App: React.FC = () => {
  // Session Persistence: Auto-login logic
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('celadon_user');
    if (!saved) return null;
    try {
      const user = JSON.parse(saved);
      const dbUsers: User[] = JSON.parse(localStorage.getItem('celadon_db_users') || '[]');
      return dbUsers.find(u => u.id === user.id) || null;
    } catch {
      return null;
    }
  });

  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');

  // Journal States
  const [currentContent, setCurrentContent] = useState('');
  const [creativityNote, setCreativityNote] = useState(() => localStorage.getItem('celadon_creativity') || '');
  const [photos, setPhotos] = useState<string[]>([]);
  const [activeStickers, setActiveStickers] = useState<Sticker[]>([]);
  const [location, setLocation] = useState('');
  const [locationSuggestions, setLocationSuggestions] = useState<string[]>([]);
  const [weather, setWeather] = useState('✨');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [vibe, setVibe] = useState('Quiet Reflection');
  const [quote, setQuote] = useState('The detail is in the breath.');
  
  // Goals State
  const [goals, setGoals] = useState<Goal[]>(() => {
    const saved = localStorage.getItem('celadon_goals');
    return saved ? JSON.parse(saved) : [
      { id: '1', text: '5382 Kenosha Reno', completed: false, tasks: [{id: 't1', text: 'Window specs', completed: true}, {id: 't2', text: 'Material order', completed: false}] }
    ];
  });

  // Sticker Studio States
  const [isStickerProcessing, setIsStickerProcessing] = useState(false);
  const [selectedStyle, setSelectedStyle] = useState<StickerStyle>('lift');
  const [studioStickers, setStudioStickers] = useState<Sticker[]>(() => {
    const saved = localStorage.getItem('celadon_studio');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [entries, setEntries] = useState<JournalEntry[]>(() => {
    const saved = localStorage.getItem('celadon_entries');
    return saved ? JSON.parse(saved) : [];
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const studioInputRef = useRef<HTMLInputElement>(null);
  const dateStr = useMemo(() => new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }), []);

  // Persist states
  useEffect(() => { localStorage.setItem('celadon_entries', JSON.stringify(entries)); }, [entries]);
  useEffect(() => { localStorage.setItem('celadon_goals', JSON.stringify(goals)); }, [goals]);
  useEffect(() => { localStorage.setItem('celadon_studio', JSON.stringify(studioStickers)); }, [studioStickers]);
  useEffect(() => { localStorage.setItem('celadon_creativity', creativityNote); }, [creativityNote]);
  
  useEffect(() => {
    if (currentUser) localStorage.setItem('celadon_user', JSON.stringify(currentUser));
    else localStorage.removeItem('celadon_user');
  }, [currentUser]);

  // Handle Location Suggestions
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (location.length >= 2) {
        const suggestions = await suggestLocations(location);
        setLocationSuggestions(suggestions);
      } else {
        setLocationSuggestions([]);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [location]);

  const handleAuth = () => {
    setAuthError('');
    const users: User[] = JSON.parse(localStorage.getItem('celadon_db_users') || '[]');
    if (authMode === 'signup') {
      if (users.find(u => u.email === authEmail)) return setAuthError('Email already taken.');
      const newUser = { id: Date.now().toString(), email: authEmail, passwordHash: authPassword };
      localStorage.setItem('celadon_db_users', JSON.stringify([...users, newUser]));
      setCurrentUser(newUser);
    } else {
      const user = users.find(u => u.email === authEmail && u.passwordHash === authPassword);
      if (!user) return setAuthError('Invalid credentials.');
      setCurrentUser(user);
    }
  };

  const addEmojiSticker = (emoji: string) => {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.font = '80px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(emoji, 64, 64);
      const data = canvas.toDataURL();
      setStudioStickers(prev => [{ id: Date.now().toString(), data, style: selectedStyle }, ...prev]);
    }
  };

  const handleSelectLocation = async (loc: string) => {
    setLocation(loc);
    setLocationSuggestions([]);
    const emoji = await getWeatherForLocation(loc);
    setWeather(emoji);
  };

  const handleSave = async () => {
    if (!currentContent.trim() && photos.length === 0) return;
    setIsAnalyzing(true);
    const analysis = await analyzeVibe(currentContent);
    const newEntry: JournalEntry = {
      id: Date.now().toString(),
      date: dateStr,
      content: currentContent,
      vibe: analysis.vibe,
      location, weather,
      photos: [...photos],
      stickers: [...activeStickers],
      sharedWith: [currentUser?.id || ''],
      isPrivate: true
    };
    setEntries(prev => [newEntry, ...prev]);
    setVibe(analysis.vibe);
    setQuote(analysis.quote);
    setCurrentContent('');
    setPhotos([]);
    setActiveStickers([]);
    setLocation('');
    setWeather('✨');
    setIsAnalyzing(false);
  };

  // Helper to calculate goal progress
  const getGoalProgress = (goal: Goal) => {
    if (goal.tasks.length === 0) return goal.completed ? 100 : 0;
    const completedTasks = goal.tasks.filter(t => t.completed).length;
    return Math.round((completedTasks / goal.tasks.length) * 100);
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="max-w-md w-full kinfolk-card p-12 text-center">
          <h1 className="serif text-6xl brand-text mb-8">Celadon</h1>
          <div className="space-y-6 text-center">
            <input type="email" placeholder="Email" value={authEmail} onChange={e => setAuthEmail(e.target.value)} className="auth-input w-full py-2 bg-transparent text-center" />
            <input type="password" placeholder="Password" value={authPassword} onChange={e => setAuthPassword(e.target.value)} className="auth-input w-full py-2 bg-transparent text-center" />
            {authError && <p className="text-red-400 text-[10px] uppercase">{authError}</p>}
            <button onClick={handleAuth} className="w-full py-4 bg-black text-white text-[10px] uppercase tracking-widest hover:bg-gray-800 transition-colors">
              {authMode === 'login' ? 'Enter Sanctuary' : 'Create Artifact'}
            </button>
            <button onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')} className="text-[10px] uppercase text-gray-400 hover:text-black mt-4">
              {authMode === 'login' ? 'New user? Sign up' : 'Already have an account? Login'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-12 md:py-20">
      <header className="mb-20 text-center relative">
        <button onClick={() => setCurrentUser(null)} className="absolute right-0 top-0 text-[10px] uppercase tracking-widest text-gray-300 hover:text-red-500">Logout</button>
        <h1 className="serif text-7xl md:text-[10rem] font-light brand-text tracking-tighter">Celadon</h1>
        <div className="flex justify-center gap-6 text-[10px] uppercase tracking-[0.4em] font-light text-gray-400 mt-4">
          <span>{dateStr}</span>
          <span className="w-1.5 h-1.5 bg-[var(--celadon-brand)] rounded-full self-center"></span>
          <span>{vibe}</span>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        <div className="lg:col-span-8 space-y-12">
          {/* Editor */}
          <div className="kinfolk-card p-8 md:p-12 relative overflow-hidden">
            <div className="flex flex-col md:flex-row justify-between md:items-end gap-6 mb-8">
              <h2 className="serif text-3xl italic">The Daily Journal</h2>
              <div className="relative group min-w-[200px]">
                <div className="flex items-center gap-2 border-b border-gray-100 pb-1 focus-within:border-[var(--celadon-brand)] transition-colors">
                  <input 
                    type="text" 
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Where are you?..."
                    className="serif text-lg italic bg-transparent border-none outline-none w-full"
                  />
                  <span className="text-xl">{weather}</span>
                </div>
                {locationSuggestions.length > 0 && (
                  <div className="absolute top-full left-0 w-full bg-white shadow-2xl rounded-b-xl z-50 border border-gray-50 overflow-hidden mt-1">
                    {locationSuggestions.map((s, idx) => (
                      <button key={idx} onClick={() => handleSelectLocation(s)} className="w-full text-left px-4 py-3 text-[9px] uppercase tracking-widest text-gray-500 hover:bg-[var(--celadon-brand)] hover:text-white transition-colors border-b border-gray-50 last:border-0">{s}</button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <textarea 
              value={currentContent}
              onChange={e => setCurrentContent(e.target.value)}
              className="w-full min-h-[300px] bg-transparent border-none focus:ring-0 serif text-2xl md:text-4xl placeholder-gray-100 resize-none outline-none leading-relaxed"
              placeholder="What occupies your mind?"
            />

            {(photos.length > 0 || activeStickers.length > 0) && (
              <div className="flex flex-wrap gap-8 mt-12 items-end min-h-[100px]">
                {photos.map((p, i) => ( <img key={i} src={p} className="w-24 h-24 object-cover rounded-sm grayscale shadow-sm" /> ))}
                {activeStickers.map((s) => (
                  <div key={s.id} className={`sticker-base style-${s.style} w-24 h-24`}><img src={s.data} className="w-full h-full object-cover" /></div>
                ))}
              </div>
            )}

            <div className="flex justify-between items-center mt-12 pt-8 border-t border-gray-50">
              <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 text-gray-300 hover:text-black transition-colors group">
                <i className="fa-solid fa-camera text-xl"></i>
                <span className="text-[9px] uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">Add Photo</span>
              </button>
              <input type="file" ref={fileInputRef} className="hidden" onChange={e => {
                const file = e.target.files?.[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onload = (ev) => setPhotos(prev => [...prev, ev.target?.result as string]);
                  reader.readAsDataURL(file);
                }
              }} />
              <div onClick={handleSave}><CeladonPotteryIcon isAnalyzing={isAnalyzing} /></div>
            </div>
          </div>

          {/* Creativity Lab */}
          <div className="kinfolk-card p-10 !bg-[var(--celadon-brand)] shadow-2xl">
            <h3 className="serif text-2xl mb-6 flex items-center gap-3 text-white">
              <i className="fa-solid fa-flask-vial text-sm"></i>
              Creativity Lab
            </h3>
            <textarea 
              value={creativityNote}
              onChange={e => setCreativityNote(e.target.value)}
              className="w-full h-48 bg-transparent border-none focus:ring-0 sans text-sm text-white placeholder-white/40 resize-none leading-loose outline-none"
              placeholder="Deep dives, project sketches, curiosity spikes..."
            />
            <div className="mt-4 flex justify-end">
               <span className="text-[9px] uppercase tracking-widest text-white/60 italic font-medium">Sacred Space</span>
            </div>
          </div>

          {/* Feed */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {entries.filter(e => e.sharedWith.includes(currentUser.id)).map(entry => (
              <div key={entry.id} className="kinfolk-card p-8 relative group">
                <div className="flex justify-between text-[9px] uppercase tracking-widest text-gray-400 mb-4">
                  <span>{entry.date} {entry.weather}</span>
                  <button onClick={() => {
                    const text = `📬 A Postcard from my Celadon Journal: "${entry.content.substring(0, 100)}..."`;
                    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
                  }} className="opacity-0 group-hover:opacity-100 transition-opacity text-[var(--celadon-brand)] hover:text-green-700 font-bold">
                    <i className="fa-brands fa-whatsapp mr-1"></i> Postcard
                  </button>
                </div>
                <p className="serif text-xl leading-relaxed text-gray-700 line-clamp-5">"{entry.content}"</p>
                <div className="mt-6 pt-4 border-t border-gray-50">
                   <span className="text-[10px] text-gray-300 italic">{entry.location || 'Soul realm'} • {entry.vibe}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-4 space-y-12">
          {/* Manifestation with Progress Bars */}
          <div className="kinfolk-card p-8">
            <h3 className="serif text-2xl mb-6 font-light">Manifestation</h3>
            <div className="space-y-10">
              {goals.map(goal => {
                const progress = getGoalProgress(goal);
                return (
                  <div key={goal.id} className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <input 
                          type="checkbox" 
                          checked={goal.completed || progress === 100} 
                          onChange={() => setGoals(prev => prev.map(g => g.id === goal.id ? {...g, completed: !g.completed} : g))} 
                          className="w-4 h-4 accent-[var(--celadon-brand)] cursor-pointer" 
                        />
                        <span className={`sans text-[11px] uppercase tracking-widest font-bold ${goal.completed || progress === 100 ? 'text-gray-200' : 'text-black'}`}>
                          {goal.text}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-gray-400">{progress}%</span>
                    </div>

                    {/* Progress Bar Chart Component */}
                    <div className="w-full bg-gray-50 h-1 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-[var(--celadon-brand)] transition-all duration-700 ease-out"
                        style={{ width: `${progress}%` }}
                      ></div>
                    </div>

                    <div className="pl-7 space-y-2.5 border-l-2 border-gray-50 ml-2 mt-2">
                      {goal.tasks.map(task => (
                        <div key={task.id} className="flex items-center justify-between text-[10px] text-gray-400 group/task">
                          <div className="flex items-center gap-2 cursor-pointer" onClick={() => {
                             setGoals(prev => prev.map(g => g.id === goal.id ? { 
                               ...g, tasks: g.tasks.map(t => t.id === task.id ? {...t, completed: !t.completed} : t) 
                             } : g));
                          }}>
                            <i className={`fa-solid transition-colors ${task.completed ? 'fa-check-circle text-[var(--celadon-brand)]' : 'fa-circle-notch text-gray-100 group-hover/task:text-gray-300'}`}></i>
                            <span className={`transition-all ${task.completed ? 'line-through text-gray-200 opacity-60' : 'group-hover/task:text-gray-700'}`}>
                              {task.text}
                            </span>
                          </div>
                          <button 
                            onClick={() => setGoals(prev => prev.map(g => g.id === goal.id ? { ...g, tasks: g.tasks.filter(t => t.id !== task.id) } : g))}
                            className="text-[7px] uppercase opacity-0 group-hover/task:opacity-100 hover:text-red-400 transition-opacity"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                      <div className="flex items-center gap-2 mt-3 pt-1 border-t border-gray-50/50">
                        <i className="fa-solid fa-plus text-[8px] text-gray-200"></i>
                        <input 
                          onKeyDown={e => { 
                            if(e.key === 'Enter') { 
                              const v = (e.target as HTMLInputElement).value; 
                              if(!v) return;
                              setGoals(prev => prev.map(g => g.id === goal.id ? {...g, tasks: [...g.tasks, {id: Date.now().toString(), text: v, completed: false}]} : g)); 
                              (e.target as HTMLInputElement).value = ''; 
                            } 
                          }} 
                          placeholder="Add detail..." 
                          className="text-[10px] bg-transparent outline-none italic placeholder-gray-200 w-full text-gray-600" 
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <button onClick={() => { 
              const t = prompt("What is your manifestation?"); 
              if(t) setGoals(prev => [...prev, {id: Date.now().toString(), text: t, completed: false, tasks: []}]); 
            }} className="w-full mt-12 py-3 border border-dashed text-[10px] uppercase text-gray-300 hover:text-black hover:border-gray-900 transition-all font-medium tracking-widest">+ New Manifestation</button>
          </div>

          {/* Sticker Studio with Extensive Emoji Library */}
          <div className="kinfolk-card p-8 border-2 border-dashed border-gray-100">
             <h3 className="serif text-2xl font-light mb-6">Sticker Studio</h3>
             
             {/* Extensive Emoji Picker */}
             <div className="mb-6">
                <p className="text-[8px] uppercase tracking-widest text-gray-300 mb-3 font-semibold">Artifacts Library</p>
                <div className="grid grid-cols-6 gap-2 h-40 overflow-y-auto custom-scroll pr-2 bg-gray-50/50 p-2 rounded-lg">
                  {EMOJI_LIBRARY.map(emoji => (
                    <button key={emoji} onClick={() => addEmojiSticker(emoji)} className="text-xl hover:scale-125 transition-transform flex items-center justify-center h-8 w-8">{emoji}</button>
                  ))}
                </div>
             </div>

             <div className="flex gap-2 mb-6 p-1 bg-gray-50 rounded-lg">
                {(['lift', 'polaroid', 'graphic'] as StickerStyle[]).map(style => (
                  <button key={style} onClick={() => setSelectedStyle(style)} className={`flex-1 py-1.5 text-[8px] uppercase tracking-widest rounded-md transition-all ${selectedStyle === style ? 'bg-white shadow-sm text-black font-bold' : 'text-gray-400 hover:text-gray-600'}`}>{style}</button>
                ))}
             </div>
             
             <button onClick={() => studioInputRef.current?.click()} className="w-full py-3 bg-gray-900 text-white text-[9px] uppercase tracking-[0.3em] hover:bg-black shadow-md transition-shadow">Upload Image</button>
             <input type="file" ref={studioInputRef} className="hidden" onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onload = (ev) => {
                    setStudioStickers(prev => [{ id: Date.now().toString(), data: ev.target?.result as string, style: selectedStyle }, ...prev]);
                  };
                  reader.readAsDataURL(file);
                }
             }} />
             
             <div className="grid grid-cols-2 gap-4 h-48 overflow-y-auto custom-scroll mt-6 pt-4 border-t border-gray-50">
               {studioStickers.map(s => (
                 <div key={s.id} className="relative group flex justify-center">
                   <div onClick={() => setActiveStickers(prev => [...prev, s])} className={`sticker-base style-${s.style} w-16 h-16`}><img src={s.data} className="w-full h-full object-cover" /></div>
                   <button onClick={() => setStudioStickers(prev => prev.filter(st => st.id !== s.id))} className="absolute -top-1 -right-1 w-5 h-5 bg-white text-black text-[10px] rounded-full opacity-0 group-hover:opacity-100 shadow-md flex items-center justify-center border border-gray-100"><i className="fa-solid fa-times"></i></button>
                 </div>
               ))}
             </div>
          </div>

          <div className="p-10 bg-white border-l-4 border-[var(--celadon-brand)] text-center shadow-sm">
            <i className="fa-solid fa-quote-left text-[var(--celadon-brand)] opacity-20 text-3xl mb-4"></i>
            <p className="serif text-xl italic text-gray-800 leading-relaxed">"{quote}"</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
