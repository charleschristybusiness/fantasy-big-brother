'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Season, Houseguest, WeeklyEvent, BlockSurvivor, HouseguestStats } from '@/lib/types';
import { getHouseguestStats } from '@/lib/scoring';

export default function HouseguestsPage() {
  const [season, setSeason] = useState<Season | null>(null);
  const [standings, setStandings] = useState<HouseguestStats[]>([]);
  const [rankChanges, setRankChanges] = useState<Map<string, number | null>>(new Map());
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
        { data: eventsData },
        { data: survivorsData },
      ] = await Promise.all([
        supabase.from('houseguests').select('*').eq('season_id', s.id),
        supabase.from('weekly_events').select('*').eq('season_id', s.id),
        supabase.from('block_survivors').select('*, weekly_events!inner(season_id)').eq('weekly_events.season_id', s.id),
      ]);

      const houseguests = (hgData || []) as Houseguest[];
      const events = (eventsData || []) as WeeklyEvent[];
      const survivors = (survivorsData || []) as BlockSurvivor[];
      const evictedCount = houseguests.filter((h) => h.status === 'evicted').length;

      // Current standings
      const stats = houseguests
        .map((h) => getHouseguestStats(h, events, survivors, s.houseguest_count, evictedCount))
        .sort((a, b) => b.base_score - a.base_score);

      // Compute rank changes by comparing to previous week's rankings
      const changes = new Map<string, number | null>();
      const weeks = [...new Set(events.map((e) => e.week_number))].sort((a, b) => a - b);

      if (weeks.length >= 2) {
        const prevWeek = weeks[weeks.length - 2];

        // Build event id -> week map for filtering survivors
        const eventWeekMap = new Map<string, number>();
        for (const event of events) {
          eventWeekMap.set(event.id, event.week_number);
        }

        // Filter to events up to previous week
        const prevEvents = events.filter((e) => e.week_number <= prevWeek);
        const prevSurvivors = survivors.filter((bs) => {
          const eventWeek = eventWeekMap.get(bs.weekly_event_id);
          return eventWeek !== undefined && eventWeek <= prevWeek;
        });
        const prevEvictedCount = prevEvents.filter((e) => e.evicted_houseguest_id).length;

        // Compute previous week rankings
        const prevStats = houseguests
          .map((h) => getHouseguestStats(h, prevEvents, prevSurvivors, s.houseguest_count, prevEvictedCount))
          .sort((a, b) => b.base_score - a.base_score);

        const prevRankMap = new Map<string, number>();
        prevStats.forEach((s, i) => prevRankMap.set(s.houseguest.id, i + 1));

        stats.forEach((s, index) => {
          const currentRank = index + 1;
          const prevRank = prevRankMap.get(s.houseguest.id);
          if (prevRank !== undefined) {
            changes.set(s.houseguest.id, prevRank - currentRank);
          } else {
            changes.set(s.houseguest.id, null);
          }
        });
      }

      setRankChanges(changes);
      setStandings(stats);
      setLoading(false);
    }
    load();
  }, []);

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
    <div className="max-w-5xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-yellow-400 mb-2">Houseguest Standings</h1>
      <p className="text-gray-400 mb-6">{season.name} — Individual performance at 1x multiplier</p>

      {standings.length === 0 ? (
        <p className="text-gray-500 text-center py-8">No houseguests found.</p>
      ) : (
        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800 text-left text-sm text-gray-400">
                  <th className="px-4 py-3 w-16">Rank</th>
                  <th className="px-4 py-3 w-16 text-center">+/-</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-right">HOH</th>
                  <th className="px-4 py-3 text-right">Veto</th>
                  <th className="px-4 py-3 text-right">Block</th>
                  <th className="px-4 py-3 text-right">Placement</th>
                  <th className="px-4 py-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((s, index) => {
                  const rank = index + 1;
                  const change = rankChanges.get(s.houseguest.id);
                  return (
                    <tr
                      key={s.houseguest.id}
                      className={`border-b border-gray-800/50 hover:bg-gray-800/50 transition ${
                        rank <= 3 ? 'font-semibold' : ''
                      }`}
                    >
                      <td className="px-4 py-3">
                        <span
                          className={
                            rank === 1
                              ? 'text-yellow-400'
                              : rank === 2
                              ? 'text-gray-300'
                              : rank === 3
                              ? 'text-amber-600'
                              : 'text-gray-500'
                          }
                        >
                          #{rank}
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
                      <td className="px-4 py-3 text-white">{s.houseguest.name}</td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`text-xs font-medium px-2 py-1 rounded-full ${
                            s.houseguest.status === 'active'
                              ? 'bg-green-900/50 text-green-400'
                              : s.houseguest.status === 'evicted'
                              ? 'bg-red-900/50 text-red-400'
                              : 'bg-yellow-900/50 text-yellow-400'
                          }`}
                        >
                          {s.houseguest.status === 'runner_up'
                            ? 'Runner-Up'
                            : s.houseguest.status.charAt(0).toUpperCase() + s.houseguest.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-gray-300">
                        {s.hoh_wins}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-gray-300">
                        {s.veto_wins}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-gray-300">
                        {s.block_survivals}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-gray-300">
                        {s.placement_points}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-yellow-400">
                        {s.base_score}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="text-gray-500 text-sm mt-4 text-center">
        {standings.length} houseguest{standings.length !== 1 ? 's' : ''} total
      </p>
    </div>
  );
}
