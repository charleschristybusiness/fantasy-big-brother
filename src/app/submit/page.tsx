'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Season, Houseguest } from '@/lib/types';

function SubmitSkeleton() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <div className="h-9 w-64 animate-pulse bg-gray-800 rounded-lg mb-2" />
      <div className="h-5 w-40 animate-pulse bg-gray-800 rounded mb-8" />
      <div className="space-y-6">
        <div className="h-12 w-full animate-pulse bg-gray-800 rounded-lg" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-12 w-full animate-pulse bg-gray-800 rounded-lg" />
        ))}
        <div className="h-14 w-full animate-pulse bg-gray-800 rounded-lg" />
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
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <h1 className="text-3xl font-bold text-white mb-4">No Active Season</h1>
        <p className="text-gray-400">There is no active season right now. Check back later!</p>
      </div>
    );
  }

  if (season.submissions_locked) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <h1 className="text-3xl font-bold text-white mb-4">Submissions Locked</h1>
        <div className="inline-block bg-yellow-500/10 border border-yellow-500/30 rounded-xl px-6 py-3">
          <p className="text-yellow-400">
            Bracket submissions are currently locked. The season has already begun!
          </p>
        </div>
      </div>
    );
  }

  const multipliers = ['1.5x', '1.25x', '1.0x', '0.75x', '0.5x'];
  const multiplierColors = ['text-yellow-400', 'text-yellow-400/80', 'text-gray-300', 'text-gray-400', 'text-gray-500'];

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-yellow-400 mb-1">Submit Your Bracket</h1>
        <p className="text-gray-400">{season.name}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Team Name
          </label>
          <input
            type="text"
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-3.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500/50 transition-all duration-200"
            placeholder="Enter your team name"
            maxLength={50}
          />
        </div>

        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-white">Select Your 5 Houseguests</h2>
          {[0, 1, 2, 3, 4].map((index) => (
            <div key={index} className="bg-gray-900 rounded-xl border border-gray-800 p-4 hover:border-gray-700 transition-colors duration-200">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Pick #{index + 1}{' '}
                <span className={`font-mono font-bold ${multiplierColors[index]}`}>({multipliers[index]} multiplier)</span>
              </label>
              <select
                value={picks[index]}
                onChange={(e) => handlePickChange(index, e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500/50 transition-all duration-200"
              >
                <option value="">-- Select a houseguest --</option>
                {getAvailableHouseguests(index).map((hg) => (
                  <option key={hg.id} value={hg.id}>
                    {hg.name}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>

        {error && (
          <div className="bg-red-900/30 border border-red-500/30 rounded-xl p-4 text-red-400">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-yellow-500 hover:bg-yellow-400 disabled:bg-gray-700 disabled:cursor-not-allowed text-gray-900 font-bold py-4 px-8 rounded-xl text-lg transition-all duration-300 shadow-[0_0_20px_rgba(250,204,21,0.15)] hover:shadow-[0_0_30px_rgba(250,204,21,0.3)] disabled:shadow-none"
        >
          {submitting ? 'Submitting...' : 'Submit Bracket'}
        </button>
      </form>
    </div>
  );
}
