import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { supabase } from '@/lib/supabase';
import { Season, Bracket } from '@/lib/types';

// While brackets are hidden, a player can view their own picks by proving
// they know the bracket password (or the season admin password).
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { bracket_id, password } = body;

  if (!bracket_id || !password) {
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

  const hash = createHash('sha256').update(password).digest('hex');
  const authorized =
    (bracket.edit_password && hash === bracket.edit_password) || password === season.admin_password;
  if (!authorized) {
    return NextResponse.json({ error: 'Incorrect bracket password.' }, { status: 403 });
  }

  return NextResponse.json({
    picks: [
      bracket.pick_1_houseguest_id,
      bracket.pick_2_houseguest_id,
      bracket.pick_3_houseguest_id,
      bracket.pick_4_houseguest_id,
      bracket.pick_5_houseguest_id,
    ],
  });
}
