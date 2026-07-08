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
import { Card, PageHeader, EmptyState, NoSeason, Skeleton } from '@/components/ui';

// Validated 8-slot categorical palette (dark mode). Colors are assigned to
// entities in rank order at load and never reassigned; entities beyond the
// 8th render muted — the checkbox legend and tooltip carry their identity.
const SERIES_COLORS = [
  '#3987e5', // blue
  '#199e70', // aqua
  '#c98500', // yellow
  '#008300', // green
  '#9085e9', // violet
  '#e66767', // red
  '#d55181', // magenta
  '#d95926', // orange
];
const MUTED_SERIES = '#4a515e';

const CHART = {
  grid: '#22252f',
  axis: '#7d8594',
  surface: '#12141a',
  tooltipBg: '#1a1d25',
  tooltipBorder: '#2f3441',
};

const tooltipStyle = {
  backgroundColor: CHART.tooltipBg,
  border: `1px solid ${CHART.tooltipBorder}`,
  borderRadius: '10px',
  color: '#f2f4f8',
  fontSize: '13px',
};

function seriesColor(index: number) {
  return index < SERIES_COLORS.length ? SERIES_COLORS[index] : MUTED_SERIES;
}

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

function TrendsSkeleton() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <Skeleton className="mb-2 h-9 w-52" />
      <Skeleton className="mb-8 h-5 w-72" />
      <div className="mb-8 flex gap-2">
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-10 w-44" />
      </div>
      <div className="flex flex-col gap-6 lg:flex-row">
        <Skeleton className="min-h-[400px] flex-1" />
        <Card className="p-4 lg:w-64">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="mb-2 h-6 w-full" />
          ))}
        </Card>
      </div>
    </div>
  );
}

