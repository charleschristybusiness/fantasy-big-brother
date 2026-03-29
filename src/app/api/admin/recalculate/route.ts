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

  // Only snapshot the latest week's rankings (don't overwrite historical snapshots)
  const weeks = (events || []).map((e: { week_number: number }) => e.week_number);
  const latestWeek = weeks.length > 0 ? Math.max(...weeks) : null;

  if (latestWeek !== null) {
    const { data: rankedBrackets } = await supabase
      .from('brackets')
      .select('id, total_score')
      .eq('season_id', season_id)
      .order('total_score', { ascending: false });

    if (rankedBrackets) {
      const rankings = rankedBrackets.map((b: { id: string; total_score: number }, index: number) => ({
        season_id,
        bracket_id: b.id,
        week_number: latestWeek,
        rank: index + 1,
        total_score: b.total_score,
      }));

      await supabase
        .from('weekly_rankings')
        .upsert(rankings, { onConflict: 'season_id,bracket_id,week_number' });
    }
  }

  return NextResponse.json({ success: true, brackets_updated: updated });
}
