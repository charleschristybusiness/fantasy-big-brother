'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Season, Houseguest, Bracket, WeeklyEvent, BlockSurvivor } from '@/lib/types';
import { calculateBracketScore } from '@/lib/scoring';
import {
  Card,
  PageHeader,
  EmptyState,
  NoSeason,
  Skeleton,
  RankNumber,
  selectCls,
  thCls,
} from '@/components/ui';

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
    <div className="mx-auto max-w-7xl px-4 py-12">
      <Skeleton className="mb-2 h-9 w-48" />
      <Skeleton className="mb-8 h-5 w-72" />
      <div className="flex flex-col gap-6 lg:flex-row">
        <Skeleton className="min-h-[400px] lg:w-96" />
        <Skeleton className="min-h-[400px] flex-1" />
      </div>
    </div>
  );
}

let nextWeekId = 1;

const smallLabelCls = 'mb-1.5 block text-xs font-medium uppercase tracking-wider text-ink-dim';

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
      // exclude the week-0 house-state sentinel from the forecast baseline
      const evts = ((eventsData || []) as WeeklyEvent[]).filter((e) => e.week_number >= 1);
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
    for (const hg of houseguests) {
      if (hg.status === 'evicted') evictedIds.add(hg.id);
    }
    const result: Map<number, Set<string>> = new Map();
    for (let i = 0; i < hypotheticalWeeks.length; i++) {
      result.set(hypotheticalWeeks[i].id, new Set(evictedIds));
      if (hypotheticalWeeks[i].evictedId) {
        evictedIds.add(hypotheticalWeeks[i].evictedId);
      }
    }
    return result;
  }, [hypotheticalWeeks, houseguests]);

  function getActiveForWeek(weekId: number): Houseguest[] {
    const evicted = evictedByWeek.get(weekId) || new Set();
    return houseguests.filter((hg) => !evicted.has(hg.id));
  }

  // Compute hypothetical leaderboard
  const hypotheticalScored = useMemo(() => {
    if (!season || brackets.length === 0) return [];

    const realEvictedCount = houseguests.filter((h) => h.status === 'evicted').length;
    let hypoEvictedCount = realEvictedCount;

    const hypoHouseguests = houseguests.map((hg) => ({ ...hg }));

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

      if (week.evictedId) {
        hypoEvictedCount++;
        const hg = hypoHouseguests.find((h) => h.id === week.evictedId);
        if (hg && hg.status === 'active') {
          hg.status = 'evicted';
          hg.eviction_order = hypoEvictedCount;
        }
      }

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
    setHypotheticalWeeks((prev) => prev.filter((w) => w.id !== weekId));
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
    return <NoSeason />;
  }

  const hasHypotheticalInput = hypotheticalWeeks.some(
    (w) => w.hohWinnerId || w.vetoWinnerId || w.evictedId || w.blockSurvivorIds.length > 0
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-12">
      <PageHeader
        eyebrow="What if"
        title="Forecast"
        subtitle={`${season.name} — simulate future weeks and watch the standings shift`}
      />

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Left: scenario builder */}
        <div className="shrink-0 space-y-4 lg:w-[400px]">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-dim">
              Scenario builder
            </h2>
            <button
              onClick={resetAll}
              className="rounded-lg border border-edge bg-raised px-3 py-1.5 text-xs font-medium text-ink-mid transition-colors hover:border-edge-bright hover:text-ink"
            >
              Reset all
            </button>
          </div>

          {hypotheticalWeeks.map((week) => {
            const activeHGs = getActiveForWeek(week.id);

            return (
              <Card key={week.id} className="p-5">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="font-semibold text-ink">
                    Week {week.weekNumber}
                    <span className="ml-2 rounded-full border border-gold/20 bg-gold/10 px-2 py-0.5 text-xs font-medium text-gold">
                      Hypothetical
                    </span>
                  </h3>
                  {hypotheticalWeeks.length > 1 && (
                    <button
                      onClick={() => removeWeek(week.id)}
                      className="text-xs font-medium text-red-400 transition-colors hover:text-red-300"
                    >
                      Remove
                    </button>
                  )}
                </div>

                <div className="space-y-3.5">
                  <div>
                    <label className={smallLabelCls}>HOH winner</label>
                    <select
                      value={week.hohWinnerId}
                      onChange={(e) => updateWeek(week.id, { hohWinnerId: e.target.value })}
                      className={selectCls}
                    >
                      <option value="">None</option>
                      {activeHGs.map((hg) => (
                        <option key={hg.id} value={hg.id}>{hg.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className={smallLabelCls}>Veto winner</label>
                    <select
                      value={week.vetoWinnerId}
                      onChange={(e) => updateWeek(week.id, { vetoWinnerId: e.target.value })}
                      className={selectCls}
                    >
                      <option value="">None</option>
                      {activeHGs.map((hg) => (
                        <option key={hg.id} value={hg.id}>{hg.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className={smallLabelCls}>Evicted</label>
                    <select
                      value={week.evictedId}
                      onChange={(e) => updateWeek(week.id, { evictedId: e.target.value })}
                      className={selectCls}
                    >
                      <option value="">None</option>
                      {activeHGs.map((hg) => (
                        <option key={hg.id} value={hg.id}>{hg.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className={smallLabelCls}>Block survivors</label>
                    <div className="grid max-h-[200px] grid-cols-2 gap-1.5 overflow-y-auto">
                      {activeHGs.map((hg) => (
                        <label
                          key={hg.id}
                          className={`flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs transition-colors ${
                            week.blockSurvivorIds.includes(hg.id)
                              ? 'border-gold/40 bg-gold/10'
                              : 'border-edge bg-raised hover:border-edge-bright'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={week.blockSurvivorIds.includes(hg.id)}
                            onChange={() => toggleBlockSurvivor(week.id, hg.id)}
                            className="h-3.5 w-3.5 accent-gold"
                          />
                          <span className="truncate text-ink-mid">{hg.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}

          <button
            onClick={addWeek}
            className="w-full rounded-xl border border-dashed border-edge-bright py-3 text-sm font-medium text-ink-mid transition-colors hover:border-gold/40 hover:text-ink"
          >
            + Add another week
          </button>
        </div>

        {/* Right: hypothetical leaderboard */}
        <div className="flex-1">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-dim">
              {hasHypotheticalInput ? 'Hypothetical leaderboard' : 'Current leaderboard'}
            </h2>
            {hasHypotheticalInput && (
              <span className="rounded-full border border-gold/20 bg-gold/10 px-2.5 py-1 text-xs font-medium text-gold">
                What-if mode
              </span>
            )}
          </div>

          {hypotheticalScored.length === 0 ? (
            <EmptyState title="No brackets submitted yet" />
          ) : (
            <Card className="overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-edge">
                    <th className={`${thCls} w-16`}>Rank</th>
                    <th className={`${thCls} w-16 text-center`}>+/-</th>
                    <th className={thCls}>Team</th>
                    <th className={`${thCls} text-right`}>Score</th>
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
                        className={`border-b border-edge/60 transition-colors last:border-0 ${
                          moved && change > 0
                            ? 'bg-emerald-500/[0.05] hover:bg-emerald-500/10'
                            : moved && change < 0
                            ? 'bg-red-500/[0.05] hover:bg-red-500/10'
                            : 'hover:bg-white/[0.02]'
                        }`}
                      >
                        <td className="px-4 py-3">
                          <RankNumber rank={hypoRank} />
                        </td>
                        <td className="px-4 py-3 text-center">
                          {!hasHypotheticalInput || change === 0 ? (
                            <span className="text-ink-dim">&mdash;</span>
                          ) : change > 0 ? (
                            <span className="font-semibold text-emerald-400 tabular-nums">&uarr;{change}</span>
                          ) : (
                            <span className="font-semibold text-red-400 tabular-nums">&darr;{Math.abs(change)}</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            href={`/team/${bracket.id}`}
                            className="font-medium text-ink transition-colors hover:text-gold"
                          >
                            {bracket.team_name}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-gold tabular-nums">
                          {bracket.total_score.toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>
          )}

          <p className="mt-4 text-center text-sm text-ink-dim tabular-nums">
            {brackets.length} team{brackets.length !== 1 ? 's' : ''} total
          </p>
        </div>
      </div>
    </div>
  );
}
