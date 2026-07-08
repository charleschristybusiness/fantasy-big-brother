'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Season, Houseguest, Bracket, WeeklyEvent } from '@/lib/types';
import {
  Card,
  PageHeader,
  Skeleton,
  Avatar,
  StatusBadge,
  RankNumber,
  inputCls,
  selectCls,
  btnPrimary,
  btnSecondary,
  btnDanger,
} from '@/components/ui';

const labelCls = 'mb-2 block text-xs font-medium uppercase tracking-wider text-ink-dim';

export default function AdminPage() {
  const [season, setSeason] = useState<Season | null>(null);
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [houseguests, setHouseguests] = useState<Houseguest[]>([]);
  const [brackets, setBrackets] = useState<Bracket[]>([]);
  const [weeklyEvents, setWeeklyEvents] = useState<WeeklyEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'season' | 'weekly' | 'brackets'>('season');

  // Season setup
  const [seasonName, setSeasonName] = useState('');
  const [houseguestCount, setHouseguestCount] = useState(16);
  const [newHouseguestName, setNewHouseguestName] = useState('');
  const [newHouseguestPhoto, setNewHouseguestPhoto] = useState('');
  const [adminPass, setAdminPass] = useState('');

  // Weekly results
  const [weekNumber, setWeekNumber] = useState(1);
  const [hohWinnerId, setHohWinnerId] = useState('');
  const [vetoWinnerId, setVetoWinnerId] = useState('');
  const [evictedId, setEvictedId] = useState('');
  const [blockSurvivorIds, setBlockSurvivorIds] = useState<string[]>([]);
  const [weekMessage, setWeekMessage] = useState('');

  // Bracket editing
  const [editingBracketId, setEditingBracketId] = useState<string | null>(null);
  const [editTeamName, setEditTeamName] = useState('');

  const loadData = useCallback(async () => {
    const { data: seasonData } = await supabase
      .from('seasons')
      .select('*')
      .eq('status', 'active')
      .limit(1)
      .single();

    if (seasonData) {
      const s = seasonData as Season;
      setSeason(s);
      setSeasonName(s.name);
      setHouseguestCount(s.houseguest_count);
      setAdminPass(s.admin_password);

      const [{ data: hgData }, { data: bData }, { data: evData }] = await Promise.all([
        supabase.from('houseguests').select('*').eq('season_id', s.id).order('name'),
        supabase.from('brackets').select('*').eq('season_id', s.id).order('total_score', { ascending: false }),
        supabase.from('weekly_events').select('*').eq('season_id', s.id).order('week_number'),
      ]);

      setHouseguests((hgData as Houseguest[]) || []);
      setBrackets((bData as Bracket[]) || []);
      setWeeklyEvents((evData as WeeklyEvent[]) || []);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    async function init() {
      await loadData();
    }
    init();
  }, [loadData]);

  const handleLogin = async () => {
    if (!season) {
      setAuthError('No active season found.');
      return;
    }

    const res = await fetch('/api/admin/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password, season_id: season.id }),
    });

    if (res.ok) {
      setAuthenticated(true);
      setAuthError('');
    } else {
      setAuthError('Invalid password.');
    }
  };

  const createSeason = async () => {
    if (!seasonName.trim()) return;
    const { data, error } = await supabase
      .from('seasons')
      .insert({
        name: seasonName.trim(),
        houseguest_count: houseguestCount,
        admin_password: adminPass || 'admin123',
      })
      .select()
      .single();

    if (!error && data) {
      setSeason(data as Season);
      setAuthenticated(true);
    }
  };

  const updateSeason = async () => {
    if (!season) return;
    await supabase
      .from('seasons')
      .update({
        name: seasonName.trim(),
        houseguest_count: houseguestCount,
        admin_password: adminPass,
      })
      .eq('id', season.id);

    setSeason({ ...season, name: seasonName.trim(), houseguest_count: houseguestCount, admin_password: adminPass });
  };

  const toggleSubmissions = async () => {
    if (!season) return;
    const newLocked = !season.submissions_locked;
    await supabase
      .from('seasons')
      .update({ submissions_locked: newLocked })
      .eq('id', season.id);

    setSeason({ ...season, submissions_locked: newLocked });
  };

  const addHouseguest = async () => {
    if (!season || !newHouseguestName.trim()) return;
    const { data } = await supabase
      .from('houseguests')
      .insert({
        season_id: season.id,
        name: newHouseguestName.trim(),
        photo_url: newHouseguestPhoto.trim() || null,
      })
      .select()
      .single();

    if (data) {
      setHouseguests([...houseguests, data as Houseguest].sort((a, b) => a.name.localeCompare(b.name)));
      setNewHouseguestName('');
      setNewHouseguestPhoto('');
    }
  };

  const removeHouseguest = async (id: string) => {
    await supabase.from('houseguests').delete().eq('id', id);
    setHouseguests(houseguests.filter((h) => h.id !== id));
  };

  const submitWeeklyResults = async () => {
    if (!season) return;
    setWeekMessage('');

    const res = await fetch('/api/admin/weekly-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        season_id: season.id,
        week_number: weekNumber,
        hoh_winner_id: hohWinnerId || null,
        veto_winner_id: vetoWinnerId || null,
        evicted_houseguest_id: evictedId || null,
        block_survivor_ids: blockSurvivorIds,
      }),
    });

    if (res.ok) {
      setWeekMessage(`Week ${weekNumber} results saved! Scores recalculated.`);
      await loadData();
      setHohWinnerId('');
      setVetoWinnerId('');
      setEvictedId('');
      setBlockSurvivorIds([]);
    } else {
      setWeekMessage('Error saving results.');
    }
  };

  const clearWeek = async () => {
    if (!season) return;
    if (!confirm(`Are you sure you want to clear all data for Week ${weekNumber}? This will revert the evicted houseguest back to active.`)) return;
    setWeekMessage('');

    const res = await fetch('/api/admin/clear-week', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ season_id: season.id, week_number: weekNumber }),
    });

    if (res.ok) {
      setWeekMessage(`Week ${weekNumber} cleared successfully. Scores recalculated.`);
      setHohWinnerId('');
      setVetoWinnerId('');
      setEvictedId('');
      setBlockSurvivorIds([]);
      await loadData();
    } else {
      const data = await res.json();
      setWeekMessage(data.error || 'Error clearing week.');
    }
  };

  const recalculateAllScores = async () => {
    if (!season) return;
    const res = await fetch('/api/admin/recalculate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ season_id: season.id }),
    });

    if (res.ok) {
      const data = await res.json();
      alert(`Recalculated ${data.brackets_updated} brackets.`);
      await loadData();
    }
  };

  const deleteBracket = async (id: string) => {
    if (!confirm('Delete this bracket?')) return;
    await supabase.from('brackets').delete().eq('id', id);
    setBrackets(brackets.filter((b) => b.id !== id));
  };

  const saveTeamName = async (bracketId: string) => {
    if (!editTeamName.trim()) return;
    await supabase
      .from('brackets')
      .update({ team_name: editTeamName.trim() })
      .eq('id', bracketId);

    setBrackets(brackets.map((b) => (b.id === bracketId ? { ...b, team_name: editTeamName.trim() } : b)));
    setEditingBracketId(null);
  };

  const toggleBlockSurvivor = (hgId: string) => {
    setBlockSurvivorIds((prev) =>
      prev.includes(hgId) ? prev.filter((id) => id !== hgId) : [...prev, hgId]
    );
  };

  const allHouseguests = houseguests;

  const loadWeekData = async (week: number) => {
    if (!season) return;
    setWeekNumber(week);

    const { data: event } = await supabase
      .from('weekly_events')
      .select('*')
      .eq('season_id', season.id)
      .eq('week_number', week)
      .single();

    if (event) {
      setHohWinnerId(event.hoh_winner_id || '');
      setVetoWinnerId(event.veto_winner_id || '');
      setEvictedId(event.evicted_houseguest_id || '');

      const { data: survivors } = await supabase
        .from('block_survivors')
        .select('houseguest_id')
        .eq('weekly_event_id', event.id);

      setBlockSurvivorIds((survivors || []).map((s: { houseguest_id: string }) => s.houseguest_id));
    } else {
      setHohWinnerId('');
      setVetoWinnerId('');
      setEvictedId('');
      setBlockSurvivorIds([]);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-12">
        <Skeleton className="mb-8 h-9 w-52" />
        <div className="mb-8 flex gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-32" />
          ))}
        </div>
        <Skeleton className="min-h-[300px]" />
      </div>
    );
  }

  // No season exists — show create form
  if (!season) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <PageHeader eyebrow="Admin" title="Create a new season" />
        <Card className="space-y-4 p-6">
          <div>
            <label className={labelCls}>Season name</label>
            <input
              type="text"
              value={seasonName}
              onChange={(e) => setSeasonName(e.target.value)}
              className={inputCls}
              placeholder="e.g., Big Brother 27"
            />
          </div>
          <div>
            <label className={labelCls}>Number of houseguests</label>
            <input
              type="number"
              value={houseguestCount}
              onChange={(e) => setHouseguestCount(Number(e.target.value))}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Admin password</label>
            <input
              type="text"
              value={adminPass}
              onChange={(e) => setAdminPass(e.target.value)}
              className={inputCls}
              placeholder="Set an admin password"
            />
          </div>
          <button onClick={createSeason} className={btnPrimary}>
            Create season
          </button>
        </Card>
      </div>
    );
  }

  // Login screen
  if (!authenticated) {
    return (
      <div className="mx-auto max-w-md px-4 py-12">
        <PageHeader eyebrow="Admin" title="Admin login" subtitle={season.name} />
        <Card className="space-y-4 p-6">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            className={inputCls}
            placeholder="Enter admin password"
            aria-label="Admin password"
          />
          {authError && <p className="text-sm text-red-400">{authError}</p>}
          <button onClick={handleLogin} className={`${btnPrimary} w-full`}>
            Log in
          </button>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <PageHeader eyebrow="Admin" title="Dashboard" subtitle={season.name} />

      {/* Tabs */}
      <div className="mb-8 inline-flex gap-1 rounded-xl border border-edge bg-surface p-1">
        {(
          [
            { key: 'season', label: 'Season setup' },
            { key: 'weekly', label: 'Weekly results' },
            { key: 'brackets', label: 'Brackets' },
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

      {/* Season setup */}
      {activeTab === 'season' && (
        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="mb-5 text-sm font-semibold uppercase tracking-wider text-ink-mid">
              Season settings
            </h2>
            <div className="mb-5 grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelCls}>Season name</label>
                <input
                  type="text"
                  value={seasonName}
                  onChange={(e) => setSeasonName(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Houseguest count</label>
                <input
                  type="number"
                  value={houseguestCount}
                  onChange={(e) => setHouseguestCount(Number(e.target.value))}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Admin password</label>
                <input
                  type="text"
                  value={adminPass}
                  onChange={(e) => setAdminPass(e.target.value)}
                  className={inputCls}
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <button onClick={updateSeason} className={btnPrimary}>
                Save settings
              </button>
              <button
                onClick={toggleSubmissions}
                className={season.submissions_locked ? btnSecondary : btnDanger}
              >
                {season.submissions_locked ? 'Unlock submissions' : 'Lock submissions'}
              </button>
              <button onClick={recalculateAllScores} className={btnSecondary}>
                Recalculate all scores
              </button>
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="mb-5 text-sm font-semibold uppercase tracking-wider text-ink-mid">
              Houseguests{' '}
              <span className="font-normal normal-case text-ink-dim tabular-nums">
                ({houseguests.length})
              </span>
            </h2>
            <div className="mb-4 flex flex-wrap gap-2">
              <input
                type="text"
                value={newHouseguestName}
                onChange={(e) => setNewHouseguestName(e.target.value)}
                className={`${inputCls} flex-1 basis-48`}
                placeholder="Houseguest name"
                onKeyDown={(e) => e.key === 'Enter' && addHouseguest()}
              />
              <input
                type="text"
                value={newHouseguestPhoto}
                onChange={(e) => setNewHouseguestPhoto(e.target.value)}
                className={`${inputCls} flex-1 basis-48`}
                placeholder="Photo URL (optional)"
              />
              <button onClick={addHouseguest} className={btnPrimary}>
                Add
              </button>
            </div>
            <div className="space-y-2">
              {houseguests.map((hg) => (
                <div
                  key={hg.id}
                  className="flex items-center justify-between rounded-xl border border-edge bg-raised px-4 py-2.5 transition-colors hover:border-edge-bright"
                >
                  <div className="flex items-center gap-3">
                    <Avatar name={hg.name} photoUrl={hg.photo_url} size="sm" />
                    <span className="font-medium text-ink">{hg.name}</span>
                    <StatusBadge status={hg.status} />
                  </div>
                  <button
                    onClick={() => removeHouseguest(hg.id)}
                    className="text-sm font-medium text-red-400 transition-colors hover:text-red-300"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* Weekly results */}
      {activeTab === 'weekly' && (
        <Card className="p-6">
          <h2 className="mb-5 text-sm font-semibold uppercase tracking-wider text-ink-mid">
            Enter weekly results
          </h2>

          <div className="mb-4">
            <label className={labelCls}>Week number</label>
            <div className="flex gap-2">
              <input
                type="number"
                min={1}
                value={weekNumber}
                onChange={(e) => setWeekNumber(Number(e.target.value))}
                className={`${inputCls} w-24 tabular-nums`}
              />
              <button onClick={() => loadWeekData(weekNumber)} className={btnSecondary}>
                Load week
              </button>
            </div>
          </div>

          {weeklyEvents.length > 0 && (
            <div className="mb-5 flex flex-wrap items-center gap-2">
              <span className="mr-1 text-xs font-medium uppercase tracking-wider text-ink-dim">
                Existing:
              </span>
              {weeklyEvents.map((e) => (
                <button
                  key={e.id}
                  onClick={() => loadWeekData(e.week_number)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium tabular-nums transition-colors ${
                    weekNumber === e.week_number
                      ? 'bg-gold text-black'
                      : 'border border-edge bg-raised text-ink-mid hover:border-edge-bright hover:text-ink'
                  }`}
                >
                  Wk {e.week_number}
                </button>
              ))}
            </div>
          )}

          <div className="mb-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls}>HOH winner</label>
              <select value={hohWinnerId} onChange={(e) => setHohWinnerId(e.target.value)} className={selectCls}>
                <option value="">None</option>
                {allHouseguests.map((hg) => (
                  <option key={hg.id} value={hg.id}>
                    {hg.name}{hg.status !== 'active' ? ` (${hg.status})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Veto winner</label>
              <select value={vetoWinnerId} onChange={(e) => setVetoWinnerId(e.target.value)} className={selectCls}>
                <option value="">None</option>
                {allHouseguests.map((hg) => (
                  <option key={hg.id} value={hg.id}>
                    {hg.name}{hg.status !== 'active' ? ` (${hg.status})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mb-4">
            <label className={labelCls}>Evicted houseguest</label>
            <select value={evictedId} onChange={(e) => setEvictedId(e.target.value)} className={selectCls}>
              <option value="">None</option>
              {allHouseguests.map((hg) => (
                <option key={hg.id} value={hg.id}>
                  {hg.name}{hg.status !== 'active' ? ` (${hg.status})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="mb-6">
            <label className={labelCls}>Block survivors</label>
            <p className="mb-3 text-xs text-ink-dim">Select everyone who survived the block this week.</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {allHouseguests.map((hg) => (
                <label
                  key={hg.id}
                  className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 transition-colors ${
                    blockSurvivorIds.includes(hg.id)
                      ? 'border-gold/40 bg-gold/10'
                      : 'border-edge bg-raised hover:border-edge-bright'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={blockSurvivorIds.includes(hg.id)}
                    onChange={() => toggleBlockSurvivor(hg.id)}
                    className="accent-gold"
                  />
                  <span className="truncate text-sm text-ink">
                    {hg.name}
                    {hg.status !== 'active' && (
                      <span className="ml-1 text-xs text-ink-dim">({hg.status})</span>
                    )}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {weekMessage && (
            <div
              className={`mb-4 rounded-xl border p-3.5 text-sm ${
                weekMessage.toLowerCase().includes('error')
                  ? 'border-red-500/30 bg-red-500/10 text-red-400'
                  : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
              }`}
              role="status"
            >
              {weekMessage}
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <button onClick={submitWeeklyResults} className={btnPrimary}>
              Save week {weekNumber} results
            </button>
            <button onClick={clearWeek} className={btnDanger}>
              Clear week {weekNumber}
            </button>
          </div>
        </Card>
      )}

      {/* Brackets management */}
      {activeTab === 'brackets' && (
        <Card className="p-6">
          <h2 className="mb-5 text-sm font-semibold uppercase tracking-wider text-ink-mid">
            Submitted brackets{' '}
            <span className="font-normal normal-case text-ink-dim tabular-nums">
              ({brackets.length})
            </span>
          </h2>

          {brackets.length === 0 ? (
            <p className="text-sm text-ink-dim">No brackets submitted yet.</p>
          ) : (
            <div className="space-y-2">
              {brackets.map((b, i) => (
                <div
                  key={b.id}
                  className="flex items-center justify-between rounded-xl border border-edge bg-raised px-4 py-3 transition-colors hover:border-edge-bright"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="w-7 shrink-0 text-sm">
                      <RankNumber rank={i + 1} />
                    </span>
                    {editingBracketId === b.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={editTeamName}
                          onChange={(e) => setEditTeamName(e.target.value)}
                          className={`${inputCls} py-1.5`}
                          onKeyDown={(e) => e.key === 'Enter' && saveTeamName(b.id)}
                          autoFocus
                        />
                        <button
                          onClick={() => saveTeamName(b.id)}
                          className="text-sm font-medium text-emerald-400 transition-colors hover:text-emerald-300"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingBracketId(null)}
                          className="text-sm text-ink-mid transition-colors hover:text-ink"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <span className="truncate font-medium text-ink">{b.team_name}</span>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-4">
                    <span className="text-sm font-semibold text-gold tabular-nums">
                      {Number(b.total_score).toFixed(2)} pts
                    </span>
                    <button
                      onClick={() => {
                        setEditingBracketId(b.id);
                        setEditTeamName(b.team_name);
                      }}
                      className="text-sm font-medium text-ink-mid transition-colors hover:text-ink"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteBracket(b.id)}
                      className="text-sm font-medium text-red-400 transition-colors hover:text-red-300"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
