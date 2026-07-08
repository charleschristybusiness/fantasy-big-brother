'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Houseguest, Bracket, WeeklyEvent, BlockSurvivor, Season } from '@/lib/types';
import { calculateBracketScore } from '@/lib/scoring';
import type { BracketWithPicks } from '@/lib/types';
import { Card, Skeleton, Avatar, StatusBadge, RankNumber } from '@/components/ui';

function TeamDetailSkeleton() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <Skeleton className="mb-6 h-4 w-32" />
      <Card className="mb-6 p-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-9 w-32" />
        </div>
      </Card>
      {Array.from({ length: 5 }).map((_, i) => (
        <Card key={i} className="mb-4 p-6">
          <div className="mb-4 flex items-center gap-4">
            <Skeleton className="h-12 w-12 rounded-full" />
            <div className="flex-1">
              <Skeleton className="mb-2 h-5 w-32" />
              <Skeleton className="h-4 w-40" />
            </div>
            <Skeleton className="h-7 w-20" />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, j) => (
              <Skeleton key={j} className="h-20" />
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}

export default function TeamDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [bracket, setBracket] = useState<BracketWithPicks | null>(null);
  const [rank, setRank] = useState<number | null>(null);
  const [teamCount, setTeamCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: bracketData } = await supabase
        .from('brackets')
        .select('*')
        .eq('id', id)
        .single();

      if (!bracketData) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      const b = bracketData as Bracket;

      const { data: seasonData } = await supabase
        .from('seasons')
        .select('*')
        .eq('id', b.season_id)
        .single();

      const season = seasonData as Season;

      const [
        { data: hgData },
        { data: allBracketsData },
        { data: eventsData },
        { data: survivorsData },
      ] = await Promise.all([
        supabase.from('houseguests').select('*').eq('season_id', b.season_id),
        supabase.from('brackets').select('*').eq('season_id', b.season_id),
        supabase.from('weekly_events').select('*').eq('season_id', b.season_id),
        supabase.from('block_survivors').select('*, weekly_events!inner(season_id)').eq('weekly_events.season_id', b.season_id),
      ]);

      const houseguests = (hgData || []) as Houseguest[];
      const allBrackets = (allBracketsData || []) as Bracket[];
      const events = (eventsData || []) as WeeklyEvent[];
      const survivors = (survivorsData || []) as BlockSurvivor[];

      const allScored = allBrackets
        .map((br) => calculateBracketScore(br, houseguests, events, survivors, season.houseguest_count))
        .sort((a, b2) => b2.total_score - a.total_score);

      const position = allScored.findIndex((br) => br.id === b.id);
      setRank(position >= 0 ? position + 1 : null);
      setTeamCount(allScored.length);
      setBracket(allScored[position] ?? calculateBracketScore(b, houseguests, events, survivors, season.houseguest_count));
      setLoading(false);
    }
    load();
  }, [id]);

  if (loading) {
    return <TeamDetailSkeleton />;
  }

  if (notFound || !bracket) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center">
        <h1 className="mb-3 text-3xl font-bold tracking-tight text-ink">Team not found</h1>
        <Link href="/leaderboard" className="text-sm font-medium text-gold transition-colors hover:text-gold-bright">
          Back to leaderboard &rarr;
        </Link>
      </div>
    );
  }

  const maxPickScore = Math.max(...bracket.picks.map((p) => p.pick_score), 1);

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <Link
        href="/leaderboard"
        className="mb-6 block text-sm text-ink-mid transition-colors hover:text-ink"
      >
        &larr; Back to leaderboard
      </Link>

      {/* Team header */}
      <Card className="mb-6 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.15em] text-gold">Team</p>
            <h1 className="text-3xl font-bold tracking-tight text-ink">{bracket.team_name}</h1>
            {rank !== null && (
              <p className="mt-1.5 text-sm text-ink-mid">
                Ranked <RankNumber rank={rank} /> of {teamCount} team{teamCount !== 1 ? 's' : ''}
              </p>
            )}
          </div>
          <div className="text-right">
            <p className="text-4xl font-semibold text-gold tabular-nums">
              {bracket.total_score.toFixed(2)}
            </p>
            <p className="mt-0.5 text-sm text-ink-dim">total points</p>
          </div>
        </div>
      </Card>

      {/* Picks */}
      <div className="space-y-4">
        {bracket.picks.map((pick) => {
          const share = Math.max(0, (pick.pick_score / maxPickScore) * 100);
          return (
            <Card
              key={pick.position}
              className={`p-6 transition-colors hover:border-edge-bright ${
                pick.position === 1 ? 'border-gold/20' : ''
              }`}
            >
              <div className="mb-4 flex items-center justify-between gap-4">
                <div className="flex min-w-0 items-center gap-4">
                  <Avatar name={pick.houseguest.name} photoUrl={pick.houseguest.photo_url} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2.5">
                      <h3 className="truncate text-lg font-semibold text-ink">
                        {pick.houseguest.name}
                      </h3>
                      <StatusBadge status={pick.houseguest.status} />
                    </div>
                    <p className="mt-0.5 text-sm text-ink-mid">
                      Pick {pick.position} &middot;{' '}
                      <span className="font-medium text-ink tabular-nums">{pick.multiplier}&times;</span>{' '}
                      multiplier
                    </p>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xl font-semibold text-gold tabular-nums">
                    {pick.pick_score.toFixed(2)}
                  </p>
                  <p className="text-xs text-ink-dim tabular-nums">
                    {pick.stats.base_score} &times; {pick.multiplier}
                  </p>
                </div>
              </div>

              {/* Contribution meter */}
              <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-raised" aria-hidden>
                <div
                  className="h-full rounded-full bg-gold transition-all duration-500"
                  style={{ width: `${share}%` }}
                />
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { label: 'HOH wins', value: pick.stats.hoh_wins, pts: pick.stats.hoh_wins * 7 },
                  { label: 'Veto wins', value: pick.stats.veto_wins, pts: pick.stats.veto_wins * 5 },
                  { label: 'Block survived', value: pick.stats.block_survivals, pts: pick.stats.block_survivals * 2 },
                  { label: 'Placement', value: pick.stats.placement_points, pts: null },
                ].map((stat) => (
                  <div key={stat.label} className="rounded-xl border border-edge bg-raised p-3">
                    <p className="text-xs uppercase tracking-wider text-ink-dim">{stat.label}</p>
                    <p className="mt-1 text-lg font-semibold text-ink tabular-nums">{stat.value}</p>
                    {stat.pts !== null && (
                      <p className="text-xs text-ink-dim tabular-nums">{stat.pts} pts</p>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
