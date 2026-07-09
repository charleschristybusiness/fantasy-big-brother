'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Season, Houseguest, Bracket, WeeklyEvent, BlockSurvivor, WeeklyRanking } from '@/lib/types';
import { calculateBracketScore } from '@/lib/scoring';
import {
  Card,
  PageHeader,
  EmptyState,
  NoSeason,
  Skeleton,
  RankNumber,
  RankChange,
  IconEye,
  inputCls,
  thCls,
  trCls,
} from '@/components/ui';

function LeaderboardSkeleton() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <Skeleton className="mb-2 h-9 w-48" />
      <Skeleton className="mb-8 h-5 w-32" />
      <Skeleton className="mb-8 h-11 w-full" />
      <div className="mb-8 grid grid-cols-3 items-end gap-4">
        <Skeleton className="h-36" />
        <Skeleton className="h-44" />
        <Skeleton className="h-32" />
      </div>
      <Card className="overflow-hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-edge/60 px-4 py-4 last:border-0">
            <Skeleton className="h-5 w-8" />
            <Skeleton className="h-5 w-8" />
            <Skeleton className="h-5 flex-1" />
            <Skeleton className="h-5 w-20" />
          </div>
        ))}
      </Card>
    </div>
  );
}

const PODIUM_STYLES = [
  {
    // 1st — center on desktop
    wrap: 'sm:order-2',
    card: 'border-gold/30 bg-gradient-to-b from-gold/[0.07] to-transparent',
    chip: 'bg-gold text-black',
    score: 'text-gold text-3xl',
  },
  {
    // 2nd — left
    wrap: 'sm:order-1 sm:mt-8',
    card: 'border-silver/15 bg-gradient-to-b from-silver/[0.04] to-transparent',
    chip: 'bg-raised text-silver border border-silver/30',
    score: 'text-silver text-2xl',
  },
  {
    // 3rd — right
    wrap: 'sm:order-3 sm:mt-12',
    card: 'border-bronze/15 bg-gradient-to-b from-bronze/[0.04] to-transparent',
    chip: 'bg-raised text-bronze border border-bronze/30',
    score: 'text-bronze text-2xl',
  },
];

interface DisplayBracket {
  id: string;
  team_name: string;
  total_score: number;
}

export default function LeaderboardPage() {
  const [season, setSeason] = useState<Season | null>(null);
  const [brackets, setBrackets] = useState<DisplayBracket[]>([]);
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

      let scored: DisplayBracket[];
      let allRankings: WeeklyRanking[];

      if (s.brackets_hidden) {
        // Blind-bracket mode: only names and stored totals ever reach the browser
        const [{ data: bracketData }, { data: rankingsData }] = await Promise.all([
          supabase
            .from('brackets')
            .select('id, team_name, total_score')
            .eq('season_id', s.id)
            .order('total_score', { ascending: false }),
          supabase.from('weekly_rankings').select('*').eq('season_id', s.id).order('week_number', { ascending: true }),
        ]);
        scored = (bracketData || []) as DisplayBracket[];
        allRankings = (rankingsData || []) as WeeklyRanking[];
      } else {
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
        allRankings = (rankingsData || []) as WeeklyRanking[];

        scored = rawBrackets
          .map((b) => calculateBracketScore(b, houseguests, events, survivors, s.houseguest_count))
          .sort((a, b) => b.total_score - a.total_score);
      }

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
    return <NoSeason />;
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <PageHeader eyebrow="Standings" title="Leaderboard" subtitle={season.name} />

      {season.brackets_hidden && (
        <div className="mb-6 flex items-center gap-3 rounded-xl border border-gold/20 bg-gold/[0.06] px-4 py-3 text-sm text-ink-mid">
          <IconEye className="shrink-0 text-gold" />
          <span>
            Picks are hidden until the admin reveals brackets. You can still view your own picks
            from your team page with your bracket password.
          </span>
        </div>
      )}

      <div className="mb-8">
        <input
          type="text"
          placeholder="Search by team name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={inputCls}
          aria-label="Search by team name"
        />
      </div>

      {/* Podium — top 3 */}
      {showPodium && (
        <div className="mb-8 grid gap-4 sm:grid-cols-3 sm:items-start">
          {brackets.slice(0, 3).map((bracket, i) => {
            const style = PODIUM_STYLES[i];
            return (
              <div key={bracket.id} className={style.wrap}>
                <Link href={`/team/${bracket.id}`} className="block">
                  <Card
                    className={`p-6 text-center transition-colors hover:border-edge-bright ${style.card}`}
                  >
                    <span
                      className={`mx-auto mb-3 flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold tabular-nums ${style.chip}`}
                    >
                      {i + 1}
                    </span>
                    <h3 className="truncate font-semibold text-ink">{bracket.team_name}</h3>
                    <p className={`mt-1.5 font-semibold tabular-nums ${style.score}`}>
                      {bracket.total_score.toFixed(2)}
                    </p>
                    <p className="mt-1 text-sm">
                      <RankChange change={rankChanges.get(bracket.id)} />
                    </p>
                  </Card>
                </Link>
              </div>
            );
          })}
        </div>
      )}

      {/* Table */}
      {filtered.length === 0 ? (
        <EmptyState
          title={brackets.length === 0 ? 'No brackets submitted yet' : 'No matching teams'}
          hint={brackets.length === 0 ? 'Standings appear once the first bracket is in.' : 'Try a different search.'}
        />
      ) : tableData.length > 0 ? (
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
              {tableData.map((bracket) => {
                const globalRank = brackets.indexOf(bracket) + 1;
                return (
                  <tr key={bracket.id} className={trCls}>
                    <td className="px-4 py-3.5">
                      <RankNumber rank={globalRank} />
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <RankChange change={rankChanges.get(bracket.id)} />
                    </td>
                    <td className="px-4 py-3.5">
                      <Link
                        href={`/team/${bracket.id}`}
                        className="font-medium text-ink transition-colors hover:text-gold"
                      >
                        {bracket.team_name}
                      </Link>
                    </td>
                    <td className="px-4 py-3.5 text-right font-semibold text-gold tabular-nums">
                      {bracket.total_score.toFixed(2)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      ) : null}

      <p className="mt-4 text-center text-sm text-ink-dim tabular-nums">
        {brackets.length} team{brackets.length !== 1 ? 's' : ''} total
      </p>
    </div>
  );
}
