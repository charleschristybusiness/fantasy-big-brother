-- Fantasy Big Brother Database Schema
-- Run this in your Supabase SQL editor

-- Seasons table
CREATE TABLE seasons (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  houseguest_count INTEGER DEFAULT 16,
  submissions_locked BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed')),
  admin_password TEXT NOT NULL DEFAULT 'admin123',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Houseguests table
CREATE TABLE houseguests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  season_id UUID REFERENCES seasons(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  photo_url TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'evicted', 'winner', 'runner_up')),
  eviction_order INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Brackets (teams) table
CREATE TABLE brackets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  season_id UUID REFERENCES seasons(id) ON DELETE CASCADE,
  team_name TEXT NOT NULL,
  pick_1_houseguest_id UUID REFERENCES houseguests(id),
  pick_2_houseguest_id UUID REFERENCES houseguests(id),
  pick_3_houseguest_id UUID REFERENCES houseguests(id),
  pick_4_houseguest_id UUID REFERENCES houseguests(id),
  pick_5_houseguest_id UUID REFERENCES houseguests(id),
  total_score NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Weekly events table
CREATE TABLE weekly_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  season_id UUID REFERENCES seasons(id) ON DELETE CASCADE,
  week_number INTEGER NOT NULL,
  hoh_winner_id UUID REFERENCES houseguests(id),
  veto_winner_id UUID REFERENCES houseguests(id),
  evicted_houseguest_id UUID REFERENCES houseguests(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(season_id, week_number)
);

-- Block survivors (multiple per week)
CREATE TABLE block_survivors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  weekly_event_id UUID REFERENCES weekly_events(id) ON DELETE CASCADE,
  houseguest_id UUID REFERENCES houseguests(id)
);

-- Indexes for performance
CREATE INDEX idx_houseguests_season ON houseguests(season_id);
CREATE INDEX idx_brackets_season ON brackets(season_id);
CREATE INDEX idx_weekly_events_season ON weekly_events(season_id);
CREATE INDEX idx_block_survivors_event ON block_survivors(weekly_event_id);

-- Enable Row Level Security (allow all for now since no user auth)
ALTER TABLE seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE houseguests ENABLE ROW LEVEL SECURITY;
ALTER TABLE brackets ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE block_survivors ENABLE ROW LEVEL SECURITY;

-- Policies: allow all operations (no user auth in v1)
CREATE POLICY "Allow all on seasons" ON seasons FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on houseguests" ON houseguests FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on brackets" ON brackets FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on weekly_events" ON weekly_events FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on block_survivors" ON block_survivors FOR ALL USING (true) WITH CHECK (true);
