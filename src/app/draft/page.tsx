import { supabase } from '@/lib/supabase';
import { Season, Houseguest, Bracket, WeeklyEvent, BlockSurvivor } from '@/lib/types';
import { getHouseguestStats } from '@/lib/scoring';
import {
  Card,
  PageHeader,
  EmptyState,
  NoSeason,
  Avatar,
  StatusBadge,
  StatTile,
  IconUsers,
  IconTrophy,
  IconEye,
  IconHome,
  thCls,
  trCls,
} from '@/components/ui';

export const dynamic = 'force-dynamic';

interface DraftRow {
  houseguest: Houseguest;
  count: number;
  pct: number;
  avgPick: number | null;
  firstPicks: number;
  points: number;
}

export default async function DraftBoardPage() {
  const { data: seasonData } = await supabase
    .from('seasons')
    .select('*')
    .eq('status', 'active')
    .limit(1)
    .single();

  const season = seasonData as Season | null;
  if (!season) {
    return <NoSeason />;
  }

  if (season.brackets_hidden) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-12">
        <PageHeader eyebrow="Analytics" title="Draft board" subtitle={season.name} />
        <EmptyState
          title="Brackets are hidden"
          hint="Ownership stats unlock once the admin reveals everyone's picks."
        />
      </div>
    );
  }

  const [
    { data: hgData },
    { data: bracketData },
    { data: eventsData },
    { data: survivorsData },
  ] = await Promise.all([
    supabase.from('houseguests').select('*').eq('season_id', season.id),
    supabase.from('brackets').select('*').eq('season_id', season.id),
    supabase.from('weekly_events').select('*').eq('season_id', season.id),
    supabase.from('block_survivors').select('*, weekly_events!inner(season_id)').eq('weekly_events.season_id', season.id),
  ]);

  const houseguests = (hgData || []) as Houseguest[];
  const brackets = (bracketData || []) as Bracket[];
  const events = (eventsData || []) as WeeklyEvent[];
  const survivors = (survivorsData || []) as BlockSurvivor[];

  if (brackets.length === 0) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-12">
        <PageHeader eyebrow="Analytics" title="Draft board" subtitle={season.name} />
        <EmptyState
          title="No brackets submitted yet"
          hint="Draft analytics appear once the first bracket is in."
        />
      </div>
    );
  }

  const evictedCount = houseguests.filter((h) => h.status === 'evicted').length;
  const totalTeams = brackets.length;

  const rows: DraftRow[] = houseguests
    .map((hg) => {
      const positions: number[] = [];
      for (const b of brackets) {
        const pickIds = [
          b.pick_1_houseguest_id,
          b.pick_2_houseguest_id,
          b.pick_3_houseguest_id,
          b.pick_4_houseguest_id,
          b.pick_5_houseguest_id,
        ];
        const idx = pickIds.indexOf(hg.id);
        if (idx >= 0) positions.push(idx + 1);
      }
      const count = positions.length;
      return {
        houseguest: hg,
        count,
        pct: (count / totalTeams) * 100,
        avgPick: count > 0 ? positions.reduce((a, b) => a + b, 0) / count : null,
        firstPicks: positions.filter((p) => p === 1).length,
        points: getHouseguestStats(hg, events, survivors, season.houseguest_count, evictedCount).base_score,
      };
    })
    .sort((a, b) => b.count - a.count || (a.avgPick ?? 6) - (b.avgPick ?? 6) || b.points - a.points);

  const mostDrafted = rows[0];
  const topFirstPick = [...rows].sort((a, b) => b.firstPicks - a.firstPicks)[0];
  const draftedCount = rows.filter((r) => r.count > 0).length;

  // Hidden gem: best scorer among houseguests on a third of teams or fewer
  const gemCandidates = rows.filter((r) => r.count > 0 && r.pct <= 34);
  const hiddenGem = gemCandidates.length > 0
    ? [...gemCandidates].sort((a, b) => b.points - a.points)[0]
    : null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <PageHeader
        eyebrow="Analytics"
        title="Draft board"
        subtitle={`${season.name} — who the league believed in, and who's paying it off`}
      />

      {/* Summary tiles */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile
          label="League favorite"
          value={mostDrafted.houseguest.name}
          sub={`on ${mostDrafted.count} of ${totalTeams} teams`}
          icon={<IconUsers />}
        />
        <StatTile
          label="Top first pick"
          value={topFirstPick.firstPicks > 0 ? topFirstPick.houseguest.name : '—'}
          sub={
            topFirstPick.firstPicks > 0
              ? `drafted #1 by ${topFirstPick.firstPicks} team${topFirstPick.firstPicks !== 1 ? 's' : ''}`
              : 'no #1 picks yet'
          }
          icon={<IconTrophy />}
        />
        <StatTile
          label="Hidden gem"
          value={hiddenGem ? hiddenGem.houseguest.name : '—'}
          sub={
            hiddenGem
              ? `${hiddenGem.points} pts on only ${hiddenGem.count} team${hiddenGem.count !== 1 ? 's' : ''}`
              : 'no low-owned standouts'
          }
          icon={<IconEye />}
        />
        <StatTile
          label="House coverage"
          value={
            <>
              {draftedCount}
              <span className="text-base font-normal text-ink-dim"> / {houseguests.length}</span>
            </>
          }
          sub="houseguests on at least one team"
          icon={<IconHome />}
        />
      </div>

      {/* Ownership table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-edge">
                <th className={thCls}>Houseguest</th>
                <th className={`${thCls} text-center`}>Status</th>
                <th className={thCls}>Ownership</th>
                <th className={`${thCls} text-right`}>Teams</th>
                <th className={`${thCls} text-right`}>Avg pick</th>
                <th className={`${thCls} text-right`}>#1 picks</th>
                <th className={`${thCls} text-right`}>Points</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.houseguest.id} className={trCls}>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-3">
                      <Avatar name={row.houseguest.name} photoUrl={row.houseguest.photo_url} size="sm" />
                      <span className="font-medium text-ink">{row.houseguest.name}</span>
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <StatusBadge status={row.houseguest.status} />
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-3">
                      <span className="h-1.5 w-24 shrink-0 overflow-hidden rounded-full bg-raised sm:w-32" aria-hidden>
                        <span
                          className="block h-full rounded-full bg-gold"
                          style={{ width: `${row.pct}%` }}
                        />
                      </span>
                      <span className="text-xs text-ink-mid tabular-nums">{Math.round(row.pct)}%</span>
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-ink-mid tabular-nums">{row.count}</td>
                  <td className="px-4 py-3 text-right text-ink-mid tabular-nums">
                    {row.avgPick !== null ? row.avgPick.toFixed(1) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-ink-mid tabular-nums">
                    {row.firstPicks > 0 ? row.firstPicks : '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-gold tabular-nums">{row.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <p className="mt-4 text-center text-sm text-ink-dim tabular-nums">
        {totalTeams} team{totalTeams !== 1 ? 's' : ''} &middot; {draftedCount} of {houseguests.length} houseguests drafted
      </p>
    </div>
  );
}
