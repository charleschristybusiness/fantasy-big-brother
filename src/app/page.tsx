import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Season, Houseguest, Bracket, WeeklyEvent, BlockSurvivor, WeeklyRanking } from '@/lib/types';
import { calculateBracketScore, getHouseguestStats } from '@/lib/scoring';
import {
  Card,
  Avatar,
  StatTile,
  RankNumber,
  RankChange,
  EmptyState,
  IconUsers,
  IconHome,
  IconCalendar,
  IconTrophy,
} from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const { data: seasonData } = await supabase
    .from('seasons')
    .select('*')
    .eq('status', 'active')
    .limit(1)
    .single();

  const season = seasonData as Season | null;

  if (!season) {
    return (
      <div className="mx-auto max-w-6xl px-4">
        <section className="py-20 text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-gold">
            Fantasy league
          </p>
          <h1 className="text-4xl font-bold tracking-tight text-ink sm:text-5xl">
            Fantasy Big Brother
          </h1>
          <p className="mx-auto mt-4 max-w-md text-ink-mid">
            Draft your houseguests, earn points every week, and battle your friends for the top of
            the leaderboard.
          </p>
        </section>
        <div className="pb-20">
          <EmptyState title="No active season" hint="Check back once the next season kicks off." />
        </div>
      </div>
    );
  }

  const [
    { data: hgData },
    { data: bracketData },
    { data: eventsData },
    { data: survivorsData },
    { data: rankingsData },
  ] = await Promise.all([
    supabase.from('houseguests').select('*').eq('season_id', season.id),
    supabase.from('brackets').select('*').eq('season_id', season.id),
    supabase.from('weekly_events').select('*').eq('season_id', season.id).order('week_number'),
    supabase.from('block_survivors').select('*, weekly_events!inner(season_id)').eq('weekly_events.season_id', season.id),
    supabase.from('weekly_rankings').select('*').eq('season_id', season.id).order('week_number'),
  ]);

  const houseguests = (hgData || []) as Houseguest[];
  const brackets = (bracketData || []) as Bracket[];
  const events = (eventsData || []) as WeeklyEvent[];
  const survivors = (survivorsData || []) as BlockSurvivor[];
  const rankings = (rankingsData || []) as WeeklyRanking[];

  const standings = brackets
    .map((b) => calculateBracketScore(b, houseguests, events, survivors, season.houseguest_count))
    .sort((a, b) => b.total_score - a.total_score);

  const rankChanges = new Map<string, number | null>();
  const rankWeeks = [...new Set(rankings.map((r) => r.week_number))].sort((a, b) => a - b);
  if (rankWeeks.length >= 2) {
    const prevWeek = rankWeeks[rankWeeks.length - 2];
    const prevRanks = new Map(
      rankings.filter((r) => r.week_number === prevWeek).map((r) => [r.bracket_id, r.rank])
    );
    standings.forEach((b, i) => {
      const prev = prevRanks.get(b.id);
      rankChanges.set(b.id, prev !== undefined ? prev - (i + 1) : null);
    });
  }

  const leader = standings[0];
  const activeCount = houseguests.filter((h) => h.status === 'active').length;
  const weeksPlayed = new Set(events.map((e) => e.week_number)).size;
  const latestWeek = events.length > 0 ? events[events.length - 1] : null;

  const hgById = new Map(houseguests.map((h) => [h.id, h]));
  const latestSurvivors = latestWeek
    ? survivors.filter((s) => s.weekly_event_id === latestWeek.id).map((s) => hgById.get(s.houseguest_id)).filter(Boolean)
    : [];

  // --- Weekly recap ---
  const baseScoresThrough = (week: number) => {
    const evts = events.filter((e) => e.week_number <= week);
    const eventIds = new Set(evts.map((e) => e.id));
    const survs = survivors.filter((s) => eventIds.has(s.weekly_event_id));
    const evicted = evts.filter((e) => e.evicted_houseguest_id).length;
    return new Map(
      houseguests.map((h) => [
        h.id,
        getHouseguestStats(h, evts, survs, season.houseguest_count, evicted).base_score,
      ])
    );
  };

  let mvp: { name: string; delta: number } | null = null;
  let hotTeam: { name: string; delta: number } | null = null;
  let riser: { name: string; change: number } | null = null;
  let faller: { name: string; change: number } | null = null;

  if (latestWeek) {
    const wk = latestWeek.week_number;

    const curr = baseScoresThrough(wk);
    const prev = baseScoresThrough(wk - 1);
    for (const hg of houseguests) {
      const delta = (curr.get(hg.id) ?? 0) - (prev.get(hg.id) ?? 0);
      if (delta > 0 && (!mvp || delta > mvp.delta)) {
        mvp = { name: hg.name, delta };
      }
    }

    const currTotals = new Map(
      rankings.filter((r) => r.week_number === wk).map((r) => [r.bracket_id, r.total_score])
    );
    const prevTotals = new Map(
      rankings.filter((r) => r.week_number === wk - 1).map((r) => [r.bracket_id, r.total_score])
    );
    for (const b of standings) {
      const currTotal = currTotals.get(b.id);
      if (currTotal === undefined) continue;
      // Late-submitted brackets have no prior-week snapshot — skip them rather
      // than treating their entire total as one week's gain
      const prevTotal = wk > 1 ? prevTotals.get(b.id) : 0;
      if (prevTotal === undefined) continue;
      const delta = currTotal - prevTotal;
      if (delta > 0 && (!hotTeam || delta > hotTeam.delta)) {
        hotTeam = { name: b.team_name, delta };
      }
    }

    for (const b of standings) {
      const change = rankChanges.get(b.id);
      if (change === null || change === undefined) continue;
      if (change > 0 && (!riser || change > riser.change)) {
        riser = { name: b.team_name, change };
      }
      if (change < 0 && (!faller || change < faller.change)) {
        faller = { name: b.team_name, change };
      }
    }
  }

  const hasRecap = Boolean(mvp || hotTeam || riser || faller);

  return (
    <div className="mx-auto max-w-6xl px-4">
      {/* Hero */}
      <section className="relative py-14 sm:py-16">
        <div className="bg-dots pointer-events-none absolute inset-0" aria-hidden />
        <div
          className="pointer-events-none absolute -top-24 right-0 h-80 w-80 rounded-full bg-gold/[0.06] blur-3xl"
          aria-hidden
        />
        <p className="relative mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-gold">
          {season.name}
          {weeksPlayed > 0 && <span className="text-ink-dim"> &middot; Week {weeksPlayed} scored</span>}
        </p>
        <h1 className="relative max-w-2xl bg-gradient-to-b from-white to-ink-mid bg-clip-text text-4xl font-bold tracking-tight text-transparent sm:text-5xl">
          Fantasy Big Brother
        </h1>
        <p className="relative mt-4 max-w-xl text-ink-mid">
          Draft five houseguests, earn points for their wins and survival every week, and battle
          your league for first place.
        </p>
        <div className="relative mt-8 flex flex-wrap gap-3">
          <Link
            href="/leaderboard"
            className="inline-flex items-center justify-center rounded-xl bg-gold px-6 py-3 text-sm font-semibold text-black transition-colors hover:bg-gold-bright"
          >
            View leaderboard
          </Link>
          {!season.submissions_locked ? (
            <Link
              href="/submit"
              className="inline-flex items-center justify-center rounded-xl border border-edge bg-raised px-6 py-3 text-sm font-medium text-ink transition-colors hover:border-edge-bright"
            >
              Submit your bracket
            </Link>
          ) : (
            <span className="inline-flex items-center justify-center rounded-xl border border-edge px-6 py-3 text-sm font-medium text-ink-dim">
              Submissions locked
            </span>
          )}
        </div>
      </section>

      {/* Stat tiles */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Teams" value={brackets.length} sub="brackets in play" icon={<IconUsers />} />
        <StatTile
          label="Houseguests left"
          value={
            <>
              {activeCount}
              <span className="text-base font-normal text-ink-dim"> / {season.houseguest_count}</span>
            </>
          }
          sub="still in the house"
          icon={<IconHome />}
        />
        <StatTile label="Weeks scored" value={weeksPlayed} sub="so far this season" icon={<IconCalendar />} />
        <StatTile
          label="Current leader"
          value={leader ? leader.team_name : '—'}
          sub={leader ? `${leader.total_score.toFixed(2)} points` : 'no brackets yet'}
          icon={<IconTrophy />}
        />
      </section>

      {/* Standings + latest week */}
      <section className="mt-6 grid gap-6 lg:grid-cols-5">
        <Card className="overflow-hidden lg:col-span-3">
          <div className="flex items-center justify-between border-b border-edge px-5 py-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-mid">Standings</h2>
            <Link href="/leaderboard" className="text-sm font-medium text-gold transition-colors hover:text-gold-bright">
              Full leaderboard &rarr;
            </Link>
          </div>
          {standings.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-ink-dim">
              No brackets submitted yet — be the first.
            </p>
          ) : (
            <ul>
              {standings.slice(0, 6).map((b, i) => (
                <li key={b.id} className={i === 0 ? 'bg-gold/[0.04]' : ''}>
                  <Link
                    href={`/team/${b.id}`}
                    className="flex items-center gap-4 border-b border-edge/60 px-5 py-3.5 transition-colors last:border-0 hover:bg-white/[0.02]"
                  >
                    <span className="w-6 text-center text-sm">
                      <RankNumber rank={i + 1} />
                    </span>
                    <span className="flex-1 truncate text-sm font-medium text-ink">{b.team_name}</span>
                    <span className="w-8 text-center text-xs">
                      <RankChange change={rankChanges.get(b.id)} />
                    </span>
                    <span className="text-sm font-semibold text-gold tabular-nums">
                      {b.total_score.toFixed(2)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="lg:col-span-2">
          <div className="border-b border-edge px-5 py-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-mid">
              {latestWeek ? `Week ${latestWeek.week_number} results` : 'Latest week'}
            </h2>
          </div>
          {!latestWeek ? (
            <p className="px-5 py-10 text-center text-sm text-ink-dim">
              No weeks scored yet. Results appear here after the first week.
            </p>
          ) : (
            <div className="space-y-4 p-5">
              {[
                { label: 'Head of Household', hg: hgById.get(latestWeek.hoh_winner_id ?? '') },
                { label: 'Veto winner', hg: hgById.get(latestWeek.veto_winner_id ?? '') },
              ].map(({ label, hg }) => (
                <div key={label} className="flex items-center gap-3">
                  {hg ? <Avatar name={hg.name} photoUrl={hg.photo_url} size="sm" /> : <Avatar name="?" size="sm" />}
                  <div className="min-w-0">
                    <p className="text-xs uppercase tracking-wider text-ink-dim">{label}</p>
                    <p className="truncate text-sm font-medium text-ink">{hg?.name ?? 'None'}</p>
                  </div>
                </div>
              ))}
              <div className="flex items-center gap-3">
                {(() => {
                  const evicted = hgById.get(latestWeek.evicted_houseguest_id ?? '');
                  return (
                    <>
                      {evicted ? (
                        <Avatar name={evicted.name} photoUrl={evicted.photo_url} size="sm" />
                      ) : (
                        <Avatar name="?" size="sm" />
                      )}
                      <div className="min-w-0">
                        <p className="text-xs uppercase tracking-wider text-ink-dim">Evicted</p>
                        <p className="truncate text-sm font-medium text-red-400">
                          {evicted?.name ?? 'None'}
                        </p>
                      </div>
                    </>
                  );
                })()}
              </div>
              {latestSurvivors.length > 0 && (
                <div className="border-t border-edge pt-4">
                  <p className="mb-2 text-xs uppercase tracking-wider text-ink-dim">
                    Survived the block
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {latestSurvivors.map((hg) => (
                      <span
                        key={hg!.id}
                        className="rounded-full border border-edge bg-raised px-2.5 py-1 text-xs text-ink-mid"
                      >
                        {hg!.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {hasRecap && (
                <div className="space-y-2.5 border-t border-edge pt-4">
                  <p className="text-xs uppercase tracking-wider text-ink-dim">Recap</p>
                  {mvp && (
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="shrink-0 text-ink-dim">Week MVP</span>
                      <span className="truncate text-right font-medium text-ink">
                        {mvp.name}{' '}
                        <span className="font-semibold text-emerald-400 tabular-nums">
                          +{mvp.delta} pts
                        </span>
                      </span>
                    </div>
                  )}
                  {hotTeam && (
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="shrink-0 text-ink-dim">Team of the week</span>
                      <span className="truncate text-right font-medium text-ink">
                        {hotTeam.name}{' '}
                        <span className="font-semibold text-emerald-400 tabular-nums">
                          +{hotTeam.delta.toFixed(2)}
                        </span>
                      </span>
                    </div>
                  )}
                  {riser && (
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="shrink-0 text-ink-dim">Biggest riser</span>
                      <span className="truncate text-right font-medium text-ink">
                        {riser.name}{' '}
                        <span className="font-semibold text-emerald-400 tabular-nums">
                          &uarr;{riser.change}
                        </span>
                      </span>
                    </div>
                  )}
                  {faller && (
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="shrink-0 text-ink-dim">Biggest faller</span>
                      <span className="truncate text-right font-medium text-ink">
                        {faller.name}{' '}
                        <span className="font-semibold text-red-400 tabular-nums">
                          &darr;{Math.abs(faller.change)}
                        </span>
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </Card>
      </section>

      {/* Scoring reference */}
      <section className="mt-12 pb-16">
        <h2 className="mb-1 text-xl font-bold tracking-tight text-ink">How scoring works</h2>
        <p className="mb-6 text-sm text-ink-mid">
          Every pick earns base points, multiplied by where you drafted them.
        </p>
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="p-5">
            <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-gold">
              Weekly events
            </h3>
            <ul className="space-y-3 text-sm">
              {[
                ['HOH win', '7 pts'],
                ['Veto win', '5 pts'],
                ['Surviving the block', '2 pts'],
              ].map(([label, pts]) => (
                <li key={label} className="flex items-center justify-between">
                  <span className="text-ink-mid">{label}</span>
                  <span className="font-semibold text-ink tabular-nums">{pts}</span>
                </li>
              ))}
            </ul>
          </Card>
          <Card className="p-5">
            <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-gold">
              Draft multipliers
            </h3>
            <ul className="space-y-3 text-sm">
              {(['1st', '2nd', '3rd', '4th', '5th'] as const).map((pos, i) => (
                <li key={pos} className="flex items-center justify-between">
                  <span className="text-ink-mid">{pos} pick</span>
                  <span className="font-semibold text-ink tabular-nums">
                    {[1.5, 1.25, 1.0, 0.75, 0.5][i]}&times;
                  </span>
                </li>
              ))}
            </ul>
          </Card>
          <Card className="p-5">
            <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-gold">
              Placement points
            </h3>
            <p className="mb-3 text-sm text-ink-mid">
              Awarded for final finish, from 40 points for the winner down to 0 for first out.
            </p>
            <div className="grid grid-cols-4 gap-1.5 text-center text-xs">
              {[
                ['1st', '40'],
                ['2nd', '35'],
                ['3rd', '30'],
                ['4th', '27'],
                ['5th', '25'],
                ['8th', '17'],
                ['12th', '8'],
                ['Last', '0'],
              ].map(([place, pts], i) => (
                <div
                  key={place}
                  className={`rounded-lg border px-1 py-1.5 ${
                    i === 0 ? 'border-gold/30 bg-gold/[0.06]' : 'border-edge bg-raised'
                  }`}
                >
                  <div className="text-ink-dim">{place}</div>
                  <div className={`font-semibold tabular-nums ${i === 0 ? 'text-gold' : 'text-ink'}`}>
                    {pts}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </section>
    </div>
  );
}
