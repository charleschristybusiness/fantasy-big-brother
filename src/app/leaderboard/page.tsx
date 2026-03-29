'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Season, Houseguest, Bracket, WeeklyEvent, BlockSurvivor, WeeklyRanking } from '@/lib/types';
import { calculateBracketScore } from '@/lib/scoring';

function LeaderboardSkeleton() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <div className="h-9 w-48 animate-pulse bg-gray-800 rounded-lg mb-2" />
      <div className="h-5 w-32 animate-pulse bg-gray-800 rounded mb-6" />
      <div className="h-12 w-full animate-pulse bg-gray-800 rounded-lg mb-8" />
      {/* Podium skeleton */}
      <div className="grid grid-cols-3 items-end gap-4 mb-10">
        <div className="pt-8">
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 h-40 animate-pulse" />
        </div>
        <div>
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 h-48 animate-pulse" />
        </div>
        <div className="pt-12">
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 h-36 animate-pulse" />
        </div>
      </div>
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-4 border-b border-gray-800/50">
            <div className="h-5 w-10 animate-pulse bg-gray-800 rounded" />
            <div className="h-5 w-10 animate-pulse bg-gray-800 rounded" />
            <div className="h-5 flex-1 animate-pulse bg-gray-800 rounded" />
            <div className="h-5 w-20 animate-pulse bg-gray-800 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

function RankChangeDisplay({ change }: { change: number | null | undefined }) {
  if (change === undefined || change === null) {
    return <span className="text-gray-600">&mdash;</span>;
  }
  if (change > 0) {
    return <span className="text-green-400 font-bold">&uarr;{change}</span>;
  }
  if (change < 0) {
    return <span className="text-red-400 font-bold">&darr;{change}</span>;
  }
  return <span className="text-gray-600">&mdash;</span>;
}

