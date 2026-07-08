'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Season, Houseguest, WeeklyEvent, BlockSurvivor, HouseguestStats } from '@/lib/types';
import { getHouseguestStats } from '@/lib/scoring';
import {
  Card,
  PageHeader,
  EmptyState,
  NoSeason,
  Skeleton,
  Avatar,
  StatusBadge,
  RankNumber,
  RankChange,
  thCls,
  trCls,
} from '@/components/ui';

function HouseguestsSkeleton() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <Skeleton className="mb-2 h-9 w-64" />
      <Skeleton className="mb-8 h-5 w-80" />
      <Card className="overflow-hidden">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-edge/60 px-4 py-4 last:border-0">
            <Skeleton className="h-5 w-8" />
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="ml-auto h-5 w-40" />
          </div>
        ))}
      </Card>
    </div>
  );
}

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
      // exclude the week-0 house-state sentinel from week-over-week comparisons
      const events = ((eventsData || []) as WeeklyEvent[]).filter((e) => e.week_number >= 1);
      const survivors = (survivorsData || []) as BlockSurvivor[];
      const evictedCount = houseguests.filter((h) => h.status === 'evicted').length;

      const stats = houseguests
        .map((h) => getHouseguestStats(h, events, survivors, s.houseguest_count, evictedCount))
        .sort((a, b) => b.base_score - a.base_score);

      const changes = new Map<string, number | null>();
      const weeks = [...new Set(events.map((e) => e.week_number))].sort((a, b) => a - b);

      if (weeks.length >= 2) {
        const prevWeek = weeks[weeks.length - 2];

        const eventWeekMap = new Map<string, number>();
        for (const event of events) {
          eventWeekMap.set(event.id, event.week_number);
        }

        const prevEvents = events.filter((e) => e.week_number <= prevWeek);
        const prevSurvivors = survivors.filter((bs) => {
          const eventWeek = eventWeekMap.get(bs.weekly_event_id);
          return eventWeek !== undefined && eventWeek <= prevWeek;
        });
        const prevEvictedCount = prevEvents.filter((e) => e.evicted_houseguest_id).length;

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
    return <HouseguestsSkeleton />;
  }

  if (!season) {
    return <NoSeason />;
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <PageHeader
        eyebrow="The house"
        title="Houseguest standings"
        subtitle={`${season.name} — individual performance at 1× multiplier`}
      />

      {standings.length === 0 ? (
        <EmptyState title="No houseguests found" />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-edge">
                  <th className={`${thCls} w-14`}>Rank</th>
                  <th className={`${thCls} w-14 text-center`}>+/-</th>
                  <th className={thCls}>Houseguest</th>
                  <th className={`${thCls} text-center`}>Status</th>
                  <th className={`${thCls} text-right`}>HOH</th>
                  <th className={`${thCls} text-right`}>Veto</th>
                  <th className={`${thCls} text-right`}>Block</th>
                  <th className={`${thCls} text-right`}>Place</th>
                  <th className={`${thCls} text-right`}>Total</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((s, index) => {
                  const rank = index + 1;
                  return (
                    <tr
                      key={s.houseguest.id}
                      className={`${trCls} ${rank === 1 ? 'bg-gold/[0.04]' : ''}`}
                    >
                      <td className="px-4 py-3">
                        <RankNumber rank={rank} />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <RankChange change={rankChanges.get(s.houseguest.id)} />
                      </td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-3">
                          <Avatar name={s.houseguest.name} photoUrl={s.houseguest.photo_url} size="sm" />
                          <span className="font-medium text-ink">{s.houseguest.name}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <StatusBadge status={s.houseguest.status} />
                      </td>
                      <td className="px-4 py-3 text-right text-ink-mid tabular-nums">{s.hoh_wins}</td>
                      <td className="px-4 py-3 text-right text-ink-mid tabular-nums">{s.veto_wins}</td>
                      <td className="px-4 py-3 text-right text-ink-mid tabular-nums">{s.block_survivals}</td>
                      <td className="px-4 py-3 text-right text-ink-mid tabular-nums">{s.placement_points}</td>
                      <td className="px-4 py-3 text-right font-semibold text-gold tabular-nums">
                        {s.base_score}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <p className="mt-4 text-center text-sm text-ink-dim tabular-nums">
        {standings.length} houseguest{standings.length !== 1 ? 's' : ''} total
      </p>
    </div>
  );
}
