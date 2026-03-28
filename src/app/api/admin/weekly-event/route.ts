import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const {
    season_id,
    week_number,
    hoh_winner_id,
    veto_winner_id,
    evicted_houseguest_id,
    block_survivor_ids,
  } = body;

  if (!season_id || !week_number) {
    return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 });
  }

  // Upsert the weekly event
  const { data: existing } = await supabase
    .from('weekly_events')
    .select('id')
    .eq('season_id', season_id)
    .eq('week_number', week_number)
    .single();

  let eventId: string;

  if (existing) {
    // Update existing
    const { error } = await supabase
      .from('weekly_events')
      .update({
        hoh_winner_id: hoh_winner_id || null,
        veto_winner_id: veto_winner_id || null,
        evicted_houseguest_id: evicted_houseguest_id || null,
      })
      .eq('id', existing.id);

    if (error) {
      return NextResponse.json({ error: 'Failed to update event.' }, { status: 500 });
    }

    eventId = existing.id;

    // Delete old block survivors
    await supabase.from('block_survivors').delete().eq('weekly_event_id', eventId);
  } else {
    const { data: newEvent, error } = await supabase
      .from('weekly_events')
      .insert({
        season_id,
        week_number,
        hoh_winner_id: hoh_winner_id || null,
        veto_winner_id: veto_winner_id || null,
        evicted_houseguest_id: evicted_houseguest_id || null,
      })
      .select()
      .single();

    if (error || !newEvent) {
      return NextResponse.json({ error: 'Failed to create event.' }, { status: 500 });
    }

    eventId = newEvent.id;
  }

  // Insert block survivors
  if (block_survivor_ids && block_survivor_ids.length > 0) {
    const survivors = block_survivor_ids.map((hgId: string) => ({
      weekly_event_id: eventId,
      houseguest_id: hgId,
    }));

    await supabase.from('block_survivors').insert(survivors);
  }

  // Update evicted houseguest status
  if (evicted_houseguest_id) {
    // Count how many have been evicted before this one
    const { count } = await supabase
      .from('houseguests')
      .select('*', { count: 'exact', head: true })
      .eq('season_id', season_id)
      .eq('status', 'evicted');

    const evictionOrder = (count || 0) + 1;

    await supabase
      .from('houseguests')
      .update({ status: 'evicted', eviction_order: evictionOrder })
      .eq('id', evicted_houseguest_id);
  }

  // Recalculate all bracket scores
  await recalculateScores(season_id);

  // Snapshot rankings for this week
  await snapshotRankings(season_id, week_number);

  return NextResponse.json({ success: true });
}

async function snapshotRankings(seasonId: string, weekNumber: number) {
  // Fetch all brackets for this season, sorted by score descending
  const { data: brackets } = await supabase
    .from('brackets')
    .select('id, total_score')
    .eq('season_id', seasonId)
    .order('total_score', { ascending: false });

  if (!brackets || brackets.length === 0) return;

  // Build ranking rows
  const rankings = brackets.map((b, index) => ({
    season_id: seasonId,
    bracket_id: b.id,
    week_number: weekNumber,
    rank: index + 1,
    total_score: b.total_score,
  }));

  // Upsert (uses the unique index on season_id, bracket_id, week_number)
  await supabase
    .from('weekly_rankings')
    .upsert(rankings, { onConflict: 'season_id,bracket_id,week_number' });
}

async function recalculateScores(seasonId: string) {
  const { calculateBracketScore } = await import('@/lib/scoring');

  const [
    { data: season },
    { data: houseguests },
    { data: brackets },
    { data: events },
    { data: survivors },
  ] = await Promise.all([
    supabase.from('seasons').select('*').eq('id', seasonId).single(),
    supabase.from('houseguests').select('*').eq('season_id', seasonId),
    supabase.from('brackets').select('*').eq('season_id', seasonId),
    supabase.from('weekly_events').select('*').eq('season_id', seasonId),
    supabase.from('block_survivors').select('*, weekly_events!inner(season_id)').eq('weekly_events.season_id', seasonId),
  ]);

  if (!season || !houseguests || !brackets) return;

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
  }
}
