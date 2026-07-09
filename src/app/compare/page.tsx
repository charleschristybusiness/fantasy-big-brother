'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Season, Houseguest, Bracket, WeeklyEvent, BlockSurvivor } from '@/lib/types';
import { calculateBracketScore } from '@/lib/scoring';
import type { BracketWithPicks } from '@/lib/types';
import { Card, PageHeader, EmptyState, NoSeason, Skeleton, Avatar, selectCls } from '@/components/ui';

// Categorical slots 1 (blue) and 8 (orange) — validated CVD-safe pair on the dark surface
const TEAM_A_COLOR = '#3987e5';
const TEAM_B_COLOR = '#d95926';

function CompareSkeleton() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <Skeleton className="mb-2 h-9 w-48" />
      <Skeleton className="mb-8 h-5 w-72" />
      <div className="mb-8 grid gap-4 sm:grid-cols-2">
        <Skeleton className="h-11" />
        <Skeleton className="h-11" />
      </div>
      <Skeleton className="min-h-[200px]" />
    </div>
  );
}

function CompareContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [season, setSeason] = useState<Season | null>(null);
  const [allBrackets, setAllBrackets] = useState<BracketWithPicks[]>([]);
  const [teamAId, setTeamAId] = useState<string>('');
  const [teamBId, setTeamBId] = useState<string>('');
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

      if (s.brackets_hidden) {
        setLoading(false);
        return;
      }

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

      const houseguests = (hgData || []) as Houseguest[];
      const rawBrackets = (bracketData || []) as Bracket[];
      const events = (eventsData || []) as WeeklyEvent[];
      const survivors = (survivorsData || []) as BlockSurvivor[];

      const scored = rawBrackets
        .map((b) => calculateBracketScore(b, houseguests, events, survivors, s.houseguest_count))
        .sort((a, b) => b.total_score - a.total_score);

      setAllBrackets(scored);

      const aParam = searchParams.get('a');
      const bParam = searchParams.get('b');
      if (aParam && scored.find((b) => b.id === aParam)) setTeamAId(aParam);
      if (bParam && scored.find((b) => b.id === bParam)) setTeamBId(bParam);

      setLoading(false);
    }
    load();
  }, [searchParams]);

  const updateUrl = (aId: string, bId: string) => {
    const params = new URLSearchParams();
    if (aId) params.set('a', aId);
    if (bId) params.set('b', bId);
    const query = params.toString();
    router.replace(query ? `/compare?${query}` : '/compare');
  };

  const handleTeamAChange = (id: string) => {
    setTeamAId(id);
    updateUrl(id, teamBId);
  };

  const handleTeamBChange = (id: string) => {
    setTeamBId(id);
    updateUrl(teamAId, id);
  };

  const teamA = useMemo(() => allBrackets.find((b) => b.id === teamAId) || null, [allBrackets, teamAId]);
  const teamB = useMemo(() => allBrackets.find((b) => b.id === teamBId) || null, [allBrackets, teamBId]);

  const comparison = useMemo(() => {
    if (!teamA || !teamB) return null;

    const aggregate = (team: BracketWithPicks) => ({
      hohWins: team.picks.reduce((sum, p) => sum + p.stats.hoh_wins, 0),
      vetoWins: team.picks.reduce((sum, p) => sum + p.stats.veto_wins, 0),
      blockSurvivals: team.picks.reduce((sum, p) => sum + p.stats.block_survivals, 0),
      activeCount: team.picks.filter((p) => p.houseguest.status === 'active').length,
    });

    return {
      a: { ...aggregate(teamA), total: teamA.total_score },
      b: { ...aggregate(teamB), total: teamB.total_score },
    };
  }, [teamA, teamB]);

  if (loading) {
    return <CompareSkeleton />;
  }

  if (!season) {
    return <NoSeason />;
  }

  if (season.brackets_hidden) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-12">
        <PageHeader
          eyebrow="Head-to-head"
          title="Compare teams"
          subtitle={season.name}
        />
        <EmptyState
          title="Brackets are hidden"
          hint="Head-to-head comparisons unlock once the admin reveals everyone's picks."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <PageHeader
        eyebrow="Head-to-head"
        title="Compare teams"
        subtitle={`${season.name} — two teams, side by side`}
      />

      {/* Team selectors */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2">
        {[
          { label: 'Team A', value: teamAId, onChange: handleTeamAChange, color: TEAM_A_COLOR },
          { label: 'Team B', value: teamBId, onChange: handleTeamBChange, color: TEAM_B_COLOR },
        ].map((sel) => (
          <div key={sel.label}>
            <label className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-ink-dim">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: sel.color }} aria-hidden />
              {sel.label}
            </label>
            <select value={sel.value} onChange={(e) => sel.onChange(e.target.value)} className={selectCls}>
              <option value="">Select a team…</option>
              {allBrackets.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.team_name} ({b.total_score.toFixed(2)} pts)
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>

      {!teamA || !teamB ? (
        <EmptyState title="Select two teams to compare" hint="Pick Team A and Team B above." />
      ) : comparison && (
        <div className="space-y-6">
          {/* Score header */}
          <Card className="p-8">
            <div className="grid grid-cols-3 items-center text-center">
              <div>
                <p className="mb-2 truncate font-semibold text-ink">{teamA.team_name}</p>
                <p
                  className={`text-4xl font-semibold tabular-nums ${
                    comparison.a.total >= comparison.b.total ? 'text-ink' : 'text-ink-dim'
                  }`}
                >
                  {comparison.a.total.toFixed(2)}
                </p>
              </div>
              <p className="text-sm font-bold uppercase tracking-[0.3em] text-ink-dim">vs</p>
              <div>
                <p className="mb-2 truncate font-semibold text-ink">{teamB.team_name}</p>
                <p
                  className={`text-4xl font-semibold tabular-nums ${
                    comparison.b.total >= comparison.a.total ? 'text-ink' : 'text-ink-dim'
                  }`}
                >
                  {comparison.b.total.toFixed(2)}
                </p>
              </div>
            </div>
          </Card>

          {/* Stat breakdown */}
          <Card className="p-6">
            <h2 className="mb-5 text-sm font-semibold uppercase tracking-wider text-ink-mid">
              Stat breakdown
            </h2>
            <div className="space-y-5">
              {[
                { label: 'HOH wins', a: comparison.a.hohWins, b: comparison.b.hohWins },
                { label: 'Veto wins', a: comparison.a.vetoWins, b: comparison.b.vetoWins },
                { label: 'Block survivals', a: comparison.a.blockSurvivals, b: comparison.b.blockSurvivals },
                { label: 'Active players', a: comparison.a.activeCount, b: comparison.b.activeCount },
              ].map((stat) => {
                const total = stat.a + stat.b;
                const aPct = total > 0 ? (stat.a / total) * 100 : 50;

                return (
                  <div key={stat.label}>
                    <p className="mb-1.5 text-center text-xs uppercase tracking-wider text-ink-dim">
                      {stat.label}
                    </p>
                    <div className="flex items-center gap-3">
                      <span
                        className={`w-8 text-right text-sm tabular-nums ${
                          stat.a >= stat.b ? 'font-semibold text-ink' : 'text-ink-dim'
                        }`}
                      >
                        {stat.a}
                      </span>
                      <div className="flex h-2.5 flex-1 gap-0.5 overflow-hidden rounded-full bg-raised">
                        <div
                          className="h-full rounded-l-full transition-all duration-500"
                          style={{ width: `calc(${aPct}% - 1px)`, backgroundColor: TEAM_A_COLOR }}
                        />
                        <div
                          className="h-full flex-1 rounded-r-full transition-all duration-500"
                          style={{ backgroundColor: TEAM_B_COLOR }}
                        />
                      </div>
                      <span
                        className={`w-8 text-left text-sm tabular-nums ${
                          stat.b >= stat.a ? 'font-semibold text-ink' : 'text-ink-dim'
                        }`}
                      >
                        {stat.b}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Pick-by-pick */}
          <Card className="p-6">
            <h2 className="mb-5 text-sm font-semibold uppercase tracking-wider text-ink-mid">
              Pick by pick
            </h2>
            <div className="space-y-3">
              {[0, 1, 2, 3, 4].map((i) => {
                const pickA = teamA.picks[i];
                const pickB = teamB.picks[i];
                const aWins = pickA.pick_score > pickB.pick_score;
                const bWins = pickB.pick_score > pickA.pick_score;

                return (
                  <div key={i} className="rounded-xl border border-edge bg-raised p-4">
                    <p className="mb-3 text-center text-xs uppercase tracking-wider text-ink-dim">
                      Pick {i + 1} &middot; {pickA.multiplier}&times; multiplier
                    </p>
                    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                      {/* Team A pick */}
                      <div className={`text-right ${bWins ? 'opacity-50' : ''}`}>
                        <div className="flex items-center justify-end gap-2.5">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-ink">{pickA.houseguest.name}</p>
                            <p className="text-xs text-ink-dim tabular-nums">
                              {pickA.stats.hoh_wins} HOH &middot; {pickA.stats.veto_wins} V &middot;{' '}
                              {pickA.stats.block_survivals} B
                            </p>
                          </div>
                          <Avatar name={pickA.houseguest.name} photoUrl={pickA.houseguest.photo_url} size="sm" />
                        </div>
                        <p
                          className={`mt-1 text-lg font-semibold tabular-nums ${
                            aWins ? 'text-ink' : 'text-ink-dim'
                          }`}
                        >
                          {pickA.pick_score.toFixed(2)}
                        </p>
                      </div>

                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-ink-dim">vs</p>

                      {/* Team B pick */}
                      <div className={aWins ? 'opacity-50' : ''}>
                        <div className="flex items-center gap-2.5">
                          <Avatar name={pickB.houseguest.name} photoUrl={pickB.houseguest.photo_url} size="sm" />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-ink">{pickB.houseguest.name}</p>
                            <p className="text-xs text-ink-dim tabular-nums">
                              {pickB.stats.hoh_wins} HOH &middot; {pickB.stats.veto_wins} V &middot;{' '}
                              {pickB.stats.block_survivals} B
                            </p>
                          </div>
                        </div>
                        <p
                          className={`mt-1 text-lg font-semibold tabular-nums ${
                            bWins ? 'text-ink' : 'text-ink-dim'
                          }`}
                        >
                          {pickB.pick_score.toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

export default function ComparePage() {
  return (
    <Suspense fallback={<CompareSkeleton />}>
      <CompareContent />
    </Suspense>
  );
}
