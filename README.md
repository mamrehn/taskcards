# TaskCards 📚

A Progressive Web App (PWA) for interactive flashcard learning with multiple study modes and a multiplayer quiz feature.

![License](https://img.shields.io/badge/license-Unlicense-blue.svg)
![PWA](https://img.shields.io/badge/PWA-ready-brightgreen.svg)

## Features

### 🎴 Flashcard Learning (Solo Mode)

- **Multiple study modes:**
  - **Spaced Repetition** - Cards are prioritized based on learning intervals
  - **Incorrect First** - Previously wrong answers appear first
  - **Incorrect Only** - Focus exclusively on cards you got wrong
- **Multiple choice & text answers** - Support for both question types
- **Deck management** - Import, save, search, and organize multiple decks
- **Progress tracking** - Track correct/incorrect answers with statistics
- **Explanations** - Optional explanations for answers to aid learning
- **ZIP import** - Bulk import multiple decks from a ZIP file

### 🎮 Multiplayer Quiz (Qlash)

- **Real-time multiplayer** - Host quizzes for multiple players
- **QR code joining** - Players can scan to join instantly
- **Live scoreboard** - See rankings update in real-time
- **Time-based scoring** - Faster correct answers earn more points
- **Question shuffling** - Randomized question and option order

### 🌓 Dark Mode

- **System preference detection** - Automatically matches your OS theme
- **Manual toggle** - Override with a single click
- **Persistent preference** - Your choice is remembered across sessions

### 📱 PWA Support

- **Installable** - Add to home screen on mobile devices
- **Offline capable** - Works without internet connection
- **Fast loading** - Service worker caching for instant startup

## Getting Started

### Running Locally

1. Clone the repository:

   ```bash
   git clone https://github.com/mamrehn/taskcards.git
   cd taskcards
   ```

2. Serve the files with any static web server:

   ```bash
   # Using Python
   python -m http.server 8000

   # Using Node.js
   npx serve .

   # Using PHP
   php -S localhost:8000
   ```

3. Open `http://localhost:8000` in your browser

### Multiplayer Quiz Setup (Qlash)

The multiplayer quiz requires a Supabase backend:

1. Create a free account at [supabase.com](https://supabase.com)
2. Create a new project
3. Copy `qlash-config.template.js` to `qlash-config.js`
4. Add your Supabase URL and anon key
5. Set up the required database tables (see [Database Schema](#database-schema))

## Card Format

Cards are stored in JSON format. Create a `.json` file with the following structure:

### Basic Flashcards (Text Answer)

```json
{
  "cards": [
    {
      "question": "What is the capital of Germany?",
      "answer": "Berlin"
    },
    {
      "question": "What is 2 + 2?",
      "answer": "4",
      "explanation": "Basic addition: 2 + 2 = 4"
    }
  ]
}
```

### Multiple Choice Cards

```json
{
  "cards": [
    {
      "question": "Which are prime numbers?",
      "options": ["2", "4", "7", "9", "11"],
      "correct": [0, 2, 4],
      "explanations": {
        "0": "2 is the only even prime number.",
        "1": "4 = 2×2, so not prime.",
        "2": "7 is only divisible by 1 and 7.",
        "3": "9 = 3×3, so not prime.",
        "4": "11 is only divisible by 1 and 11."
      }
    }
  ]
}
```

### Field Reference

| Field          | Type   | Required | Description                                  |
| -------------- | ------ | -------- | -------------------------------------------- |
| `question`     | string | ✅       | The question text                            |
| `answer`       | string | ✅\*     | The correct answer (for text cards)          |
| `options`      | array  | ✅\*     | Answer options (for multiple choice)         |
| `correct`      | array  | ✅\*     | Indices of correct options (0-based)         |
| `explanation`  | string | ❌       | Explanation shown for text cards             |
| `explanations` | object | ❌       | Per-option explanations (key = option index) |

\*Either `answer` OR (`options` + `correct`) is required.

## Project Structure

```
taskcards/
├── index.html          # Landing page (mode selection)
├── index.js            # Landing page scripts
├── cards.html          # Flashcard learning interface
├── cards.js            # Flashcard app logic
├── cards.css           # Flashcard styles
├── qlash.html          # Multiplayer quiz interface
├── qlash.js            # Quiz app logic (host & player)
├── qlash.css           # Quiz styles
├── theme.css           # Dark/light theme variables
├── theme.js            # Theme switching logic
├── sanitize.js         # Input sanitization utilities
├── sw.js               # Service worker for PWA
├── manifest.json       # PWA manifest
├── datenschutz.html    # Privacy policy (German)
└── qlash/              # Qlash-specific assets
```

## Database Schema

For the multiplayer quiz feature, create these tables in Supabase:

### `rooms` Table

```sql
CREATE TABLE rooms (
  id TEXT PRIMARY KEY,
  current_question_index INTEGER DEFAULT 0,
  quiz_state JSONB,
  host_player_id TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### `players` Table

```sql
CREATE TABLE players (
  id TEXT PRIMARY KEY,
  room_id TEXT REFERENCES rooms(id),
  name TEXT NOT NULL,
  score INTEGER DEFAULT 0,
  is_connected BOOLEAN DEFAULT true,
  last_answer_data JSONB,
  last_answer_time TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## Browser Support

- Chrome/Edge 80+
- Firefox 75+
- Safari 13+
- Mobile browsers (iOS Safari, Chrome for Android)

## Contributing

Contributions are welcome! Some ideas for improvements:

- 🌍 **Internationalization** - Add support for more languages
- ♿ **Accessibility** - Improve screen reader support and keyboard navigation
- 📊 **Analytics** - Add learning statistics and progress charts
- 📤 **Export** - Export decks to other formats (Anki, CSV)
- 🎨 **Themes** - Add more color theme options
- ✅ **Tests** - Add unit tests for core functions

## License

This project is released into the public domain under the [Unlicense](LICENSE). You are free to copy, modify, publish, use, compile, sell, or distribute this software for any purpose.

## Acknowledgments

- [Supabase](https://supabase.com) - Real-time backend for multiplayer features
- [Font Awesome](https://fontawesome.com) - Icons
- [QRCode.js](https://github.com/davidshimjs/qrcodejs) - QR code generation
- [JSZip](https://stuk.github.io/jszip/) - ZIP file handling
