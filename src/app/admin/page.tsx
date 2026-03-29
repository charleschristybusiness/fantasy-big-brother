'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Season, Houseguest, Bracket, WeeklyEvent, BlockSurvivor } from '@/lib/types';

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
    loadData();
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
    return <div className="max-w-4xl mx-auto px-4 py-12 text-center text-slate-400">Loading...</div>;
  }

  // No season exists - show create form
  if (!season) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold text-blue-600 mb-6">Create a New Season</h1>
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-slate-700 mb-1">Season Name</label>
            <input
              type="text"
              value={seasonName}
              onChange={(e) => setSeasonName(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-lg px-4 py-3 text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g., Big Brother 27"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-700 mb-1">Number of Houseguests</label>
            <input
              type="number"
              value={houseguestCount}
              onChange={(e) => setHouseguestCount(Number(e.target.value))}
              className="w-full bg-white border border-slate-200 rounded-lg px-4 py-3 text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-700 mb-1">Admin Password</label>
            <input
              type="text"
              value={adminPass}
              onChange={(e) => setAdminPass(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-lg px-4 py-3 text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Set an admin password"
            />
          </div>
          <button
            onClick={createSeason}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-lg transition shadow-sm"
          >
            Create Season
          </button>
        </div>
      </div>
    );
  }

  // Login screen
  if (!authenticated) {
    return (
      <div className="max-w-md mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold text-blue-600 mb-6">Admin Login</h1>
        <div className="space-y-4">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            className="w-full bg-white border border-slate-200 rounded-lg px-4 py-3 text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Enter admin password"
          />
          {authError && <p className="text-red-600 text-sm">{authError}</p>}
          <button
            onClick={handleLogin}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-lg transition shadow-sm"
          >
            Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-blue-600">Admin Dashboard</h1>
        <span className="text-slate-500">{season.name}</span>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-8">
        {(['season', 'weekly', 'brackets'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              activeTab === tab
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {tab === 'season' ? 'Season Setup' : tab === 'weekly' ? 'Weekly Results' : 'Brackets'}
          </button>
        ))}
      </div>

      {/* Season Setup */}
      {activeTab === 'season' && (
        <div className="space-y-8">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Season Settings</h2>
            <div className="grid sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm text-slate-700 mb-1">Season Name</label>
                <input
                  type="text"
                  value={seasonName}
                  onChange={(e) => setSeasonName(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-700 mb-1">Houseguest Count</label>
                <input
                  type="number"
                  value={houseguestCount}
                  onChange={(e) => setHouseguestCount(Number(e.target.value))}
                  className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-700 mb-1">Admin Password</label>
                <input
                  type="text"
                  value={adminPass}
                  onChange={(e) => setAdminPass(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={updateSeason}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-lg transition shadow-sm"
              >
                Save Settings
              </button>
              <button
                onClick={toggleSubmissions}
                className={`font-bold py-2 px-6 rounded-lg transition shadow-sm ${
                  season.submissions_locked
                    ? 'bg-green-600 hover:bg-green-700 text-white'
                    : 'bg-red-600 hover:bg-red-700 text-white'
                }`}
              >
                {season.submissions_locked ? 'Unlock Submissions' : 'Lock Submissions'}
              </button>
              <button
                onClick={recalculateAllScores}
                className="bg-white hover:bg-slate-50 text-slate-700 font-bold py-2 px-6 rounded-lg transition border border-slate-200 shadow-sm"
              >
                Recalculate All Scores
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">
              Houseguests ({houseguests.length})
            </h2>
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={newHouseguestName}
                onChange={(e) => setNewHouseguestName(e.target.value)}
                className="flex-1 bg-white border border-slate-200 rounded-lg px-4 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Houseguest name"
                onKeyDown={(e) => e.key === 'Enter' && addHouseguest()}
              />
              <input
                type="text"
                value={newHouseguestPhoto}
                onChange={(e) => setNewHouseguestPhoto(e.target.value)}
                className="flex-1 bg-white border border-slate-200 rounded-lg px-4 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Photo URL (optional)"
              />
              <button
                onClick={addHouseguest}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition shadow-sm"
              >
                Add
              </button>
            </div>
            <div className="space-y-2">
              {houseguests.map((hg) => (
                <div
                  key={hg.id}
                  className="flex items-center justify-between bg-slate-50 rounded-lg px-4 py-2 border border-slate-100"
                >
                  <div className="flex items-center gap-3">
                    {hg.photo_url ? (
                      <img src={hg.photo_url} alt={hg.name} className="w-8 h-8 rounded-full object-cover" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 text-sm font-bold">
                        {hg.name[0]}
                      </div>
                    )}
                    <span className="text-slate-900">{hg.name}</span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded border ${
                        hg.status === 'active'
                          ? 'bg-green-50 text-green-700 border-green-200'
                          : hg.status === 'winner'
                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : hg.status === 'runner_up'
                          ? 'bg-blue-50 text-blue-700 border-blue-200'
                          : 'bg-red-50 text-red-700 border-red-200'
                      }`}
                    >
                      {hg.status}
                    </span>
                  </div>
                  <button
                    onClick={() => removeHouseguest(hg.id)}
                    className="text-red-600 hover:text-red-700 text-sm"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Weekly Results */}
      {activeTab === 'weekly' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h2 className="text-xl font-bold text-slate-900 mb-4">Enter Weekly Results</h2>

          <div className="mb-4">
            <label className="block text-sm text-slate-700 mb-1">Week Number</label>
            <div className="flex gap-2">
              <input
                type="number"
                min={1}
                value={weekNumber}
                onChange={(e) => setWeekNumber(Number(e.target.value))}
                className="w-24 bg-white border border-slate-200 rounded-lg px-4 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                onClick={() => loadWeekData(weekNumber)}
                className="bg-white hover:bg-slate-50 text-slate-700 py-2 px-4 rounded-lg transition text-sm border border-slate-200 shadow-sm"
              >
                Load Week
              </button>
            </div>
          </div>

          {weeklyEvents.length > 0 && (
            <div className="mb-4 flex gap-2 flex-wrap">
              <span className="text-sm text-slate-500 mr-2">Existing weeks:</span>
              {weeklyEvents.map((e) => (
                <button
                  key={e.id}
                  onClick={() => loadWeekData(e.week_number)}
                  className={`text-sm px-3 py-1 rounded-lg transition ${
                    weekNumber === e.week_number
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Week {e.week_number}
                </button>
              ))}
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm text-slate-700 mb-1">HOH Winner</label>
              <select
                value={hohWinnerId}
                onChange={(e) => setHohWinnerId(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">-- None --</option>
                {allHouseguests.map((hg) => (
                  <option key={hg.id} value={hg.id}>
                    {hg.name}{hg.status !== 'active' ? ` (${hg.status})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-slate-700 mb-1">Veto Winner</label>
              <select
                value={vetoWinnerId}
                onChange={(e) => setVetoWinnerId(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">-- None --</option>
                {allHouseguests.map((hg) => (
                  <option key={hg.id} value={hg.id}>
                    {hg.name}{hg.status !== 'active' ? ` (${hg.status})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm text-slate-700 mb-1">Evicted Houseguest</label>
            <select
              value={evictedId}
              onChange={(e) => setEvictedId(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">-- None --</option>
              {allHouseguests.map((hg) => (
                <option key={hg.id} value={hg.id}>
                  {hg.name}{hg.status !== 'active' ? ` (${hg.status})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="mb-6">
            <label className="block text-sm text-slate-700 mb-2">
              Block Survivors (select all who survived the block this week)
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {allHouseguests.map((hg) => (
                <label
                  key={hg.id}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition ${
                    blockSurvivorIds.includes(hg.id)
                      ? 'bg-blue-50 border border-blue-400'
                      : 'bg-slate-50 border border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={blockSurvivorIds.includes(hg.id)}
                    onChange={() => toggleBlockSurvivor(hg.id)}
                    className="accent-blue-600"
                  />
                  <span className="text-slate-900 text-sm">
                    {hg.name}
                    {hg.status !== 'active' && (
                      <span className="text-slate-400 text-xs ml-1">({hg.status})</span>
                    )}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {weekMessage && (
            <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-3 text-green-700 text-sm">
              {weekMessage}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={submitWeeklyResults}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-lg transition shadow-sm"
            >
              Save Week {weekNumber} Results
            </button>
            <button
              onClick={clearWeek}
              className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-8 rounded-lg transition shadow-sm"
            >
              Clear Week {weekNumber}
            </button>
          </div>
        </div>
      )}

      {/* Brackets Management */}
      {activeTab === 'brackets' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h2 className="text-xl font-bold text-slate-900 mb-4">
            Submitted Brackets ({brackets.length})
          </h2>

          {brackets.length === 0 ? (
            <p className="text-slate-400">No brackets submitted yet.</p>
          ) : (
            <div className="space-y-2">
              {brackets.map((b, i) => (
                <div
                  key={b.id}
                  className="flex items-center justify-between bg-slate-50 rounded-lg px-4 py-3 border border-slate-100"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-slate-400 text-sm w-8">#{i + 1}</span>
                    {editingBracketId === b.id ? (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={editTeamName}
                          onChange={(e) => setEditTeamName(e.target.value)}
                          className="bg-white border border-slate-200 rounded px-3 py-1 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          onKeyDown={(e) => e.key === 'Enter' && saveTeamName(b.id)}
                        />
                        <button
                          onClick={() => saveTeamName(b.id)}
                          className="text-green-600 hover:text-green-700 text-sm"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingBracketId(null)}
                          className="text-slate-400 hover:text-slate-600 text-sm"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <span className="text-slate-900">{b.team_name}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-blue-600 font-mono text-sm font-semibold">
                      {Number(b.total_score).toFixed(2)} pts
                    </span>
                    <button
                      onClick={() => {
                        setEditingBracketId(b.id);
                        setEditTeamName(b.team_name);
                      }}
                      className="text-blue-600 hover:text-blue-700 text-sm"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteBracket(b.id)}
                      className="text-red-600 hover:text-red-700 text-sm"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
