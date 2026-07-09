import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { supabase } from '@/lib/supabase';
import { calculateBracketScore } from '@/lib/scoring';
import { Season, Houseguest, Bracket, WeeklyEvent, BlockSurvivor } from '@/lib/types';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { bracket_id, password, team_name, picks } = body;

  if (
    !bracket_id ||
    !password ||
    !team_name?.trim() ||
    !Array.isArray(picks) ||
    picks.length !== 5 ||
    new Set(picks).size !== 5
  ) {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const { data: bracketData } = await supabase
    .from('brackets')
    .select('*')
    .eq('id', bracket_id)
    .single();

  if (!bracketData) {
    return NextResponse.json({ error: 'Bracket not found.' }, { status: 404 });
  }
  const bracket = bracketData as Bracket & { edit_password: string | null };

  const { data: seasonData } = await supabase
    .from('seasons')
    .select('*')
    .eq('id', bracket.season_id)
    .single();

  if (!seasonData) {
    return NextResponse.json({ error: 'Season not found.' }, { status: 404 });
  }
  const season = seasonData as Season;

  if (season.submissions_locked) {
    return NextResponse.json({ error: 'Rosters are locked — brackets can no longer be edited.' }, { status: 403 });
  }

  // Bracket password, or the season admin password as a master key
  const hash = createHash('sha256').update(password).digest('hex');
  const authorized =
    (bracket.edit_password && hash === bracket.edit_password) || password === season.admin_password;
  if (!authorized) {
    return NextResponse.json({ error: 'Incorrect bracket password.' }, { status: 403 });
  }

  const { data: hgData } = await supabase
    .from('houseguests')
    .select('*')
    .eq('season_id', bracket.season_id);
  const houseguests = (hgData || []) as Houseguest[];
  const activeIds = new Set(houseguests.filter((h) => h.status === 'active').map((h) => h.id));
  if (!picks.every((p: string) => activeIds.has(p))) {
    return NextResponse.json(
      { error: 'All picks must be houseguests who are still in the house.' },
      { status: 400 }
    );
  }

  // Recompute this bracket's stored score with the new picks
  const [{ data: eventsData }, { data: survivorsData }] = await Promise.all([
    supabase.from('weekly_events').select('*').eq('season_id', bracket.season_id),
    supabase.from('block_survivors').select('*, weekly_events!inner(season_id)').eq('weekly_events.season_id', bracket.season_id),
  ]);

  const updatedPicks = {
    pick_1_houseguest_id: picks[0],
    pick_2_houseguest_id: picks[1],
    pick_3_houseguest_id: picks[2],
    pick_4_houseguest_id: picks[3],
    pick_5_houseguest_id: picks[4],
  };

  const scored = calculateBracketScore(
    { ...bracket, ...updatedPicks },
    houseguests,
    (eventsData || []) as WeeklyEvent[],
    (survivorsData || []) as BlockSurvivor[],
    season.houseguest_count
  );

  const { error } = await supabase
    .from('brackets')
    .update({
      team_name: team_name.trim(),
      ...updatedPicks,
      total_score: scored.total_score,
    })
    .eq('id', bracket_id);

  if (error) {
    return NextResponse.json({ error: 'Failed to update bracket.' }, { status: 500 });
  }

  return NextResponse.json({ success: true, id: bracket_id });
}
