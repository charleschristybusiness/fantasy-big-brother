import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { season_id, team_name, picks, password } = body;

  if (!season_id || !team_name || !picks || picks.length !== 5) {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  if (new Set(picks).size !== 5) {
    return NextResponse.json({ error: 'Each pick must be a different houseguest.' }, { status: 400 });
  }

  if (!password || typeof password !== 'string' || password.length < 4) {
    return NextResponse.json(
      { error: 'Please set a bracket password of at least 4 characters.' },
      { status: 400 }
    );
  }

  // Check if season exists and submissions are open
  const { data: season } = await supabase
    .from('seasons')
    .select('*')
    .eq('id', season_id)
    .single();

  if (!season) {
    return NextResponse.json({ error: 'Season not found.' }, { status: 404 });
  }

  if (season.submissions_locked) {
    return NextResponse.json({ error: 'Submissions are locked.' }, { status: 403 });
  }

  // Handle duplicate team names
  let finalName = team_name.trim();
  const { data: existing } = await supabase
    .from('brackets')
    .select('team_name')
    .eq('season_id', season_id)
    .ilike('team_name', `${finalName}%`);

  if (existing && existing.length > 0) {
    const exactMatch = existing.some(
      (b: { team_name: string }) => b.team_name.toLowerCase() === finalName.toLowerCase()
    );
    if (exactMatch) {
      // Find next available number
      let num = 2;
      while (
        existing.some(
          (b: { team_name: string }) => b.team_name.toLowerCase() === `${finalName}-${num}`.toLowerCase()
        )
      ) {
        num++;
      }
      finalName = `${finalName}-${num}`;
    }
  }

  const { data: bracket, error } = await supabase
    .from('brackets')
    .insert({
      season_id,
      team_name: finalName,
      pick_1_houseguest_id: picks[0],
      pick_2_houseguest_id: picks[1],
      pick_3_houseguest_id: picks[2],
      pick_4_houseguest_id: picks[3],
      pick_5_houseguest_id: picks[4],
      total_score: 0,
      edit_password: createHash('sha256').update(password).digest('hex'),
    })
    .select('id, team_name')
    .single();

  if (error) {
    return NextResponse.json({ error: 'Failed to create bracket.' }, { status: 500 });
  }

  return NextResponse.json(bracket);
}
