'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Season, Houseguest, Bracket, WeeklyEvent, BlockSurvivor } from '@/lib/types';
import { calculateBracketScore } from '@/lib/scoring';
import type { BracketWithPicks } from '@/lib/types';

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

      // Set from URL params
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
    return (
      <div className="max-w-5xl mx-auto px-4 py-12 text-center text-gray-400">Loading...</div>
    );
  }

  if (!season) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-12 text-center">
        <h1 className="text-3xl font-bold text-white mb-4">No Active Season</h1>
        <p className="text-gray-400">There is no active season right now.</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-yellow-400 mb-2">Head-to-Head</h1>
      <p className="text-gray-400 mb-8">{season.name} — Compare two teams side by side</p>

      {/* Team Selectors */}
      <div className="grid sm:grid-cols-2 gap-4 mb-8">
        <div>
          <label className="block text-sm text-gray-300 mb-1">Team A</label>
          <select
            value={teamAId}
            onChange={(e) => handleTeamAChange(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
          >
            <option value="">-- Select a team --</option>
            {allBrackets.map((b) => (
              <option key={b.id} value={b.id}>
                {b.team_name} ({b.total_score.toFixed(2)} pts)
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm text-gray-300 mb-1">Team B</label>
          <select
            value={teamBId}
            onChange={(e) => handleTeamBChange(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
          >
            <option value="">-- Select a team --</option>
            {allBrackets.map((b) => (
              <option key={b.id} value={b.id}>
                {b.team_name} ({b.total_score.toFixed(2)} pts)
              </option>
            ))}
          </select>
        </div>
      </div>

      {!teamA || !teamB ? (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-12 text-center">
          <p className="text-gray-500 text-lg">Select two teams above to compare them.</p>
        </div>
      ) : comparison && (
        <div className="space-y-6">
          {/* Score Header */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
            <div className="grid grid-cols-3 items-center text-center">
              <div>
                <div className="text-lg font-semibold text-white mb-1">{teamA.team_name}</div>
                <div className={`text-3xl font-bold font-mono ${comparison.a.total >= comparison.b.total ? 'text-yellow-400' : 'text-gray-400'}`}>
                  {comparison.a.total.toFixed(2)}
                </div>
              </div>
              <div className="text-2xl font-bold text-gray-600">VS</div>
              <div>
                <div className="text-lg font-semibold text-white mb-1">{teamB.team_name}</div>
                <div className={`text-3xl font-bold font-mono ${comparison.b.total >= comparison.a.total ? 'text-yellow-400' : 'text-gray-400'}`}>
                  {comparison.b.total.toFixed(2)}
                </div>
              </div>
            </div>
          </div>

          {/* Stat Breakdown */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
            <h2 className="text-xl font-bold text-white mb-4">Stat Breakdown</h2>
            <div className="space-y-4">
              {[
                { label: 'HOH Wins', a: comparison.a.hohWins, b: comparison.b.hohWins },
                { label: 'Veto Wins', a: comparison.a.vetoWins, b: comparison.b.vetoWins },
                { label: 'Block Survivals', a: comparison.a.blockSurvivals, b: comparison.b.blockSurvivals },
                { label: 'Active Players', a: comparison.a.activeCount, b: comparison.b.activeCount },
              ].map((stat) => {
                const total = stat.a + stat.b;
                const aPct = total > 0 ? (stat.a / total) * 100 : 50;
                const bPct = total > 0 ? (stat.b / total) * 100 : 50;

                return (
                  <div key={stat.label}>
                    <div className="text-sm text-gray-400 mb-1 text-center">{stat.label}</div>
                    <div className="flex items-center gap-3">
                      <span className={`w-8 text-right font-mono text-sm ${stat.a > stat.b ? 'text-cyan-400 font-bold' : stat.a === stat.b ? 'text-gray-300' : 'text-gray-400'}`}>
                        {stat.a}
                      </span>
                      <div className="flex-1 flex h-6 rounded-lg overflow-hidden bg-gray-800">
                        <div
                          className={`h-full transition-all duration-500 ${stat.a >= stat.b ? 'bg-cyan-500' : 'bg-cyan-500/30'}`}
                          style={{ width: `${aPct}%` }}
                        />
                        <div
                          className={`h-full transition-all duration-500 ${stat.b >= stat.a ? 'bg-orange-500' : 'bg-orange-500/30'}`}
                          style={{ width: `${bPct}%` }}
                        />
                      </div>
                      <span className={`w-8 text-left font-mono text-sm ${stat.b > stat.a ? 'text-orange-400 font-bold' : stat.b === stat.a ? 'text-gray-300' : 'text-gray-400'}`}>
                        {stat.b}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Pick-by-Pick Comparison */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
            <h2 className="text-xl font-bold text-white mb-4">Pick-by-Pick</h2>
            <div className="space-y-3">
              {[0, 1, 2, 3, 4].map((i) => {
                const pickA = teamA.picks[i];
                const pickB = teamB.picks[i];
                const aWins = pickA.pick_score > pickB.pick_score;
                const bWins = pickB.pick_score > pickA.pick_score;
                const tied = pickA.pick_score === pickB.pick_score;

                return (
                  <div key={i} className="bg-gray-800 rounded-lg p-4">
                    <div className="text-xs text-gray-500 text-center mb-2">
                      Pick #{i + 1} &middot; {pickA.multiplier}x multiplier
                    </div>
                    <div className="grid grid-cols-3 items-center gap-2">
                      {/* Team A Pick */}
                      <div className={`text-right ${aWins ? 'opacity-100' : tied ? 'opacity-80' : 'opacity-50'}`}>
                        <div className="flex items-center justify-end gap-2">
                          <div>
                            <div className="text-sm font-semibold text-white">{pickA.houseguest.name}</div>
                            <div className="text-xs text-gray-400">
                              {pickA.stats.hoh_wins}H {pickA.stats.veto_wins}V {pickA.stats.block_survivals}B
                            </div>
                          </div>
                          {pickA.houseguest.photo_url ? (
                            <img src={pickA.houseguest.photo_url} alt={pickA.houseguest.name} className="w-10 h-10 rounded-full object-cover" />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center text-gray-400 text-sm font-bold">
                              {pickA.houseguest.name[0]}
                            </div>
                          )}
                        </div>
                        <div className={`text-lg font-bold font-mono mt-1 ${aWins ? 'text-yellow-400' : 'text-gray-400'}`}>
                          {pickA.pick_score.toFixed(2)}
                        </div>
                      </div>

                      {/* VS */}
                      <div className="text-center text-gray-600 font-bold text-sm">VS</div>

                      {/* Team B Pick */}
                      <div className={`text-left ${bWins ? 'opacity-100' : tied ? 'opacity-80' : 'opacity-50'}`}>
                        <div className="flex items-center gap-2">
                          {pickB.houseguest.photo_url ? (
                            <img src={pickB.houseguest.photo_url} alt={pickB.houseguest.name} className="w-10 h-10 rounded-full object-cover" />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center text-gray-400 text-sm font-bold">
                              {pickB.houseguest.name[0]}
                            </div>
                          )}
                          <div>
                            <div className="text-sm font-semibold text-white">{pickB.houseguest.name}</div>
                            <div className="text-xs text-gray-400">
                              {pickB.stats.hoh_wins}H {pickB.stats.veto_wins}V {pickB.stats.block_survivals}B
                            </div>
                          </div>
                        </div>
                        <div className={`text-lg font-bold font-mono mt-1 ${bWins ? 'text-yellow-400' : 'text-gray-400'}`}>
                          {pickB.pick_score.toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ComparePage() {
  return (
    <Suspense fallback={<div className="max-w-5xl mx-auto px-4 py-12 text-center text-gray-400">Loading...</div>}>
      <CompareContent />
    </Suspense>
  );
}
