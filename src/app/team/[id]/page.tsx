'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Houseguest, Bracket, WeeklyEvent, BlockSurvivor, Season } from '@/lib/types';
import { calculateBracketScore } from '@/lib/scoring';
import type { BracketWithPicks } from '@/lib/types';

export default function TeamDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [bracket, setBracket] = useState<BracketWithPicks | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: bracketData } = await supabase
        .from('brackets')
        .select('*')
        .eq('id', id)
        .single();

      if (!bracketData) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      const b = bracketData as Bracket;

      const { data: seasonData } = await supabase
        .from('seasons')
        .select('*')
        .eq('id', b.season_id)
        .single();

      const season = seasonData as Season;

      const [
        { data: hgData },
        { data: eventsData },
        { data: survivorsData },
      ] = await Promise.all([
        supabase.from('houseguests').select('*').eq('season_id', b.season_id),
        supabase.from('weekly_events').select('*').eq('season_id', b.season_id),
        supabase.from('block_survivors').select('*, weekly_events!inner(season_id)').eq('weekly_events.season_id', b.season_id),
      ]);

      const houseguests = (hgData || []) as Houseguest[];
      const events = (eventsData || []) as WeeklyEvent[];
      const survivors = (survivorsData || []) as BlockSurvivor[];

      const scored = calculateBracketScore(b, houseguests, events, survivors, season.houseguest_count);
      setBracket(scored);
      setLoading(false);
    }
    load();
  }, [id]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center text-slate-400">Loading...</div>
    );
  }

  if (notFound || !bracket) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center">
        <h1 className="text-3xl font-bold text-slate-900 mb-4">Team Not Found</h1>
        <Link href="/leaderboard" className="text-blue-600 hover:text-blue-700">
          Back to Leaderboard
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <Link href="/leaderboard" className="text-slate-500 hover:text-blue-600 text-sm mb-4 block">
        &larr; Back to Leaderboard
      </Link>

      <div className="flex items-baseline justify-between mb-8">
        <h1 className="text-3xl font-bold text-slate-900">{bracket.team_name}</h1>
        <span className="text-3xl font-bold text-blue-600 font-mono">
          {bracket.total_score.toFixed(2)} pts
        </span>
      </div>

      <div className="space-y-4">
        {bracket.picks.map((pick) => (
          <div
            key={pick.position}
            className="bg-white rounded-xl border border-slate-200 shadow-sm p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                {pick.houseguest.photo_url ? (
                  <img
                    src={pick.houseguest.photo_url}
                    alt={pick.houseguest.name}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 text-lg font-bold">
                    {pick.houseguest.name[0]}
                  </div>
                )}
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">{pick.houseguest.name}</h3>
                  <span className="text-sm text-slate-500">
                    Pick #{pick.position} &middot;{' '}
                    <span className="text-blue-600">{pick.multiplier}x multiplier</span>
                  </span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xl font-bold text-blue-600 font-mono">
                  {pick.pick_score.toFixed(2)}
                </div>
                <div className="text-xs text-slate-400">
                  {pick.stats.base_score} base &times; {pick.multiplier}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div className="bg-slate-50 rounded-lg p-3">
                <div className="text-slate-400 text-xs">HOH Wins</div>
                <div className="text-slate-900 font-mono text-lg">{pick.stats.hoh_wins}</div>
                <div className="text-slate-400 text-xs">{pick.stats.hoh_wins * 7} pts</div>
              </div>
              <div className="bg-slate-50 rounded-lg p-3">
                <div className="text-slate-400 text-xs">Veto Wins</div>
                <div className="text-slate-900 font-mono text-lg">{pick.stats.veto_wins}</div>
                <div className="text-slate-400 text-xs">{pick.stats.veto_wins * 5} pts</div>
              </div>
              <div className="bg-slate-50 rounded-lg p-3">
                <div className="text-slate-400 text-xs">Block Survivals</div>
                <div className="text-slate-900 font-mono text-lg">{pick.stats.block_survivals}</div>
                <div className="text-slate-400 text-xs">{pick.stats.block_survivals * 2} pts</div>
              </div>
              <div className="bg-slate-50 rounded-lg p-3">
                <div className="text-slate-400 text-xs">Placement</div>
                <div className="text-slate-900 font-mono text-lg">{pick.stats.placement_points}</div>
                <div className="text-xs">
                  {pick.houseguest.status === 'active' ? (
                    <span className="text-green-600">Active</span>
                  ) : pick.houseguest.status === 'winner' ? (
                    <span className="text-amber-600">Winner</span>
                  ) : pick.houseguest.status === 'runner_up' ? (
                    <span className="text-blue-600">Runner-up</span>
                  ) : (
                    <span className="text-red-600">Evicted</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
