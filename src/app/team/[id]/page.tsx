'use client';

import { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Houseguest, Bracket, WeeklyEvent, BlockSurvivor, Season } from '@/lib/types';
import { calculateBracketScore } from '@/lib/scoring';
import type { BracketWithPicks } from '@/lib/types';
import {
  Card,
  Skeleton,
  Avatar,
  StatusBadge,
  RankNumber,
  IconEye,
  inputCls,
  selectCls,
  btnPrimary,
  btnSecondary,
} from '@/components/ui';

const MULTIPLIERS = ['1.5×', '1.25×', '1.0×', '0.75×', '0.5×'];

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

interface BracketSummary {
  season_id: string;
  team_name: string;
  total_score: number;
}

export default function TeamDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [bracket, setBracket] = useState<BracketWithPicks | null>(null);
  const [summary, setSummary] = useState<BracketSummary | null>(null);
  const [season, setSeason] = useState<Season | null>(null);
  const [houseguests, setHouseguests] = useState<Houseguest[]>([]);
  const [rank, setRank] = useState<number | null>(null);
  const [teamCount, setTeamCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Reveal state (used while the admin has brackets hidden)
  const [revealPassword, setRevealPassword] = useState('');
  const [revealing, setRevealing] = useState(false);
  const [revealError, setRevealError] = useState('');
  const [verifiedPassword, setVerifiedPassword] = useState('');

  // Edit state
  const [editing, setEditing] = useState(false);
  const [editPassword, setEditPassword] = useState('');
  const [editTeamName, setEditTeamName] = useState('');
  const [editPicks, setEditPicks] = useState<(string | '')[]>(['', '', '', '', '']);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState('');

  const activeHouseguests = houseguests
    .filter((h) => h.status === 'active')
    .sort((a, b) => a.name.localeCompare(b.name));

  const load = useCallback(async () => {
    // Minimal columns first — while brackets are hidden, picks must never
    // reach the browser without a password
    const { data: minimalData } = await supabase
      .from('brackets')
      .select('id, season_id, team_name, total_score')
      .eq('id', id)
      .single();

    if (!minimalData) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    const minimal = minimalData as { id: string } & BracketSummary;
    setSummary({
      season_id: minimal.season_id,
      team_name: minimal.team_name,
      total_score: Number(minimal.total_score),
    });

    const { data: seasonData } = await supabase
      .from('seasons')
      .select('*')
      .eq('id', minimal.season_id)
      .single();

    const s = seasonData as Season;
    setSeason(s);

    const { data: hgData } = await supabase
      .from('houseguests')
      .select('*')
      .eq('season_id', minimal.season_id);
    const hgs = (hgData || []) as Houseguest[];
    setHouseguests(hgs);

    if (s.brackets_hidden) {
      // Rank from stored totals only
      const { data: allMin } = await supabase
        .from('brackets')
        .select('id')
        .eq('season_id', minimal.season_id)
        .order('total_score', { ascending: false });
      const ids = ((allMin || []) as { id: string }[]).map((r) => r.id);
      const pos = ids.indexOf(minimal.id);
      setRank(pos >= 0 ? pos + 1 : null);
      setTeamCount(ids.length);
      setBracket(null);
      setLoading(false);
      return;
    }

    const [
      { data: bracketData },
      { data: allBracketsData },
      { data: eventsData },
      { data: survivorsData },
    ] = await Promise.all([
      supabase.from('brackets').select('*').eq('id', id).single(),
      supabase.from('brackets').select('*').eq('season_id', minimal.season_id),
      supabase.from('weekly_events').select('*').eq('season_id', minimal.season_id),
      supabase.from('block_survivors').select('*, weekly_events!inner(season_id)').eq('weekly_events.season_id', minimal.season_id),
    ]);

    const b = bracketData as Bracket;
    const allBrackets = (allBracketsData || []) as Bracket[];
    const events = (eventsData || []) as WeeklyEvent[];
    const survivors = (survivorsData || []) as BlockSurvivor[];

    const allScored = allBrackets
      .map((br) => calculateBracketScore(br, hgs, events, survivors, s.houseguest_count))
      .sort((a, b2) => b2.total_score - a.total_score);

    const position = allScored.findIndex((br) => br.id === b.id);
    setRank(position >= 0 ? position + 1 : null);
    setTeamCount(allScored.length);
    setBracket(allScored[position] ?? calculateBracketScore(b, hgs, events, survivors, s.houseguest_count));
    setLoading(false);
  }, [id]);

  useEffect(() => {
    async function init() {
      await load();
    }
    init();
  }, [load]);

  const revealBracket = async (e: React.FormEvent) => {
    e.preventDefault();
    setRevealError('');
    if (!revealPassword) {
      setRevealError('Enter your bracket password.');
      return;
    }
    if (!season || !summary) return;

    setRevealing(true);
    try {
      const response = await fetch('/api/brackets/reveal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bracket_id: id, password: revealPassword }),
      });
      const result = await response.json();
      if (!response.ok) {
        setRevealError(result.error || 'Failed to reveal bracket.');
        setRevealing(false);
        return;
      }

      const [{ data: eventsData }, { data: survivorsData }] = await Promise.all([
        supabase.from('weekly_events').select('*').eq('season_id', summary.season_id),
        supabase.from('block_survivors').select('*, weekly_events!inner(season_id)').eq('weekly_events.season_id', summary.season_id),
      ]);

      const raw: Bracket = {
        id,
        season_id: summary.season_id,
        team_name: summary.team_name,
        pick_1_houseguest_id: result.picks[0],
        pick_2_houseguest_id: result.picks[1],
        pick_3_houseguest_id: result.picks[2],
        pick_4_houseguest_id: result.picks[3],
        pick_5_houseguest_id: result.picks[4],
        total_score: summary.total_score,
        created_at: '',
      };
      setBracket(
        calculateBracketScore(
          raw,
          houseguests,
          (eventsData || []) as WeeklyEvent[],
          (survivorsData || []) as BlockSurvivor[],
          season.houseguest_count
        )
      );
      setVerifiedPassword(revealPassword);
      setRevealPassword('');
      setRevealing(false);
    } catch {
      setRevealError('Something went wrong. Please try again.');
      setRevealing(false);
    }
  };

  const startEditing = () => {
    if (!bracket) return;
    setEditTeamName(bracket.team_name);
    setEditPicks(bracket.picks.map((p) => p.houseguest.id));
    setEditPassword(verifiedPassword);
    setEditError('');
    setEditing(true);
  };

  const handleEditPickChange = (index: number, value: string) => {
    const next = [...editPicks];
    next[index] = value;
    setEditPicks(next);
  };

  const getAvailableHouseguests = (currentIndex: number) => {
    const selectedIds = editPicks.filter((p, i) => p && i !== currentIndex);
    return activeHouseguests.filter((hg) => !selectedIds.includes(hg.id));
  };

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditError('');

    if (!editTeamName.trim()) {
      setEditError('Please enter a team name.');
      return;
    }
    if (!editPassword) {
      setEditError('Enter your bracket password.');
      return;
    }
    if (editPicks.some((p) => !p)) {
      setEditError('Please select all 5 picks.');
      return;
    }

    setSavingEdit(true);
    try {
      const response = await fetch('/api/brackets/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bracket_id: id,
          password: editPassword,
          team_name: editTeamName.trim(),
          picks: editPicks,
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        setEditError(result.error || 'Failed to update bracket.');
        setSavingEdit(false);
        return;
      }
      setEditing(false);
      setSavingEdit(false);

      if (season?.brackets_hidden) {
        // Stay revealed after saving: recompute locally with the new picks
        const [{ data: eventsData }, { data: survivorsData }, { data: freshMin }] = await Promise.all([
          supabase.from('weekly_events').select('*').eq('season_id', season.id),
          supabase.from('block_survivors').select('*, weekly_events!inner(season_id)').eq('weekly_events.season_id', season.id),
          supabase.from('brackets').select('total_score').eq('id', id).single(),
        ]);
        const raw: Bracket = {
          id,
          season_id: season.id,
          team_name: editTeamName.trim(),
          pick_1_houseguest_id: editPicks[0] as string,
          pick_2_houseguest_id: editPicks[1] as string,
          pick_3_houseguest_id: editPicks[2] as string,
          pick_4_houseguest_id: editPicks[3] as string,
          pick_5_houseguest_id: editPicks[4] as string,
          total_score: Number(freshMin?.total_score ?? 0),
          created_at: '',
        };
        setSummary({ season_id: season.id, team_name: raw.team_name, total_score: raw.total_score });
        setBracket(
          calculateBracketScore(
            raw,
            houseguests,
            (eventsData || []) as WeeklyEvent[],
            (survivorsData || []) as BlockSurvivor[],
            season.houseguest_count
          )
        );
      } else {
        setLoading(true);
        await load();
      }
    } catch {
      setEditError('Something went wrong. Please try again.');
      setSavingEdit(false);
    }
  };

  if (loading) {
    return <TeamDetailSkeleton />;
  }

  if (notFound || !summary) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center">
        <h1 className="mb-3 text-3xl font-bold tracking-tight text-ink">Team not found</h1>
        <Link href="/leaderboard" className="text-sm font-medium text-gold transition-colors hover:text-gold-bright">
          Back to leaderboard &rarr;
        </Link>
      </div>
    );
  }

  const teamName = bracket?.team_name ?? summary.team_name;
  const totalScore = bracket?.total_score ?? summary.total_score;
  const canEdit = Boolean(season && !season.submissions_locked && bracket);
  const maxPickScore = bracket ? Math.max(...bracket.picks.map((p) => p.pick_score), 1) : 1;

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
            <h1 className="text-3xl font-bold tracking-tight text-ink">{teamName}</h1>
            {rank !== null && (
              <p className="mt-1.5 text-sm text-ink-mid">
                Ranked <RankNumber rank={rank} /> of {teamCount} team{teamCount !== 1 ? 's' : ''}
              </p>
            )}
          </div>
          <div className="text-right">
            <p className="text-4xl font-semibold text-gold tabular-nums">
              {totalScore.toFixed(2)}
            </p>
            <p className="mt-0.5 text-sm text-ink-dim">total points</p>
          </div>
        </div>
        {canEdit && !editing && (
          <div className="mt-5 flex items-center justify-between gap-3 border-t border-edge pt-4">
            <p className="text-xs text-ink-dim">
              Rosters are open — you can change your picks with your bracket password.
            </p>
            <button onClick={startEditing} className={btnSecondary}>
              Edit bracket
            </button>
          </div>
        )}
      </Card>

      {/* Hidden-brackets reveal */}
      {season?.brackets_hidden && !bracket && (
        <Card className="mb-6 border-gold/20 p-6">
          <div className="mb-1 flex items-center gap-2.5">
            <IconEye className="text-gold" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-mid">
              Picks hidden
            </h2>
          </div>
          <p className="mb-5 text-xs text-ink-dim">
            The admin is keeping all brackets secret for now. Enter your bracket password to view
            {season.submissions_locked ? '' : ' and edit'} your own picks — nobody else can see them.
          </p>
          <form onSubmit={revealBracket} className="flex flex-wrap gap-3">
            <input
              type="password"
              value={revealPassword}
              onChange={(e) => setRevealPassword(e.target.value)}
              className={`${inputCls} max-w-xs flex-1 basis-52`}
              placeholder="Your bracket password"
              autoComplete="current-password"
              aria-label="Bracket password"
            />
            <button type="submit" disabled={revealing} className={btnPrimary}>
              {revealing ? 'Checking…' : 'Reveal my picks'}
            </button>
          </form>
          {revealError && (
            <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3.5 text-sm text-red-400" role="alert">
              {revealError}
            </div>
          )}
        </Card>
      )}

      {/* Edit panel */}
      {canEdit && editing && (
        <Card className="mb-6 border-gold/20 p-6">
          <h2 className="mb-1 text-sm font-semibold uppercase tracking-wider text-ink-mid">
            Edit bracket
          </h2>
          <p className="mb-5 text-xs text-ink-dim">
            Changes save immediately and your score is recalculated. Editable until the admin locks
            rosters.
          </p>
          <form onSubmit={saveEdit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="edit-team-name"
                  className="mb-2 block text-xs font-medium uppercase tracking-wider text-ink-dim"
                >
                  Team name
                </label>
                <input
                  id="edit-team-name"
                  type="text"
                  value={editTeamName}
                  onChange={(e) => setEditTeamName(e.target.value)}
                  className={inputCls}
                  maxLength={50}
                />
              </div>
              <div>
                <label
                  htmlFor="edit-password"
                  className="mb-2 block text-xs font-medium uppercase tracking-wider text-ink-dim"
                >
                  Bracket password
                </label>
                <input
                  id="edit-password"
                  type="password"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  className={inputCls}
                  placeholder="The password you set at submission"
                  autoComplete="current-password"
                />
              </div>
            </div>

            <div className="space-y-3">
              {[0, 1, 2, 3, 4].map((index) => (
                <div key={index} className="flex items-center gap-3">
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold tabular-nums ${
                      index === 0 ? 'bg-gold text-black' : 'border border-edge bg-raised text-ink-mid'
                    }`}
                    aria-hidden
                  >
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <select
                      value={editPicks[index]}
                      onChange={(e) => handleEditPickChange(index, e.target.value)}
                      className={selectCls}
                      aria-label={`Pick ${index + 1} (${MULTIPLIERS[index]} multiplier)`}
                    >
                      <option value="">Select a houseguest…</option>
                      {getAvailableHouseguests(index).map((hg) => (
                        <option key={hg.id} value={hg.id}>
                          {hg.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <span className="w-12 shrink-0 text-right text-xs text-ink-dim tabular-nums">
                    {MULTIPLIERS[index]}
                  </span>
                </div>
              ))}
            </div>

            {editError && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3.5 text-sm text-red-400" role="alert">
                {editError}
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              <button type="submit" disabled={savingEdit} className={btnPrimary}>
                {savingEdit ? 'Saving…' : 'Save changes'}
              </button>
              <button type="button" onClick={() => setEditing(false)} className={btnSecondary}>
                Cancel
              </button>
            </div>
          </form>
        </Card>
      )}

      {/* Picks */}
      {bracket && (
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
      )}
    </div>
  );
}