export default function TrendsPage() {
  const [activeTab, setActiveTab] = useState<'teams' | 'houseguests'>('teams');
  const [season, setSeason] = useState<Season | null>(null);
  const [brackets, setBrackets] = useState<RankedBracket[]>([]);
  const [rankings, setRankings] = useState<WeeklyRanking[]>([]);
  const [selectedTeams, setSelectedTeams] = useState<Set<string>>(new Set());
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

      const hgs = (hgData || []) as Houseguest[];
      setHouseguests(hgs);
      // exclude the week-0 house-state sentinel from trend weeks
      setWeeklyEvents(((eventsData || []) as WeeklyEvent[]).filter((e) => e.week_number >= 1));
      setBlockSurvivors((survivorsData || []) as BlockSurvivor[]);
      setSelectedHouseguests(new Set(hgs.map((h) => h.id)));

      setLoading(false);
    }
    load();
  }, []);

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

  const teamColorMap = useMemo(() => {
    const map = new Map<string, string>();
    brackets.forEach((b, i) => map.set(b.id, seriesColor(i)));
    return map;
  }, [brackets]);

  const hgColorMap = useMemo(() => {
    const map = new Map<string, string>();
    sortedHouseguests.forEach((h, i) => map.set(h.id, seriesColor(i)));
    return map;
  }, [sortedHouseguests]);

  function selectAllTeams() {
    setSelectedTeams(new Set(brackets.map((b) => b.id)));
  }
  function deselectAllTeams() {
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

  function selectAllHouseguests() {
    setSelectedHouseguests(new Set(sortedHouseguests.map((h) => h.id)));
  }
  function deselectAllHouseguests() {
    setSelectedHouseguests(new Set());
  }
  function toggleHouseguest(id: string) {
    setSelectedHouseguests((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (loading) {
    return <TrendsSkeleton />;
  }

  if (!season) {
    return <NoSeason />;
  }

  const hasTeamData = rankings.length > 0;
  const hasHouseguestData = weeklyEvents.length > 0 && houseguests.length > 0;

  const legendBtnCls =
    'rounded-lg border border-edge bg-raised px-3 py-1.5 text-xs font-medium text-ink-mid transition-colors hover:border-edge-bright hover:text-ink';

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <PageHeader
        eyebrow="Analytics"
        title="Ranking trends"
        subtitle={`${season.name} — week-by-week performance`}
      />

      {/* Tabs */}
      <div className="mb-8 inline-flex gap-1 rounded-xl border border-edge bg-surface p-1">
        {(
          [
            { key: 'teams', label: 'Teams' },
            { key: 'houseguests', label: 'Houseguests' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
              activeTab === tab.key ? 'bg-gold text-black' : 'text-ink-mid hover:text-ink'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Team trends */}
      {activeTab === 'teams' && (
        !hasTeamData ? (
          <EmptyState
            title="No weekly results entered yet"
            hint="Trend data appears after the admin enters the first week's results."
          />
        ) : (
          <div className="flex flex-col gap-6 lg:flex-row">
            <Card className="min-h-[400px] flex-1 p-4">
              <ResponsiveContainer width="100%" height={450}>
                <LineChart data={teamChartData} margin={{ top: 10, right: 20, bottom: 10, left: 10 }}>
                  <CartesianGrid stroke={CHART.grid} vertical={false} />
                  <XAxis
                    dataKey="week"
                    tick={{ fill: CHART.axis, fontSize: 12 }}
                    axisLine={{ stroke: CHART.grid }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: CHART.axis, fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                    label={{ value: 'Total points', angle: -90, position: 'insideLeft', fill: CHART.axis, fontSize: 12 }}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value, name) => {
                      const team = brackets.find((b) => b.id === String(name));
                      return [`${value} pts`, team?.team_name || String(name)];
                    }}
                    itemSorter={(item) => -(item.value as number)}
                    labelStyle={{ color: CHART.axis }}
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
                        dot={false}
                        activeDot={{ r: 5, stroke: CHART.surface, strokeWidth: 2 }}
                        connectNulls
                      />
                    ))}
                </LineChart>
              </ResponsiveContainer>
            </Card>

            <Card className="self-start p-4 lg:w-64">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-dim">Teams</h2>
              <div className="mb-4 flex gap-2">
                <button onClick={selectAllTeams} className={legendBtnCls}>Select all</button>
                <button onClick={deselectAllTeams} className={legendBtnCls}>Clear</button>
              </div>
              <div className="max-h-[500px] space-y-0.5 overflow-y-auto">
                {brackets.map((b) => (
                  <label
                    key={b.id}
                    className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-raised"
                  >
                    <input
                      type="checkbox"
                      checked={selectedTeams.has(b.id)}
                      onChange={() => toggleTeam(b.id)}
                      className="h-4 w-4 rounded accent-gold"
                    />
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: teamColorMap.get(b.id) }}
                      aria-hidden
                    />
                    <span className="flex-1 truncate text-sm text-ink-mid">{b.team_name}</span>
                    <span className="shrink-0 text-xs text-ink-dim tabular-nums">#{b.current_rank}</span>
                  </label>
                ))}
              </div>
            </Card>
          </div>
        )
      )}

      {/* Houseguest trends */}
      {activeTab === 'houseguests' && (
        !hasHouseguestData ? (
          <EmptyState
            title="No weekly results entered yet"
            hint="Houseguest trends appear after the admin enters the first week's results."
          />
        ) : (
          <div className="flex flex-col gap-6 lg:flex-row">
            <Card className="min-h-[400px] flex-1 p-4">
              <ResponsiveContainer width="100%" height={450}>
                <LineChart data={houseguestChartData} margin={{ top: 10, right: 20, bottom: 10, left: 10 }}>
                  <CartesianGrid stroke={CHART.grid} vertical={false} />
                  <XAxis
                    dataKey="week"
                    tick={{ fill: CHART.axis, fontSize: 12 }}
                    axisLine={{ stroke: CHART.grid }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: CHART.axis, fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                    label={{ value: 'Total points', angle: -90, position: 'insideLeft', fill: CHART.axis, fontSize: 12 }}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value, name) => {
                      const hg = sortedHouseguests.find((h) => h.id === String(name));
                      return [`${value} pts`, hg?.name || String(name)];
                    }}
                    itemSorter={(item) => -(item.value as number)}
                    labelStyle={{ color: CHART.axis }}
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
                        dot={false}
                        activeDot={{ r: 5, stroke: CHART.surface, strokeWidth: 2 }}
                        connectNulls={false}
                      />
                    ))}
                </LineChart>
              </ResponsiveContainer>
            </Card>

            <Card className="self-start p-4 lg:w-64">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-dim">Houseguests</h2>
              <div className="mb-4 flex gap-2">
                <button onClick={selectAllHouseguests} className={legendBtnCls}>Select all</button>
                <button onClick={deselectAllHouseguests} className={legendBtnCls}>Clear</button>
              </div>
              <div className="max-h-[500px] space-y-0.5 overflow-y-auto">
                {sortedHouseguests.map((h) => (
                  <label
                    key={h.id}
                    className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-raised"
                  >
                    <input
                      type="checkbox"
                      checked={selectedHouseguests.has(h.id)}
                      onChange={() => toggleHouseguest(h.id)}
                      className="h-4 w-4 rounded accent-gold"
                    />
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: hgColorMap.get(h.id) }}
                      aria-hidden
                    />
                    <span className="flex-1 truncate text-sm text-ink-mid">{h.name}</span>
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${
                        h.status === 'active' ? 'animate-pulse bg-emerald-400' : 'bg-red-400'
                      }`}
                      role="img"
                      aria-label={h.status === 'active' ? 'Active' : 'Out'}
                    />
                  </label>
                ))}
              </div>
            </Card>
          </div>
        )
      )}
    </div>
  );
}
