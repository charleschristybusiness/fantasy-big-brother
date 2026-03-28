'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { Season, Bracket, WeeklyRanking } from '@/lib/types';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

// Distinct colors for team lines
const LINE_COLORS = [
  '#facc15', '#f87171', '#60a5fa', '#34d399', '#c084fc',
  '#fb923c', '#22d3ee', '#e879f9', '#a3e635', '#fbbf24',
  '#f472b6', '#38bdf8', '#4ade80', '#a78bfa', '#fb7185',
  '#2dd4bf', '#fcd34d', '#818cf8', '#86efac', '#fdba74',
];

interface RankedBracket {
  id: string;
  team_name: string;
  current_rank: number;
  total_score: number;
}

export default function TrendsPage() {
  const [season, setSeason] = useState<Season | null>(null);
  const [brackets, setBrackets] = useState<RankedBracket[]>([]);
  const [rankings, setRankings] = useState<WeeklyRanking[]>([]);
  const [selectedTeams, setSelectedTeams] = useState<Set<string>>(new Set());
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

      const [{ data: bracketData }, { data: rankingData }] = await Promise.all([
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
      ]);

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
      // Default: all teams selected
      setSelectedTeams(new Set(ranked.map((b) => b.id)));
      setLoading(false);
    }
    load();
  }, []);

  // Build chart data: one entry per week, with total_score keyed by bracket id
  const chartData = useMemo(() => {
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

  // Color map for brackets
  const colorMap = useMemo(() => {
    const map = new Map<string, string>();
    brackets.forEach((b, i) => {
      map.set(b.id, LINE_COLORS[i % LINE_COLORS.length]);
    });
    return map;
  }, [brackets]);

  const totalTeams = brackets.length;

  function selectAll() {
    setSelectedTeams(new Set(brackets.map((b) => b.id)));
  }

  function deselectAll() {
    setSelectedTeams(new Set());
  }

  function toggleTeam(id: string) {
    setSelectedTeams((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-12 text-center text-gray-400">Loading...</div>
    );
  }

  if (!season) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-12 text-center">
        <h1 className="text-3xl font-bold text-white mb-4">No Active Season</h1>
        <p className="text-gray-400">There is no active season right now.</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-yellow-400 mb-2">Ranking Trends</h1>
      <p className="text-gray-400 mb-8">{season.name} &mdash; Week-by-week total points</p>

      {rankings.length === 0 ? (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-12 text-center">
          <p className="text-gray-500 text-lg">No weekly results have been entered yet.</p>
          <p className="text-gray-600 text-sm mt-2">
            Trend data will appear after the admin enters the first week&apos;s results.
          </p>
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Chart */}
          <div className="flex-1 bg-gray-900 rounded-xl border border-gray-800 p-4 min-h-[400px]">
            <ResponsiveContainer width="100%" height={450}>
              <LineChart data={chartData} margin={{ top: 10, right: 20, bottom: 10, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis
                  dataKey="week"
                  stroke="#9ca3af"
                  tick={{ fill: '#9ca3af', fontSize: 12 }}
                />
                <YAxis
                  stroke="#9ca3af"
                  tick={{ fill: '#9ca3af', fontSize: 12 }}
                  allowDecimals={false}
                  label={{
                    value: 'Total Points',
                    angle: -90,
                    position: 'insideLeft',
                    fill: '#9ca3af',
                    fontSize: 12,
                  }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1f2937',
                    border: '1px solid #374151',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '13px',
                  }}
                  formatter={(value, name) => {
                    const team = brackets.find((b) => b.id === String(name));
                    return [`${value} pts`, team?.team_name || String(name)];
                  }}
                  labelStyle={{ color: '#9ca3af' }}
                />
                {brackets
                  .filter((b) => selectedTeams.has(b.id))
                  .map((b) => (
                    <Line
                      key={b.id}
                      type="monotone"
                      dataKey={b.id}
                      stroke={colorMap.get(b.id)}
                      strokeWidth={2}
                      dot={{ r: 4, fill: colorMap.get(b.id) }}
                      activeDot={{ r: 6 }}
                      connectNulls
                    />
                  ))}
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Sidebar filter */}
          <div className="lg:w-64 bg-gray-900 rounded-xl border border-gray-800 p-4 self-start">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Teams
            </h2>
            <div className="flex gap-2 mb-4">
              <button
                onClick={selectAll}
                className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded transition"
              >
                Select All
              </button>
              <button
                onClick={deselectAll}
                className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded transition"
              >
                Deselect All
              </button>
            </div>
            <div className="space-y-1.5 max-h-[500px] overflow-y-auto">
              {brackets.map((b) => (
                <label
                  key={b.id}
                  className="flex items-center gap-2.5 cursor-pointer hover:bg-gray-800/50 rounded px-2 py-1.5 transition"
                >
                  <input
                    type="checkbox"
                    checked={selectedTeams.has(b.id)}
                    onChange={() => toggleTeam(b.id)}
                    className="accent-yellow-400 w-4 h-4 rounded"
                  />
                  <span
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: colorMap.get(b.id) }}
                  />
                  <span className="text-sm text-gray-300 truncate flex-1">{b.team_name}</span>
                  <span className="text-xs text-gray-500 flex-shrink-0">#{b.current_rank}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
