'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { Season, Bracket, WeeklyRanking, Houseguest, WeeklyEvent, BlockSurvivor } from '@/lib/types';
import { getHouseguestStats } from '@/lib/scoring';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

// Distinct colors for lines — bold, visible on white
const LINE_COLORS = [
  '#2563eb', '#dc2626', '#16a34a', '#9333ea', '#ea580c',
  '#0891b2', '#d946ef', '#ca8a04', '#4f46e5', '#059669',
  '#e11d48', '#0284c7', '#7c3aed', '#c2410c', '#0d9488',
  '#6d28d9', '#b91c1c', '#1d4ed8', '#15803d', '#a21caf',
];

interface RankedBracket {
  id: string;
  team_name: string;
  current_rank: number;
  total_score: number;
}

interface HouseguestEntry {
  id: string;
  name: string;
  status: string;
  total_score: number;
}

export default function TrendsPage() {
  const [activeTab, setActiveTab] = useState<'teams' | 'houseguests'>('teams');
  const [season, setSeason] = useState<Season | null>(null);
  // Team trend state
  const [brackets, setBrackets] = useState<RankedBracket[]>([]);
  const [rankings, setRankings] = useState<WeeklyRanking[]>([]);
  const [selectedTeams, setSelectedTeams] = useState<Set<string>>(new Set());
  // Houseguest trend state
  const [houseguests, setHouseguests] = useState<Houseguest[]>([]);
  const [weeklyEvents, setWeeklyEvents] = useState<WeeklyEvent[]>([]);
  const [blockSurvivors, setBlockSurvivors] = useState<BlockSurvivor[]>([]);
  const [selectedHouseguests, setSelectedHouseguests] = useState<Set<string>>(new Set());

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
        { data: bracketData },
        { data: rankingData },
        { data: hgData },
        { data: eventsData },
        { data: survivorsData },
      ] = await Promise.all([
        supabase
          .from('brackets')
          .select('id, team_name, total_score')
          .eq('season_id', s.id)
          .order('total_score', { ascending: false }),
        supabase
          .from('weekly_rankings')
          .select('*')
          .eq('season_id', s.id)
          .order('week_number', { ascending: true }),
        supabase.from('houseguests').select('*').eq('season_id', s.id),
        supabase.from('weekly_events').select('*').eq('season_id', s.id).order('week_number', { ascending: true }),
        supabase.from('block_survivors').select('*, weekly_events!inner(season_id)').eq('weekly_events.season_id', s.id),
      ]);

      // Team trends
      const ranked: RankedBracket[] = ((bracketData || []) as Pick<Bracket, 'id' | 'team_name' | 'total_score'>[]).map(
        (b, i) => ({
          id: b.id,
          team_name: b.team_name,
          current_rank: i + 1,
          total_score: b.total_score,
        })
      );
      setBrackets(ranked);
      setRankings((rankingData || []) as WeeklyRanking[]);
      setSelectedTeams(new Set(ranked.map((b) => b.id)));

      // Houseguest trends
      const hgs = (hgData || []) as Houseguest[];
      setHouseguests(hgs);
      setWeeklyEvents((eventsData || []) as WeeklyEvent[]);
      setBlockSurvivors((survivorsData || []) as BlockSurvivor[]);
      setSelectedHouseguests(new Set(hgs.map((h) => h.id)));

      setLoading(false);
    }
    load();
  }, []);

  // === Team chart data ===
  const teamChartData = useMemo(() => {
    const weekMap = new Map<number, Map<string, WeeklyRanking>>();
    for (const r of rankings) {
      if (!weekMap.has(r.week_number)) weekMap.set(r.week_number, new Map());
      weekMap.get(r.week_number)!.set(r.bracket_id, r);
    }
    const weeks = Array.from(weekMap.keys()).sort((a, b) => a - b);
    return weeks.map((week) => {
      const entry: Record<string, number | string> = { week: `Wk ${week}` };
      const weekRankings = weekMap.get(week)!;
      for (const [bracketId, ranking] of weekRankings) {
        entry[bracketId] = ranking.total_score;
      }
      return entry;
    });
  }, [rankings]);

  // === Houseguest chart data ===
  const houseguestChartData = useMemo(() => {
    if (weeklyEvents.length === 0 || houseguests.length === 0) return [];

    const weeks = [...new Set(weeklyEvents.map((e) => e.week_number))].sort((a, b) => a - b);

    const evictionWeekMap = new Map<string, number>();
    for (const event of weeklyEvents) {
      if (event.evicted_houseguest_id) {
        evictionWeekMap.set(event.evicted_houseguest_id, event.week_number);
      }
    }

    const eventWeekMap = new Map<string, number>();
    for (const event of weeklyEvents) {
      eventWeekMap.set(event.id, event.week_number);
    }

    const totalHouseguests = season?.houseguest_count || houseguests.length;

    return weeks.map((week) => {
      const entry: Record<string, number | string> = { week: `Wk ${week}` };

      const eventsUpToWeek = weeklyEvents.filter((e) => e.week_number <= week);
      const survivorsUpToWeek = blockSurvivors.filter((bs) => {
        const eventWeek = eventWeekMap.get(bs.weekly_event_id);
        return eventWeek !== undefined && eventWeek <= week;
      });

      const evictedCountAtWeek = eventsUpToWeek.filter((e) => e.evicted_houseguest_id).length;

      for (const hg of houseguests) {
        const evictionWeek = evictionWeekMap.get(hg.id);
        if (evictionWeek !== undefined && week > evictionWeek) continue;

        const stats = getHouseguestStats(hg, eventsUpToWeek, survivorsUpToWeek, totalHouseguests, evictedCountAtWeek);
        entry[hg.id] = stats.base_score;
      }

      return entry;
    });
  }, [weeklyEvents, blockSurvivors, houseguests, season]);

  // Sorted houseguest list: active first, then evicted
  const sortedHouseguests = useMemo(() => {
    if (weeklyEvents.length === 0 || houseguests.length === 0) return [];

    const totalHouseguests = season?.houseguest_count || houseguests.length;
    const evictedCount = houseguests.filter((h) => h.status === 'evicted').length;

    const withScores: HouseguestEntry[] = houseguests.map((hg) => {
      const stats = getHouseguestStats(hg, weeklyEvents, blockSurvivors, totalHouseguests, evictedCount);
      return {
        id: hg.id,
        name: hg.name,
        status: hg.status,
        total_score: stats.base_score,
      };
    });

    const active = withScores.filter((h) => h.status === 'active').sort((a, b) => b.total_score - a.total_score);
    const evicted = withScores.filter((h) => h.status !== 'active').sort((a, b) => b.total_score - a.total_score);

    return [...active, ...evicted];
  }, [houseguests, weeklyEvents, blockSurvivors, season]);

  // Color maps
  const teamColorMap = useMemo(() => {
    const map = new Map<string, string>();
    brackets.forEach((b, i) => map.set(b.id, LINE_COLORS[i % LINE_COLORS.length]));
    return map;
  }, [brackets]);

  const hgColorMap = useMemo(() => {
    const map = new Map<string, string>();
    sortedHouseguests.forEach((h, i) => map.set(h.id, LINE_COLORS[i % LINE_COLORS.length]));
    return map;
  }, [sortedHouseguests]);

  // Team selection helpers
  function selectAllTeams() { setSelectedTeams(new Set(brackets.map((b) => b.id))); }
  function deselectAllTeams() { setSelectedTeams(new Set()); }
  function toggleTeam(id: string) {
    setSelectedTeams((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }

  // Houseguest selection helpers
  function selectAllHouseguests() { setSelectedHouseguests(new Set(sortedHouseguests.map((h) => h.id))); }
  function deselectAllHouseguests() { setSelectedHouseguests(new Set()); }
  function toggleHouseguest(id: string) {
    setSelectedHouseguests((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }

  // Shared chart styles
  const tooltipStyle = {
    backgroundColor: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    color: '#0f172a',
    fontSize: '13px',
    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-12 text-center text-slate-400">Loading...</div>
    );
  }

  if (!season) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-12 text-center">
        <h1 className="text-3xl font-bold text-slate-900 mb-4">No Active Season</h1>
        <p className="text-slate-500">There is no active season right now.</p>
      </div>
    );
  }

  const hasTeamData = rankings.length > 0;
  const hasHouseguestData = weeklyEvents.length > 0 && houseguests.length > 0;

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-blue-600 mb-2">Ranking Trends</h1>
      <p className="text-slate-500 mb-6">{season.name} &mdash; Week-by-week performance</p>

      {/* Tabs */}
      <div className="flex gap-2 mb-8">
        <button
          onClick={() => setActiveTab('teams')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
            activeTab === 'teams'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          Team Trends
        </button>
        <button
          onClick={() => setActiveTab('houseguests')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
            activeTab === 'houseguests'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          Houseguest Trends
        </button>
      </div>

      {/* Team Trends Tab */}
      {activeTab === 'teams' && (
        !hasTeamData ? (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
            <p className="text-slate-400 text-lg">No weekly results have been entered yet.</p>
            <p className="text-slate-300 text-sm mt-2">
              Trend data will appear after the admin enters the first week&apos;s results.
            </p>
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm p-4 min-h-[400px]">
              <ResponsiveContainer width="100%" height={450}>
                <LineChart data={teamChartData} margin={{ top: 10, right: 20, bottom: 10, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="week" stroke="#94a3b8" tick={{ fill: '#64748b', fontSize: 12 }} />
                  <YAxis
                    stroke="#94a3b8"
                    tick={{ fill: '#64748b', fontSize: 12 }}
                    allowDecimals={false}
                    label={{ value: 'Total Points', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 12 }}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value, name) => {
                      const team = brackets.find((b) => b.id === String(name));
                      return [`${value} pts`, team?.team_name || String(name)];
                    }}
                    itemSorter={(item) => -(item.value as number)}
                    labelStyle={{ color: '#64748b' }}
                  />
                  {brackets
                    .filter((b) => selectedTeams.has(b.id))
                    .map((b) => (
                      <Line
                        key={b.id}
                        type="monotone"
                        dataKey={b.id}
                        stroke={teamColorMap.get(b.id)}
                        strokeWidth={2}
                        dot={{ r: 4, fill: teamColorMap.get(b.id) }}
                        activeDot={{ r: 6 }}
                        connectNulls
                      />
                    ))}
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="lg:w-64 bg-white rounded-xl border border-slate-200 shadow-sm p-4 self-start">
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Teams</h2>
              <div className="flex gap-2 mb-4">
                <button onClick={selectAllTeams} className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-1.5 rounded transition">Select All</button>
                <button onClick={deselectAllTeams} className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-1.5 rounded transition">Deselect All</button>
              </div>
              <div className="space-y-1.5 max-h-[500px] overflow-y-auto">
                {brackets.map((b) => (
                  <label key={b.id} className="flex items-center gap-2.5 cursor-pointer hover:bg-slate-50 rounded px-2 py-1.5 transition">
                    <input type="checkbox" checked={selectedTeams.has(b.id)} onChange={() => toggleTeam(b.id)} className="accent-blue-600 w-4 h-4 rounded" />
                    <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: teamColorMap.get(b.id) }} />
                    <span className="text-sm text-slate-700 truncate flex-1">{b.team_name}</span>
                    <span className="text-xs text-slate-400 flex-shrink-0">#{b.current_rank}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )
      )}

      {/* Houseguest Trends Tab */}
      {activeTab === 'houseguests' && (
        !hasHouseguestData ? (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
            <p className="text-slate-400 text-lg">No weekly results have been entered yet.</p>
            <p className="text-slate-300 text-sm mt-2">
              Houseguest trends will appear after the admin enters the first week&apos;s results.
            </p>
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm p-4 min-h-[400px]">
              <ResponsiveContainer width="100%" height={450}>
                <LineChart data={houseguestChartData} margin={{ top: 10, right: 20, bottom: 10, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="week" stroke="#94a3b8" tick={{ fill: '#64748b', fontSize: 12 }} />
                  <YAxis
                    stroke="#94a3b8"
                    tick={{ fill: '#64748b', fontSize: 12 }}
                    allowDecimals={false}
                    label={{ value: 'Total Points', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 12 }}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value, name) => {
                      const hg = sortedHouseguests.find((h) => h.id === String(name));
                      return [`${value} pts`, hg?.name || String(name)];
                    }}
                    itemSorter={(item) => -(item.value as number)}
                    labelStyle={{ color: '#64748b' }}
                  />
                  {sortedHouseguests
                    .filter((h) => selectedHouseguests.has(h.id))
                    .map((h) => (
                      <Line
                        key={h.id}
                        type="monotone"
                        dataKey={h.id}
                        stroke={hgColorMap.get(h.id)}
                        strokeWidth={2}
                        dot={{ r: 4, fill: hgColorMap.get(h.id) }}
                        activeDot={{ r: 6 }}
                        connectNulls={false}
                      />
                    ))}
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="lg:w-64 bg-white rounded-xl border border-slate-200 shadow-sm p-4 self-start">
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Houseguests</h2>
              <div className="flex gap-2 mb-4">
                <button onClick={selectAllHouseguests} className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-1.5 rounded transition">Select All</button>
                <button onClick={deselectAllHouseguests} className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-1.5 rounded transition">Deselect All</button>
              </div>
              <div className="space-y-1.5 max-h-[500px] overflow-y-auto">
                {sortedHouseguests.map((h) => (
                  <label key={h.id} className="flex items-center gap-2.5 cursor-pointer hover:bg-slate-50 rounded px-2 py-1.5 transition">
                    <input type="checkbox" checked={selectedHouseguests.has(h.id)} onChange={() => toggleHouseguest(h.id)} className="accent-blue-600 w-4 h-4 rounded" />
                    <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: hgColorMap.get(h.id) }} />
                    <span className="text-sm text-slate-700 truncate flex-1">{h.name}</span>
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${h.status === 'active' ? 'bg-green-500' : 'bg-red-500'}`} />
                  </label>
                ))}
              </div>
            </div>
          </div>
        )
      )}
    </div>
  );
}
