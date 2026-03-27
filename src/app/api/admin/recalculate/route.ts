import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { calculateBracketScore } from '@/lib/scoring';

export async function POST(request: NextRequest) {
  const { season_id } = await request.json();

  if (!season_id) {
    return NextResponse.json({ error: 'Missing season_id.' }, { status: 400 });
  }

  const [
    { data: season },
    { data: houseguests },
    { data: brackets },
    { data: events },
    { data: survivors },
  ] = await Promise.all([
    supabase.from('seasons').select('*').eq('id', season_id).single(),
    supabase.from('houseguests').select('*').eq('season_id', season_id),
    supabase.from('brackets').select('*').eq('season_id', season_id),
    supabase.from('weekly_events').select('*').eq('season_id', season_id),
    supabase.from('block_survivors').select('*, weekly_events!inner(season_id)').eq('weekly_events.season_id', season_id),
  ]);

  if (!season || !houseguests || !brackets) {
    return NextResponse.json({ error: 'Season data not found.' }, { status: 404 });
  }

  let updated = 0;
  for (const bracket of brackets) {
    const scored = calculateBracketScore(
      bracket,
      houseguests,
      events || [],
      survivors || [],
      season.houseguest_count
    );

    await supabase
      .from('brackets')
      .update({ total_score: scored.total_score })
      .eq('id', bracket.id);
    updated++;
  }

  return NextResponse.json({ success: true, brackets_updated: updated });
}
