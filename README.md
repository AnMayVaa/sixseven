# SixSeven 🙌

> The ultimate 30-second hand-wave speed challenge. Open both hands, wave as fast as you can, compete on the global leaderboard!

## How to Play
1. Enter your name
2. Allow camera access
3. Position both hands in front of the camera
4. Click **Ready** when hands are detected
5. When GO! appears — wave your open hands up and down as fast as possible!
6. Each up or down motion = **1 rep**
7. Score is saved to the global leaderboard

## Tech Stack
- **Frontend**: React + Vite
- **Hand Detection**: MediaPipe Tasks Vision (in-browser WebAssembly)
- **Database**: Supabase (Postgres + Realtime)
- **Deployment**: Vercel

## Local Development

### 1. Install
```bash
npm install
```

### 2. Set up Supabase
- Open your Supabase project SQL Editor
- Run the contents of `supabase/schema.sql`
- Enable Realtime for the `scores` table in Database → Replication

### 3. Environment
```bash
cp .env.example .env.local
# Fill in your VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
```

### 4. Dev server
```bash
npm run dev
```

## Vercel Deployment
1. Push to GitHub
2. Import at vercel.com/new
3. Add env vars: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
4. Deploy!
