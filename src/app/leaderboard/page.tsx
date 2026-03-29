'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Season, Houseguest, Bracket, WeeklyEvent, BlockSurvivor, WeeklyRanking } from '@/lib/types';
import { calculateBracketScore } from '@/lib/scoring';

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

      // Compute rank changes from weekly_rankings
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

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center text-gray-400">Loading...</div>
    );
  }

  if (!season) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center">
        <h1 className="text-3xl font-bold text-white mb-4">No Active Season</h1>
        <p className="text-gray-400">There is no active season right now.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-yellow-400 mb-2">Leaderboard</h1>
      <p className="text-gray-400 mb-6">{season.name}</p>

      <input
        type="text"
        placeholder="Search by team name..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent mb-6"
      />

      {filtered.length === 0 ? (
        <p className="text-gray-500 text-center py-8">
          {brackets.length === 0 ? 'No brackets submitted yet.' : 'No matching teams found.'}
        </p>
      ) : (
        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800 text-left text-sm text-gray-400">
                <th className="px-4 py-3 w-16">Rank</th>
                <th className="px-4 py-3 w-16 text-center">+/-</th>
                <th className="px-4 py-3">Team Name</th>
                <th className="px-4 py-3 text-right">Score</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((bracket, index) => {
                const globalRank = brackets.indexOf(bracket) + 1;
                const change = rankChanges.get(bracket.id);
                return (
                  <tr
                    key={bracket.id}
                    className={`border-b border-gray-800/50 hover:bg-gray-800/50 transition ${
                      index < 3 ? 'font-semibold' : ''
                    }`}
                  >
                    <td className="px-4 py-3">
                      <span
                        className={
                          globalRank === 1
                            ? 'text-yellow-400'
                            : globalRank === 2
                            ? 'text-gray-300'
                            : globalRank === 3
                            ? 'text-amber-600'
                            : 'text-gray-500'
                        }
                      >
                        #{globalRank}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-sm font-mono">
                      {change === undefined || change === null ? (
                        <span className="text-gray-600">&mdash;</span>
                      ) : change > 0 ? (
                        <span className="text-green-400">&uarr;+{change}</span>
                      ) : change < 0 ? (
                        <span className="text-red-400">&darr;{change}</span>
                      ) : (
                        <span className="text-gray-600">&mdash;</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/team/${bracket.id}`}
                        className="text-white hover:text-yellow-400 transition"
                      >
                        {bracket.team_name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-yellow-400">
                      {bracket.total_score.toFixed(2)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-gray-500 text-sm mt-4 text-center">
        {brackets.length} team{brackets.length !== 1 ? 's' : ''} total
      </p>
    </div>
  );
}
