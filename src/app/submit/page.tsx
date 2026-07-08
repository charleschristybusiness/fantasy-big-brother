'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Season, Houseguest } from '@/lib/types';
import {
  Card,
  PageHeader,
  EmptyState,
  NoSeason,
  Skeleton,
  inputCls,
  selectCls,
  btnPrimary,
} from '@/components/ui';

const MULTIPLIERS = ['1.5×', '1.25×', '1.0×', '0.75×', '0.5×'];

function SubmitSkeleton() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <Skeleton className="mb-2 h-9 w-64" />
      <Skeleton className="mb-8 h-5 w-40" />
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
        <Skeleton className="h-14 w-full" />
      </div>
    </div>
  );
}

export default function SubmitBracketPage() {
  const router = useRouter();
  const [season, setSeason] = useState<Season | null>(null);
  const [houseguests, setHouseguests] = useState<Houseguest[]>([]);
  const [teamName, setTeamName] = useState('');
  const [picks, setPicks] = useState<(string | '')[]>(['', '', '', '', '']);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

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

      setSeason(seasonData as Season);

      const { data: hgData } = await supabase
        .from('houseguests')
        .select('*')
        .eq('season_id', seasonData.id)
        .order('name');

      setHouseguests((hgData as Houseguest[]) || []);
      setLoading(false);
    }
    load();
  }, []);

  const handlePickChange = (index: number, value: string) => {
    const newPicks = [...picks];
    newPicks[index] = value;
    setPicks(newPicks);
  };

  const getAvailableHouseguests = (currentIndex: number) => {
    const selectedIds = picks.filter((p, i) => p && i !== currentIndex);
    return houseguests.filter((hg) => !selectedIds.includes(hg.id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!teamName.trim()) {
      setError('Please enter a team name.');
      return;
    }
    if (picks.some((p) => !p)) {
      setError('Please select all 5 picks.');
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch('/api/brackets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          season_id: season!.id,
          team_name: teamName.trim(),
          picks,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || 'Failed to submit bracket.');
        setSubmitting(false);
        return;
      }

      router.push(`/team/${result.id}`);
    } catch {
      setError('Something went wrong. Please try again.');
      setSubmitting(false);
    }
  };

  if (loading) {
    return <SubmitSkeleton />;
  }

  if (!season) {
    return <NoSeason />;
  }

  if (season.submissions_locked) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <PageHeader eyebrow="Draft" title="Submissions locked" subtitle={season.name} />
        <EmptyState
          title="The season has already begun"
          hint="Bracket submissions are locked — follow your league on the leaderboard."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <PageHeader
        eyebrow="Draft"
        title="Submit your bracket"
        subtitle={`${season.name} — pick five houseguests, ranked by confidence`}
      />

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label
            htmlFor="team-name"
            className="mb-2 block text-xs font-medium uppercase tracking-wider text-ink-dim"
          >
            Team name
          </label>
          <input
            id="team-name"
            type="text"
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            className={inputCls}
            placeholder="Enter your team name"
            maxLength={50}
          />
        </div>

        <div className="space-y-3">
          <h2 className="text-xs font-medium uppercase tracking-wider text-ink-dim">
            Your five picks
          </h2>
          {[0, 1, 2, 3, 4].map((index) => (
            <Card key={index} className="flex items-center gap-4 p-4 transition-colors hover:border-edge-bright">
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold tabular-nums ${
                  index === 0 ? 'bg-gold text-black' : 'bg-raised text-ink-mid border border-edge'
                }`}
                aria-hidden
              >
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <label
                  htmlFor={`pick-${index}`}
                  className="mb-1.5 block text-xs text-ink-dim"
                >
                  Pick {index + 1} &middot;{' '}
                  <span className="font-semibold text-ink-mid tabular-nums">
                    {MULTIPLIERS[index]}
                  </span>{' '}
                  points multiplier
                </label>
                <select
                  id={`pick-${index}`}
                  value={picks[index]}
                  onChange={(e) => handlePickChange(index, e.target.value)}
                  className={selectCls}
                >
                  <option value="">Select a houseguest…</option>
                  {getAvailableHouseguests(index).map((hg) => (
                    <option key={hg.id} value={hg.id}>
                      {hg.name}
                    </option>
                  ))}
                </select>
              </div>
            </Card>
          ))}
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400" role="alert">
            {error}
          </div>
        )}

        <button type="submit" disabled={submitting} className={`${btnPrimary} w-full py-3.5 text-base`}>
          {submitting ? 'Submitting…' : 'Submit bracket'}
        </button>
      </form>
    </div>
  );
}
