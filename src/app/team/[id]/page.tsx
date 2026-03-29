'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Houseguest, Bracket, WeeklyEvent, BlockSurvivor, Season } from '@/lib/types';
import { calculateBracketScore } from '@/lib/scoring';
import type { BracketWithPicks } from '@/lib/types';

function TeamDetailSkeleton() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="h-4 w-32 animate-pulse bg-gray-800 rounded mb-4" />
      <div className="flex items-baseline justify-between mb-8">
        <div className="h-9 w-48 animate-pulse bg-gray-800 rounded-lg" />
        <div className="h-9 w-32 animate-pulse bg-gray-800 rounded-lg" />
      </div>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="bg-gray-900 rounded-xl border border-gray-800 p-6 mb-4">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-full animate-pulse bg-gray-800" />
            <div className="flex-1">
              <div className="h-5 w-32 animate-pulse bg-gray-800 rounded mb-2" />
              <div className="h-4 w-40 animate-pulse bg-gray-800 rounded" />
            </div>
            <div className="h-7 w-20 animate-pulse bg-gray-800 rounded" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, j) => (
              <div key={j} className="h-20 animate-pulse bg-gray-800 rounded-lg" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

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
    return <TeamDetailSkeleton />;
  }

  if (notFound || !bracket) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center">
        <h1 className="text-3xl font-bold text-white mb-4">Team Not Found</h1>
        <Link href="/leaderboard" className="text-yellow-400 hover:text-yellow-300 transition-colors duration-200">
          Back to Leaderboard
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <Link href="/leaderboard" className="text-gray-400 hover:text-yellow-400 text-sm mb-6 block transition-colors duration-200">
        &larr; Back to Leaderboard
      </Link>

      <div className="flex items-baseline justify-between mb-8">
        <h1 className="text-3xl font-bold text-white">{bracket.team_name}</h1>
        <span className="text-3xl font-bold text-yellow-400 font-mono">
          {bracket.total_score.toFixed(2)} <span className="text-lg text-gray-400">pts</span>
        </span>
      </div>

      <div className="space-y-4">
        {bracket.picks.map((pick, index) => (
          <div
            key={pick.position}
            className={`bg-gray-900 rounded-xl border p-6 transition-all duration-300 hover:border-yellow-500/30 hover:shadow-[0_0_15px_rgba(250,204,21,0.08)] ${
              index === 0 ? 'border-yellow-500/20' : 'border-gray-800'
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                {pick.houseguest.photo_url ? (
                  <img
                    src={pick.houseguest.photo_url}
                    alt={pick.houseguest.name}
                    className="w-12 h-12 rounded-full object-cover ring-2 ring-gray-700"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center text-gray-400 text-lg font-bold ring-2 ring-gray-700">
                    {pick.houseguest.name[0]}
                  </div>
                )}
                <div>
                  <h3 className="text-lg font-semibold text-white">{pick.houseguest.name}</h3>
                  <span className="text-sm text-gray-400">
                    Pick #{pick.position} &middot;{' '}
                    <span className="text-yellow-400 font-mono">{pick.multiplier}x</span>
                  </span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xl font-bold text-yellow-400 font-mono">
                  {pick.pick_score.toFixed(2)}
                </div>
                <div className="text-xs text-gray-500 font-mono">
                  {pick.stats.base_score} &times; {pick.multiplier}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50">
                <div className="text-xs text-gray-400 uppercase tracking-wider">HOH Wins</div>
                <div className="text-white font-mono text-lg font-bold">{pick.stats.hoh_wins}</div>
                <div className="text-gray-500 text-xs font-mono">{pick.stats.hoh_wins * 7} pts</div>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50">
                <div className="text-xs text-gray-400 uppercase tracking-wider">Veto Wins</div>
                <div className="text-white font-mono text-lg font-bold">{pick.stats.veto_wins}</div>
                <div className="text-gray-500 text-xs font-mono">{pick.stats.veto_wins * 5} pts</div>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50">
                <div className="text-xs text-gray-400 uppercase tracking-wider">Block Surv.</div>
                <div className="text-white font-mono text-lg font-bold">{pick.stats.block_survivals}</div>
                <div className="text-gray-500 text-xs font-mono">{pick.stats.block_survivals * 2} pts</div>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50">
                <div className="text-xs text-gray-400 uppercase tracking-wider">Placement</div>
                <div className="text-white font-mono text-lg font-bold">{pick.stats.placement_points}</div>
                <div className="text-xs">
                  {pick.houseguest.status === 'active' ? (
                    <span className="text-green-400 inline-flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                      Active
                    </span>
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
