import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  const { season_id, week_number } = await request.json();

  if (!season_id || !week_number) {
    return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 });
  }

  // Find the weekly event
  const { data: event } = await supabase
    .from('weekly_events')
    .select('id, evicted_houseguest_id')
    .eq('season_id', season_id)
    .eq('week_number', week_number)
    .single();

  if (!event) {
    return NextResponse.json({ error: 'No event found for this week.' }, { status: 404 });
  }

  // Delete block survivors for this event
  await supabase.from('block_survivors').delete().eq('weekly_event_id', event.id);

  // Delete the weekly event
  await supabase.from('weekly_events').delete().eq('id', event.id);

  // Delete ranking snapshot for this week
  await supabase
    .from('weekly_rankings')
    .delete()
    .eq('season_id', season_id)
    .eq('week_number', week_number);

  // Rebuild all houseguest statuses from the remaining weekly events
  // First, reset ALL houseguests to active
  await supabase
    .from('houseguests')
    .update({ status: 'active', eviction_order: null })
    .eq('season_id', season_id);

  // Then re-apply evictions from remaining weeks in order
  const { data: remainingEvents } = await supabase
    .from('weekly_events')
    .select('evicted_houseguest_id')
    .eq('season_id', season_id)
    .not('evicted_houseguest_id', 'is', null)
    .order('week_number', { ascending: true });

  if (remainingEvents) {
    for (let i = 0; i < remainingEvents.length; i++) {
      await supabase
        .from('houseguests')
        .update({ status: 'evicted', eviction_order: i + 1 })
        .eq('id', remainingEvents[i].evicted_houseguest_id);
    }
  }

  // Recalculate all scores since eviction statuses changed
  const { calculateBracketScore } = await import('@/lib/scoring');

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

  if (season && houseguests && brackets) {
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

  return NextResponse.json({ success: true });
}