export default function LeaderboardPage() {
  const [season, setSeason] = useState<Season | null>(null);
  const [brackets, setBrackets] = useState<ReturnType<typeof calculateBracketScore>[]>([]);
  const [rankChanges, setRankChanges] = useState<Map<string, number | null>>(new Map());
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: seasonData } = await supabase
        .from('seasons')
        .select('*')
        .eq('status', 'active')
        .limit(1)
        .single();

      if (!seasonData) {
        setLoading(false);
        return;
      }

      const s = seasonData as Season;
      setSeason(s);

      const [
        { data: hgData },
        { data: bracketData },
        { data: eventsData },
        { data: survivorsData },
        { data: rankingsData },
      ] = await Promise.all([
        supabase.from('houseguests').select('*').eq('season_id', s.id),
        supabase.from('brackets').select('*').eq('season_id', s.id),
        supabase.from('weekly_events').select('*').eq('season_id', s.id),
        supabase.from('block_survivors').select('*, weekly_events!inner(season_id)').eq('weekly_events.season_id', s.id),
        supabase.from('weekly_rankings').select('*').eq('season_id', s.id).order('week_number', { ascending: true }),
      ]);

      const houseguests = (hgData || []) as Houseguest[];
      const rawBrackets = (bracketData || []) as Bracket[];
      const events = (eventsData || []) as WeeklyEvent[];
      const survivors = (survivorsData || []) as BlockSurvivor[];
      const allRankings = (rankingsData || []) as WeeklyRanking[];

      const scored = rawBrackets
        .map((b) => calculateBracketScore(b, houseguests, events, survivors, s.houseguest_count))
        .sort((a, b) => b.total_score - a.total_score);

      const changes = new Map<string, number | null>();
      if (allRankings.length > 0) {
        const weeks = [...new Set(allRankings.map((r) => r.week_number))].sort((a, b) => a - b);

        if (weeks.length >= 2) {
          const prevWeek = weeks[weeks.length - 2];
          const prevRankMap = new Map<string, number>();
          for (const r of allRankings) {
            if (r.week_number === prevWeek) {
              prevRankMap.set(r.bracket_id, r.rank);
            }
          }

          scored.forEach((bracket, index) => {
            const currentRank = index + 1;
            const prevRank = prevRankMap.get(bracket.id);
            if (prevRank !== undefined) {
              changes.set(bracket.id, prevRank - currentRank);
            } else {
              changes.set(bracket.id, null);
            }
          });
        }
      }
      setRankChanges(changes);

      setBrackets(scored);
      setLoading(false);
    }
    load();
  }, []);

  const filtered = search
    ? brackets.filter((b) => b.team_name.toLowerCase().includes(search.toLowerCase()))
    : brackets;

  const showPodium = !search && brackets.length >= 3;
  const tableData = showPodium ? filtered.slice(3) : filtered;

  if (loading) {
    return <LeaderboardSkeleton />;
  }

  if (!season) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-12 text-center">
        <h1 className="text-3xl font-bold text-white mb-4">No Active Season</h1>
        <p className="text-gray-400">There is no active season right now.</p>
      </div>
    );
  }

  // Top 3 for podium
  const first = brackets[0];
  const second = brackets[1];
  const third = brackets[2];

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-yellow-400 mb-1">Leaderboard</h1>
        <p className="text-gray-400">{season.name}</p>
      </div>

      <div className="relative mb-8">
        <input
          type="text"
          placeholder="Search by team name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-gray-900 border border-gray-800 rounded-xl px-5 py-3.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500/50 transition-all duration-200"
        />
      </div>

      {/* Podium - Top 3 */}
      {showPodium && (
        <div className="grid grid-cols-3 items-end gap-3 sm:gap-5 mb-10">
          {/* #2 - Silver (Left) */}
          <div className="pt-6 sm:pt-8">
            <div className="bg-gray-900 rounded-xl border border-gray-400/20 p-4 sm:p-6 text-center hover:border-gray-400/40 transition-all duration-300 group">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gray-400/10 border-2 border-gray-400/40 flex items-center justify-center mx-auto mb-3">
                <span className="text-gray-300 font-bold text-lg sm:text-xl font-mono">2</span>
              </div>
              <Link href={`/team/${second.id}`} className="text-white hover:text-gray-300 transition-colors duration-200 block">
                <h3 className="font-semibold text-sm sm:text-base truncate">{second.team_name}</h3>
              </Link>
              <div className="text-xl sm:text-2xl font-bold font-mono text-gray-300 mt-2">
                {second.total_score.toFixed(2)}
              </div>
              <div className="text-sm font-mono mt-1">
                <RankChangeDisplay change={rankChanges.get(second.id)} />
              </div>
            </div>
          </div>

          {/* #1 - Gold (Center) */}
          <div>
            <div className="bg-gray-900 rounded-xl border border-yellow-500/30 p-5 sm:p-7 text-center shadow-[0_0_25px_rgba(250,204,21,0.12)] hover:shadow-[0_0_35px_rgba(250,204,21,0.2)] transition-all duration-300 group relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-b from-yellow-500/5 via-transparent to-transparent" />
              <div className="relative">
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-yellow-500/15 border-2 border-yellow-500/50 flex items-center justify-center mx-auto mb-3">
                  <span className="text-yellow-400 font-bold text-xl sm:text-2xl font-mono">1</span>
                </div>
                <Link href={`/team/${first.id}`} className="text-white hover:text-yellow-400 transition-colors duration-200 block">
                  <h3 className="font-bold text-base sm:text-lg truncate">{first.team_name}</h3>
                </Link>
                <div className="text-2xl sm:text-3xl font-bold font-mono text-yellow-400 mt-2">
                  {first.total_score.toFixed(2)}
                </div>
                <div className="text-sm font-mono mt-1">
                  <RankChangeDisplay change={rankChanges.get(first.id)} />
                </div>
              </div>
            </div>
          </div>

          {/* #3 - Bronze (Right) */}
          <div className="pt-10 sm:pt-12">
            <div className="bg-gray-900 rounded-xl border border-amber-600/20 p-4 sm:p-5 text-center hover:border-amber-600/40 transition-all duration-300 group">
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-amber-600/10 border-2 border-amber-600/40 flex items-center justify-center mx-auto mb-3">
                <span className="text-amber-500 font-bold text-lg sm:text-xl font-mono">3</span>
              </div>
              <Link href={`/team/${third.id}`} className="text-white hover:text-amber-400 transition-colors duration-200 block">
                <h3 className="font-semibold text-sm sm:text-base truncate">{third.team_name}</h3>
              </Link>
              <div className="text-lg sm:text-xl font-bold font-mono text-amber-500 mt-2">
                {third.total_score.toFixed(2)}
              </div>
              <div className="text-sm font-mono mt-1">
                <RankChangeDisplay change={rankChanges.get(third.id)} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-12 text-center">
          <p className="text-gray-500 text-lg">
            {brackets.length === 0 ? 'No brackets submitted yet.' : 'No matching teams found.'}
          </p>
        </div>
      ) : tableData.length > 0 ? (
        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800 text-sm text-gray-500 uppercase tracking-wider">
                <th className="px-4 py-3.5 text-left w-16 font-semibold">Rank</th>
                <th className="px-4 py-3.5 w-16 text-center font-semibold">+/-</th>
                <th className="px-4 py-3.5 text-left font-semibold">Team Name</th>
                <th className="px-4 py-3.5 text-right font-semibold">Score</th>
              </tr>
            </thead>
            <tbody>
              {tableData.map((bracket) => {
                const globalRank = brackets.indexOf(bracket) + 1;
                const change = rankChanges.get(bracket.id);

                // Left border accent based on rank
                const borderAccent =
                  globalRank <= 10
                    ? 'border-l-2 border-l-cyan-500/30'
                    : globalRank <= 20
                    ? 'border-l-2 border-l-cyan-500/15'
                    : 'border-l-2 border-l-transparent';

                return (
                  <tr
                    key={bracket.id}
                    className={`border-b border-gray-800/50 transition-all duration-200 hover:bg-gray-800/50 ${borderAccent}`}
                  >
                    <td className="px-4 py-3.5">
                      <span className="font-mono text-gray-500">
                        #{globalRank}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-center text-sm font-mono">
                      <RankChangeDisplay change={change} />
                    </td>
                    <td className="px-4 py-3.5">
                      <Link
                        href={`/team/${bracket.id}`}
                        className="text-white hover:text-yellow-400 transition-colors duration-200"
                      >
                        {bracket.team_name}
                      </Link>
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono text-yellow-400">
                      {bracket.total_score.toFixed(2)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      <p className="text-gray-500 text-sm mt-4 text-center font-mono">
        {brackets.length} team{brackets.length !== 1 ? 's' : ''} total
      </p>
    </div>
  );
}
