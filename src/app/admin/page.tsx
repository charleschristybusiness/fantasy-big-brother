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
      // Reset form for next week
      setHohWinnerId('');
      setVetoWinnerId('');
      setEvictedId('');
      setBlockSurvivorIds([]);
    } else {
      setWeekMessage('Error saving results.');
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

  const activeHouseguests = houseguests.filter((h) => h.status === 'active');

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
    return <div className="max-w-4xl mx-auto px-4 py-12 text-center text-gray-400">Loading...</div>;
  }

  // No season exists - show create form
  if (!season) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold text-yellow-400 mb-6">Create a New Season</h1>
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-300 mb-1">Season Name</label>
            <input
              type="text"
              value={seasonName}
              onChange={(e) => setSeasonName(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white"
              placeholder="e.g., Big Brother 27"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-300 mb-1">Number of Houseguests</label>
            <input
              type="number"
              value={houseguestCount}
              onChange={(e) => setHouseguestCount(Number(e.target.value))}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-300 mb-1">Admin Password</label>
            <input
              type="text"
              value={adminPass}
              onChange={(e) => setAdminPass(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white"
              placeholder="Set an admin password"
            />
          </div>
          <button
            onClick={createSeason}
            className="bg-yellow-500 hover:bg-yellow-400 text-gray-900 font-bold py-3 px-8 rounded-lg transition"
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
        <h1 className="text-3xl font-bold text-yellow-400 mb-6">Admin Login</h1>
        <div className="space-y-4">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white"
            placeholder="Enter admin password"
          />
          {authError && <p className="text-red-400 text-sm">{authError}</p>}
          <button
            onClick={handleLogin}
            className="w-full bg-yellow-500 hover:bg-yellow-400 text-gray-900 font-bold py-3 px-8 rounded-lg transition"
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
        <h1 className="text-3xl font-bold text-yellow-400">Admin Dashboard</h1>
        <span className="text-gray-400">{season.name}</span>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-8">
        {(['season', 'weekly', 'brackets'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              activeTab === tab
                ? 'bg-yellow-500 text-gray-900'
                : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}
          >
            {tab === 'season' ? 'Season Setup' : tab === 'weekly' ? 'Weekly Results' : 'Brackets'}
          </button>
        ))}
      </div>

      {/* Season Setup */}
      {activeTab === 'season' && (
        <div className="space-y-8">
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
            <h2 className="text-xl font-bold text-white mb-4">Season Settings</h2>
            <div className="grid sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm text-gray-300 mb-1">Season Name</label>
                <input
                  type="text"
                  value={seasonName}
                  onChange={(e) => setSeasonName(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Houseguest Count</label>
                <input
                  type="number"
                  value={houseguestCount}
                  onChange={(e) => setHouseguestCount(Number(e.target.value))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Admin Password</label>
                <input
                  type="text"
                  value={adminPass}
                  onChange={(e) => setAdminPass(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={updateSeason}
                className="bg-yellow-500 hover:bg-yellow-400 text-gray-900 font-bold py-2 px-6 rounded-lg transition"
              >
                Save Settings
              </button>
              <button
                onClick={toggleSubmissions}
                className={`font-bold py-2 px-6 rounded-lg transition ${
                  season.submissions_locked
                    ? 'bg-green-600 hover:bg-green-500 text-white'
                    : 'bg-red-600 hover:bg-red-500 text-white'
                }`}
              >
                {season.submissions_locked ? 'Unlock Submissions' : 'Lock Submissions'}
              </button>
              <button
                onClick={recalculateAllScores}
                className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-6 rounded-lg transition"
              >
                Recalculate All Scores
              </button>
            </div>
          </div>

          <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
            <h2 className="text-xl font-bold text-white mb-4">
              Houseguests ({houseguests.length})
            </h2>
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={newHouseguestName}
                onChange={(e) => setNewHouseguestName(e.target.value)}
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white"
                placeholder="Houseguest name"
                onKeyDown={(e) => e.key === 'Enter' && addHouseguest()}
              />
              <input
                type="text"
                value={newHouseguestPhoto}
                onChange={(e) => setNewHouseguestPhoto(e.target.value)}
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white"
                placeholder="Photo URL (optional)"
              />
              <button
                onClick={addHouseguest}
                className="bg-yellow-500 hover:bg-yellow-400 text-gray-900 font-bold py-2 px-4 rounded-lg transition"
              >
                Add
              </button>
            </div>
            <div className="space-y-2">
              {houseguests.map((hg) => (
                <div
                  key={hg.id}
                  className="flex items-center justify-between bg-gray-800 rounded-lg px-4 py-2"
                >
                  <div className="flex items-center gap-3">
                    {hg.photo_url ? (
                      <img src={hg.photo_url} alt={hg.name} className="w-8 h-8 rounded-full object-cover" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center text-sm font-bold">
                        {hg.name[0]}
                      </div>
                    )}
                    <span className="text-white">{hg.name}</span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded ${
                        hg.status === 'active'
                          ? 'bg-green-900 text-green-300'
                          : hg.status === 'winner'
                          ? 'bg-yellow-900 text-yellow-300'
                          : hg.status === 'runner_up'
                          ? 'bg-blue-900 text-blue-300'
                          : 'bg-red-900 text-red-300'
                      }`}
                    >
                      {hg.status}
                    </span>
                  </div>
                  <button
                    onClick={() => removeHouseguest(hg.id)}
                    className="text-red-400 hover:text-red-300 text-sm"
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
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
          <h2 className="text-xl font-bold text-white mb-4">Enter Weekly Results</h2>

          <div className="mb-4">
            <label className="block text-sm text-gray-300 mb-1">Week Number</label>
            <div className="flex gap-2">
              <input
                type="number"
                min={1}
                value={weekNumber}
                onChange={(e) => setWeekNumber(Number(e.target.value))}
                className="w-24 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white"
              />
              <button
                onClick={() => loadWeekData(weekNumber)}
                className="bg-gray-700 hover:bg-gray-600 text-white py-2 px-4 rounded-lg transition text-sm"
              >
                Load Week
              </button>
            </div>
          </div>

          {weeklyEvents.length > 0 && (
            <div className="mb-4 flex gap-2 flex-wrap">
              <span className="text-sm text-gray-400 mr-2">Existing weeks:</span>
              {weeklyEvents.map((e) => (
                <button
                  key={e.id}
                  onClick={() => loadWeekData(e.week_number)}
                  className={`text-sm px-3 py-1 rounded-lg transition ${
                    weekNumber === e.week_number
                      ? 'bg-yellow-500 text-gray-900'
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  Week {e.week_number}
                </button>
              ))}
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm text-gray-300 mb-1">HOH Winner</label>
              <select
                value={hohWinnerId}
                onChange={(e) => setHohWinnerId(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white"
              >
                <option value="">-- None --</option>
                {activeHouseguests.map((hg) => (
                  <option key={hg.id} value={hg.id}>{hg.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1">Veto Winner</label>
              <select
                value={vetoWinnerId}
                onChange={(e) => setVetoWinnerId(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white"
              >
                <option value="">-- None --</option>
                {activeHouseguests.map((hg) => (
                  <option key={hg.id} value={hg.id}>{hg.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm text-gray-300 mb-1">Evicted Houseguest</label>
            <select
              value={evictedId}
              onChange={(e) => setEvictedId(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white"
            >
              <option value="">-- None --</option>
              {activeHouseguests.map((hg) => (
                <option key={hg.id} value={hg.id}>{hg.name}</option>
              ))}
            </select>
          </div>

          <div className="mb-6">
            <label className="block text-sm text-gray-300 mb-2">
              Block Survivors (select all who survived the block this week)
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {activeHouseguests.map((hg) => (
                <label
                  key={hg.id}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition ${
                    blockSurvivorIds.includes(hg.id)
                      ? 'bg-yellow-500/20 border border-yellow-500'
                      : 'bg-gray-800 border border-gray-700 hover:border-gray-600'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={blockSurvivorIds.includes(hg.id)}
                    onChange={() => toggleBlockSurvivor(hg.id)}
                    className="accent-yellow-500"
                  />
                  <span className="text-white text-sm">{hg.name}</span>
                </label>
              ))}
            </div>
          </div>

          {weekMessage && (
            <div className="mb-4 bg-green-900/50 border border-green-700 rounded-lg p-3 text-green-300 text-sm">
              {weekMessage}
            </div>
          )}

          <button
            onClick={submitWeeklyResults}
            className="bg-yellow-500 hover:bg-yellow-400 text-gray-900 font-bold py-3 px-8 rounded-lg transition"
          >
            Save Week {weekNumber} Results
          </button>
        </div>
      )}

      {/* Brackets Management */}
      {activeTab === 'brackets' && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
          <h2 className="text-xl font-bold text-white mb-4">
            Submitted Brackets ({brackets.length})
          </h2>

          {brackets.length === 0 ? (
            <p className="text-gray-500">No brackets submitted yet.</p>
          ) : (
            <div className="space-y-2">
              {brackets.map((b, i) => (
                <div
                  key={b.id}
                  className="flex items-center justify-between bg-gray-800 rounded-lg px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-gray-500 text-sm w-8">#{i + 1}</span>
                    {editingBracketId === b.id ? (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={editTeamName}
                          onChange={(e) => setEditTeamName(e.target.value)}
                          className="bg-gray-700 border border-gray-600 rounded px-3 py-1 text-white text-sm"
                          onKeyDown={(e) => e.key === 'Enter' && saveTeamName(b.id)}
                        />
                        <button
                          onClick={() => saveTeamName(b.id)}
                          className="text-green-400 hover:text-green-300 text-sm"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingBracketId(null)}
                          className="text-gray-400 hover:text-gray-300 text-sm"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <span className="text-white">{b.team_name}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-yellow-400 font-mono text-sm">
                      {Number(b.total_score).toFixed(2)} pts
                    </span>
                    <button
                      onClick={() => {
                        setEditingBracketId(b.id);
                        setEditTeamName(b.team_name);
                      }}
                      className="text-blue-400 hover:text-blue-300 text-sm"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteBracket(b.id)}
                      className="text-red-400 hover:text-red-300 text-sm"
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
