import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  const { password, season_id } = await request.json();

  if (!password || !season_id) {
    return NextResponse.json({ error: 'Missing password or season.' }, { status: 400 });
  }

  const { data: season } = await supabase
    .from('seasons')
    .select('admin_password')
    .eq('id', season_id)
    .single();

  if (!season || season.admin_password !== password) {
    return NextResponse.json({ error: 'Invalid password.' }, { status: 401 });
  }

  return NextResponse.json({ success: true });
}
