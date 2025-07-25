# Wicked Simple Domains - MVP Specifications

## Core MVP Features

### 1. Main Search Interface
- **Single search bar** - center of homepage
- **Auto-detection logic**:
  - **Single word** → Domain Mode (availability check + extensions)
  - **Multiple words** → Suggestion Mode (AI-generated domain suggestions)
- **Real-time search** - results appear as user types (debounced at 150ms for mobile)
- **Clean, minimal UI** - no clutter or distractions
- **Mode transition**: Suggestion Mode completely replaces Domain Mode results

### 2. Domain Mode Functionality (Auto-triggered)
- **Input**: Single word (e.g., "apple")
- **Output**: 
  - Primary domain availability (.com, .net, .org first)
  - Alternative extensions (.io, .co, .ai, etc.) ordered by popularity
  - Simple available/taken status per domain
- **API Integration**: Domainr API for instant availability checking
- **Response time**: Sub-second results

### 3. Suggestion Mode Functionality (Auto-triggered)
- **Input**: Business idea/description (e.g., "sustainable fashion blog")
- **AI Processing**: Groq (Qwen 3) for all suggestions
- **Output**: 5-10 relevant domain suggestions with availability status
- **Smart filtering**: Only show available domains by default
- **Result replacement**: Completely replaces any existing Domain Mode results

### 4. Results Display
- **Simple list format**: Clean, single-line entries
- **Domain name** + **availability status** + **price** + **external link icon**
- **Touch-friendly targets**: 44px minimum height for mobile taps
- **Click to purchase** - direct link to registrar (future affiliate integration)

## Technical Specifications

### Frontend Stack
```javascript
// React.js with TypeScript
// Tailwind CSS for styling
// Real-time updates with useState/useEffect
// Mobile-optimized debounced search (150ms delay)
// Simple loading states
```

### Backend Architecture
```javascript
// Node.js/Express API
// No database (stateless for MVP)
// Memory-based caching for common searches
// Rate limiting: 100 requests per minute per IP
```

### Auto-Detection Logic
```javascript
const detectSearchMode = (input) => {
  const trimmed = input.trim();
  if (trimmed.includes(' ') || trimmed.length > 15) {
    return 'suggestion';
  }
  return 'domain';
};
```

### API Integrations
1. **Domainr API**: RapidAPI free tier with 5-minute caching
2. **Groq**: Qwen 3 model for domain suggestions

### Performance Targets
- **Domain availability**: < 500ms response time
- **AI suggestions**: < 2 seconds (Groq Qwen 3)
- **Page load**: < 1 second first contentful paint
- **Mobile responsive**: Works on all screen sizes

### Mobile Optimizations
- **Touch targets**: 44px minimum for all clickable elements
- **Faster debouncing**: 150ms for responsive feel
- **16px minimum font size**: Prevents iOS zoom
- **Full-width search**: Mobile-friendly input field

## User Experience Flow

### Homepage
1. User lands on clean interface
2. Single prominent search bar
3. Placeholder text: "Enter a word or describe your idea"

### Domain Mode Journey
1. User types "coffee" 
2. Shows simple list:
   - coffee.com ❌ (taken)
   - coffee.net ✅ (available - $12.99) 🔗
   - coffee.io ✅ (available - $34.99) 🔗

### Mode Transition
1. User continues typing "coffee shop"
2. Results completely replaced with AI suggestions:
   - brooklynbrew.com ✅ ($12.99/year) 🔗
   - cupandborough.com ✅ ($12.99/year) 🔗
   - coffeecornerbrooklyn.com ✅ ($12.99/year) 🔗

This MVP focuses on the core concept: **fast, AI-enhanced domain searching with instant availability checking** in a clean, simple interface.