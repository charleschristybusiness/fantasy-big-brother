'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Season, Houseguest, Bracket, WeeklyEvent, BlockSurvivor } from '@/lib/types';
import { calculateBracketScore } from '@/lib/scoring';

interface HypotheticalWeek {
  id: number;
  weekNumber: number;
  hohWinnerId: string;
  vetoWinnerId: string;
  evictedId: string;
  blockSurvivorIds: string[];
}

function ForecastSkeleton() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <div className="h-9 w-48 animate-pulse bg-gray-800 rounded-lg mb-2" />
      <div className="h-5 w-72 animate-pulse bg-gray-800 rounded mb-8" />
      <div className="flex flex-col lg:flex-row gap-6">
        <div className="lg:w-96 bg-gray-900 rounded-xl border border-gray-800 p-6 min-h-[400px] animate-pulse" />
        <div className="flex-1 bg-gray-900 rounded-xl border border-gray-800 p-6 min-h-[400px] animate-pulse" />
      </div>
    </div>
  );
}

let nextWeekId = 1;

export default function ForecastPage() {
  const [season, setSeason] = useState<Season | null>(null);
  const [houseguests, setHouseguests] = useState<Houseguest[]>([]);
  const [brackets, setBrackets] = useState<Bracket[]>([]);
  const [events, setEvents] = useState<WeeklyEvent[]>([]);
  const [survivors, setSurvivors] = useState<BlockSurvivor[]>([]);
  const [loading, setLoading] = useState(true);
  const [hypotheticalWeeks, setHypotheticalWeeks] = useState<HypotheticalWeek[]>([]);

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
      ] = await Promise.all([
        supabase.from('houseguests').select('*').eq('season_id', s.id),
        supabase.from('brackets').select('*').eq('season_id', s.id),
        supabase.from('weekly_events').select('*').eq('season_id', s.id),
        supabase.from('block_survivors').select('*, weekly_events!inner(season_id)').eq('weekly_events.season_id', s.id),
      ]);

      const hgs = (hgData || []) as Houseguest[];
      const evts = (eventsData || []) as WeeklyEvent[];
      setHouseguests(hgs);
      setBrackets((bracketData || []) as Bracket[]);
      setEvents(evts);
      setSurvivors((survivorsData || []) as BlockSurvivor[]);

      // Initialize with one empty hypothetical week
      const maxWeek = evts.length > 0 ? Math.max(...evts.map((e) => e.week_number)) : 0;
      setHypotheticalWeeks([{
        id: nextWeekId++,
        weekNumber: maxWeek + 1,
        hohWinnerId: '',
        vetoWinnerId: '',
        evictedId: '',
        blockSurvivorIds: [],
      }]);

      setLoading(false);
    }
    load();
  }, []);

  // Compute real leaderboard (baseline)
  const realScored = useMemo(() => {
    if (!season || brackets.length === 0) return [];
    return brackets
      .map((b) => calculateBracketScore(b, houseguests, events, survivors, season.houseguest_count))
      .sort((a, b) => b.total_score - a.total_score);
  }, [season, brackets, houseguests, events, survivors]);

  const realRankMap = useMemo(() => {
    const map = new Map<string, number>();
    realScored.forEach((b, i) => map.set(b.id, i + 1));
    return map;
  }, [realScored]);

  // Track which houseguests are evicted in prior hypothetical weeks
  const evictedByWeek = useMemo(() => {
    const evictedIds = new Set<string>();
    // Real evicted
    for (const hg of houseguests) {
      if (hg.status === 'evicted') evictedIds.add(hg.id);
    }
    // Build per-week cumulative eviction sets
    const result: Map<number, Set<string>> = new Map();
    for (let i = 0; i < hypotheticalWeeks.length; i++) {
      // Available for this week = not evicted before this week
      result.set(hypotheticalWeeks[i].id, new Set(evictedIds));
      // After this week, add this week's eviction
      if (hypotheticalWeeks[i].evictedId) {
        evictedIds.add(hypotheticalWeeks[i].evictedId);
      }
    }
    return result;
  }, [hypotheticalWeeks, houseguests]);

  // Get active houseguests for a specific hypothetical week
  function getActiveForWeek(weekId: number): Houseguest[] {
    const evicted = evictedByWeek.get(weekId) || new Set();
    return houseguests.filter((hg) => !evicted.has(hg.id));
  }

  // Compute hypothetical leaderboard
  const hypotheticalScored = useMemo(() => {
    if (!season || brackets.length === 0) return [];

    // Clone houseguests with hypothetical evictions applied
    const realEvictedCount = houseguests.filter((h) => h.status === 'evicted').length;
    let hypoEvictedCount = realEvictedCount;

    const hypoHouseguests = houseguests.map((hg) => ({ ...hg }));

    // Build hypothetical events and survivors
    const hypoEvents: WeeklyEvent[] = [...events];
    const hypoSurvivors: BlockSurvivor[] = [...survivors];

    for (const week of hypotheticalWeeks) {
      const hasAnyInput = week.hohWinnerId || week.vetoWinnerId || week.evictedId || week.blockSurvivorIds.length > 0;
      if (!hasAnyInput) continue;

      const fakeEventId = `hypo-event-${week.id}`;

      hypoEvents.push({
        id: fakeEventId,
        season_id: season.id,
        week_number: week.weekNumber,
        hoh_winner_id: week.hohWinnerId || null,
        veto_winner_id: week.vetoWinnerId || null,
        evicted_houseguest_id: week.evictedId || null,
        created_at: new Date().toISOString(),
      });

      // Apply eviction
      if (week.evictedId) {
        hypoEvictedCount++;
        const hg = hypoHouseguests.find((h) => h.id === week.evictedId);
        if (hg && hg.status === 'active') {
          hg.status = 'evicted';
          hg.eviction_order = hypoEvictedCount;
        }
      }

      // Add block survivors
      for (const survivorId of week.blockSurvivorIds) {
        hypoSurvivors.push({
          id: `hypo-survivor-${week.id}-${survivorId}`,
          weekly_event_id: fakeEventId,
          houseguest_id: survivorId,
        });
      }
    }

    return brackets
      .map((b) => calculateBracketScore(b, hypoHouseguests, hypoEvents, hypoSurvivors, season.houseguest_count))
      .sort((a, b) => b.total_score - a.total_score);
  }, [season, brackets, houseguests, events, survivors, hypotheticalWeeks]);

  // Helpers
  function updateWeek(weekId: number, updates: Partial<HypotheticalWeek>) {
    setHypotheticalWeeks((prev) =>
      prev.map((w) => (w.id === weekId ? { ...w, ...updates } : w))
    );
  }

  function addWeek() {
    const lastWeek = hypotheticalWeeks[hypotheticalWeeks.length - 1];
    setHypotheticalWeeks((prev) => [
      ...prev,
      {
        id: nextWeekId++,
        weekNumber: lastWeek ? lastWeek.weekNumber + 1 : 1,
        hohWinnerId: '',
        vetoWinnerId: '',
        evictedId: '',
        blockSurvivorIds: [],
      },
    ]);
  }

  function removeWeek(weekId: number) {
    setHypotheticalWeeks((prev) => {
      const filtered = prev.filter((w) => w.id !== weekId);
      // Clear any references to houseguests that might now be un-evicted
      // by rebuilding downstream weeks' selections
      return filtered.map((w) => {
        // Check if evictedId in this week was evicted by a removed/prior week
        // Simple approach: just keep selections, the dropdown will handle validity
        return w;
      });
    });
  }

  function resetAll() {
    const maxWeek = events.length > 0 ? Math.max(...events.map((e) => e.week_number)) : 0;
    setHypotheticalWeeks([{
      id: nextWeekId++,
      weekNumber: maxWeek + 1,
      hohWinnerId: '',
      vetoWinnerId: '',
      evictedId: '',
      blockSurvivorIds: [],
    }]);
  }

  function toggleBlockSurvivor(weekId: number, hgId: string) {
    setHypotheticalWeeks((prev) =>
      prev.map((w) => {
        if (w.id !== weekId) return w;
        const ids = w.blockSurvivorIds.includes(hgId)
          ? w.blockSurvivorIds.filter((id) => id !== hgId)
          : [...w.blockSurvivorIds, hgId];
        return { ...w, blockSurvivorIds: ids };
      })
    );
  }

  if (loading) {
    return <ForecastSkeleton />;
  }

  if (!season) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12 text-center">
        <h1 className="text-3xl font-bold text-white mb-4">No Active Season</h1>
        <p className="text-gray-400">There is no active season right now.</p>
      </div>
    );
  }

  const hasHypotheticalInput = hypotheticalWeeks.some(
    (w) => w.hohWinnerId || w.vetoWinnerId || w.evictedId || w.blockSurvivorIds.length > 0
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-yellow-400 mb-1">Forecast</h1>
        <p className="text-gray-400">{season.name} &mdash; What If Simulator</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left: Scenario Builder */}
        <div className="lg:w-[400px] flex-shrink-0 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Scenario Builder</h2>
            <button
              onClick={resetAll}
              className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white px-3 py-1.5 rounded-lg transition-colors duration-200 border border-gray-700"
            >
              Reset All
            </button>
          </div>

          {hypotheticalWeeks.map((week) => {
            const activeHGs = getActiveForWeek(week.id);

            return (
              <div key={week.id} className="bg-gray-900 rounded-xl border border-gray-800 p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-semibold text-white">
                    Week {week.weekNumber}
                    <span className="text-xs text-fuchsia-400 ml-2 font-normal">Hypothetical</span>
                  </h3>
                  {hypotheticalWeeks.length > 1 && (
                    <button
                      onClick={() => removeWeek(week.id)}
                      className="text-xs text-red-400 hover:text-red-300 transition-colors duration-200"
                    >
                      Remove
                    </button>
                  )}
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">HOH Winner</label>
                    <select
                      value={week.hohWinnerId}
                      onChange={(e) => updateWeek(week.id, { hohWinnerId: e.target.value })}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500/50 transition-all duration-200"
                    >
                      <option value="">-- None --</option>
                      {activeHGs.map((hg) => (
                        <option key={hg.id} value={hg.id}>{hg.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Veto Winner</label>
                    <select
                      value={week.vetoWinnerId}
                      onChange={(e) => updateWeek(week.id, { vetoWinnerId: e.target.value })}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500/50 transition-all duration-200"
                    >
                      <option value="">-- None --</option>
                      {activeHGs.map((hg) => (
                        <option key={hg.id} value={hg.id}>{hg.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Evicted</label>
                    <select
                      value={week.evictedId}
                      onChange={(e) => updateWeek(week.id, { evictedId: e.target.value })}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500/50 transition-all duration-200"
                    >
                      <option value="">-- None --</option>
                      {activeHGs.map((hg) => (
                        <option key={hg.id} value={hg.id}>{hg.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Block Survivors</label>
                    <div className="grid grid-cols-2 gap-1.5 max-h-[200px] overflow-y-auto">
                      {activeHGs.map((hg) => (
                        <label
                          key={hg.id}
                          className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg cursor-pointer text-xs transition-all duration-200 ${
                            week.blockSurvivorIds.includes(hg.id)
                              ? 'bg-yellow-500/15 border border-yellow-500/40'
                              : 'bg-gray-800/50 border border-gray-700/50 hover:border-gray-600'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={week.blockSurvivorIds.includes(hg.id)}
                            onChange={() => toggleBlockSurvivor(week.id, hg.id)}
                            className="accent-yellow-500 w-3.5 h-3.5"
                          />
                          <span className="text-gray-300 truncate">{hg.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          <button
            onClick={addWeek}
            className="w-full bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white font-semibold py-3 rounded-xl transition-all duration-200 border border-gray-700 hover:border-gray-600 text-sm"
          >
            + Add Another Week
          </button>
        </div>

        {/* Right: Hypothetical Leaderboard */}
        <div className="flex-1">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
              {hasHypotheticalInput ? 'Hypothetical Leaderboard' : 'Current Leaderboard'}
            </h2>
            {hasHypotheticalInput && (
              <span className="text-xs text-fuchsia-400 bg-fuchsia-500/10 px-2.5 py-1 rounded-full border border-fuchsia-500/20">
                What If Mode
              </span>
            )}
          </div>

          {hypotheticalScored.length === 0 ? (
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-12 text-center">
              <p className="text-gray-500 text-lg">No brackets submitted yet.</p>
            </div>
          ) : (
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
                  {hypotheticalScored.map((bracket, index) => {
                    const hypoRank = index + 1;
                    const realRank = realRankMap.get(bracket.id) || hypoRank;
                    const change = realRank - hypoRank;
                    const moved = hasHypotheticalInput && change !== 0;

                    return (
                      <tr
                        key={bracket.id}
                        className={`border-b border-gray-800/50 transition-all duration-200 ${
                          moved && change > 0
                            ? 'bg-green-500/5 hover:bg-green-500/10'
                            : moved && change < 0
                            ? 'bg-red-500/5 hover:bg-red-500/10'
                            : 'hover:bg-gray-800/50'
                        }`}
                      >
                        <td className="px-4 py-3">
                          <span
                            className={`font-mono ${
                              hypoRank === 1
                                ? 'text-yellow-400'
                                : hypoRank === 2
                                ? 'text-gray-300'
                                : hypoRank === 3
                                ? 'text-amber-600'
                                : 'text-gray-500'
                            }`}
                          >
                            #{hypoRank}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center text-sm font-mono">
                          {!hasHypotheticalInput ? (
                            <span className="text-gray-600">&mdash;</span>
                          ) : change > 0 ? (
                            <span className="text-green-400 font-bold">&uarr;{change}</span>
                          ) : change < 0 ? (
                            <span className="text-red-400 font-bold">&darr;{change}</span>
                          ) : (
                            <span className="text-gray-600">&mdash;</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            href={`/team/${bracket.id}`}
                            className="text-white hover:text-yellow-400 transition-colors duration-200"
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

          <p className="text-gray-500 text-sm mt-4 text-center font-mono">
            {brackets.length} team{brackets.length !== 1 ? 's' : ''} total
          </p>
        </div>
      </div>
    </div>
  );
}
