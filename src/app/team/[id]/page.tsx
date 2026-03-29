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
      <div className="max-w-4xl mx-auto px-4 py-12 text-center text-gray-400">Loading...</div>
    );
  }

  if (notFound || !bracket) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center">
        <h1 className="text-3xl font-bold text-white mb-4">Team Not Found</h1>
        <Link href="/leaderboard" className="text-yellow-400 hover:text-yellow-300">
          Back to Leaderboard
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <Link href="/leaderboard" className="text-gray-400 hover:text-white text-sm mb-4 block">
        &larr; Back to Leaderboard
      </Link>

      <div className="flex items-baseline justify-between mb-8">
        <h1 className="text-3xl font-bold text-white">{bracket.team_name}</h1>
        <span className="text-3xl font-bold text-yellow-400 font-mono">
          {bracket.total_score.toFixed(2)} pts
        </span>
      </div>

      <div className="space-y-4">
        {bracket.picks.map((pick) => (
          <div
            key={pick.position}
            className="bg-gray-900 rounded-xl border border-gray-800 p-6"
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
                  <div className="w-12 h-12 rounded-full bg-gray-700 flex items-center justify-center text-gray-400 text-lg font-bold">
                    {pick.houseguest.name[0]}
                  </div>
                )}
                <div>
                  <h3 className="text-lg font-semibold text-white">{pick.houseguest.name}</h3>
                  <span className="text-sm text-gray-400">
                    Pick #{pick.position} &middot;{' '}
                    <span className="text-yellow-400">{pick.multiplier}x multiplier</span>
                  </span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xl font-bold text-yellow-400 font-mono">
                  {pick.pick_score.toFixed(2)}
                </div>
                <div className="text-xs text-gray-500">
                  {pick.stats.base_score} base &times; {pick.multiplier}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div className="bg-gray-800 rounded-lg p-3">
                <div className="text-gray-400 text-xs">HOH Wins</div>
                <div className="text-white font-mono text-lg">{pick.stats.hoh_wins}</div>
                <div className="text-gray-500 text-xs">{pick.stats.hoh_wins * 7} pts</div>
              </div>
              <div className="bg-gray-800 rounded-lg p-3">
                <div className="text-gray-400 text-xs">Veto Wins</div>
                <div className="text-white font-mono text-lg">{pick.stats.veto_wins}</div>
                <div className="text-gray-500 text-xs">{pick.stats.veto_wins * 5} pts</div>
              </div>
              <div className="bg-gray-800 rounded-lg p-3">
                <div className="text-gray-400 text-xs">Block Survivals</div>
                <div className="text-white font-mono text-lg">{pick.stats.block_survivals}</div>
                <div className="text-gray-500 text-xs">{pick.stats.block_survivals * 2} pts</div>
              </div>
              <div className="bg-gray-800 rounded-lg p-3">
                <div className="text-gray-400 text-xs">Placement</div>
                <div className="text-white font-mono text-lg">{pick.stats.placement_points}</div>
                <div className="text-gray-500 text-xs">
                  {pick.houseguest.status === 'active' ? (
                    <span className="text-green-400">Active</span>
                  ) : pick.houseguest.status === 'winner' ? (
                    <span className="text-yellow-400">Winner</span>
                  ) : pick.houseguest.status === 'runner_up' ? (
                    <span className="text-blue-400">Runner-up</span>
                  ) : (
                    <span className="text-red-400">Evicted</span>
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
