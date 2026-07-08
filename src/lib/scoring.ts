import {
  Houseguest,
  WeeklyEvent,
  BlockSurvivor,
  Bracket,
  HouseguestStats,
  BracketWithPicks,
  DRAFT_MULTIPLIERS,
  PLACEMENT_POINTS_BY_PLACE,
  POINT_VALUES,
} from './types';

function pointsForPlace(place: number): number {
  return PLACEMENT_POINTS_BY_PLACE[place] ?? 0;
}

export function getPlacementPoints(houseguest: Houseguest, totalHouseguests: number, evictedCount: number = 0): number {
  if (houseguest.status === 'winner') {
    return pointsForPlace(1);
  }
  if (houseguest.status === 'runner_up') {
    return pointsForPlace(2);
  }
  if (houseguest.eviction_order !== null) {
    // eviction_order 1 = first out = last place
    return pointsForPlace(totalHouseguests - houseguest.eviction_order + 1);
  }
  // Active houseguests get minimum guaranteed placement points:
  // with 5 of 17 evicted, everyone left is guaranteed at least 12th place
  if (houseguest.status === 'active' && evictedCount > 0) {
    return pointsForPlace(totalHouseguests - evictedCount);
  }
  return 0;
}

export function getHouseguestStats(
  houseguest: Houseguest,
  weeklyEvents: WeeklyEvent[],
  blockSurvivors: BlockSurvivor[],
  totalHouseguests: number,
  evictedCount: number = 0
): HouseguestStats {
  // week_number 0 is the live house-state sentinel (current HOH / veto holder /
  // nominees for display) — it never awards points
  const scoredEvents = weeklyEvents.filter((e) => e.week_number >= 1);
  const scoredEventIds = new Set(scoredEvents.map((e) => e.id));
  const scoredSurvivors = blockSurvivors.filter((bs) => scoredEventIds.has(bs.weekly_event_id));

  const hoh_wins = scoredEvents.filter((e) => e.hoh_winner_id === houseguest.id).length;
  const veto_wins = scoredEvents.filter((e) => e.veto_winner_id === houseguest.id).length;
  const block_survivals = scoredSurvivors.filter((bs) => bs.houseguest_id === houseguest.id).length;
  const placement_points = getPlacementPoints(houseguest, totalHouseguests, evictedCount);

  const base_score =
    hoh_wins * POINT_VALUES.HOH_WIN +
    veto_wins * POINT_VALUES.VETO_WIN +
    block_survivals * POINT_VALUES.BLOCK_SURVIVAL +
    placement_points;

  return {
    houseguest,
    hoh_wins,
    veto_wins,
    block_survivals,
    placement_points,
    base_score,
  };
}

export function calculateBracketScore(
  bracket: Bracket,
  houseguests: Houseguest[],
  weeklyEvents: WeeklyEvent[],
  blockSurvivors: BlockSurvivor[],
  totalHouseguests: number
): BracketWithPicks {
  const pickIds = [
    bracket.pick_1_houseguest_id,
    bracket.pick_2_houseguest_id,
    bracket.pick_3_houseguest_id,
    bracket.pick_4_houseguest_id,
    bracket.pick_5_houseguest_id,
  ];

  const evictedCount = houseguests.filter((h) => h.status === 'evicted').length;

  const picks = pickIds.map((id, index) => {
    const houseguest = houseguests.find((h) => h.id === id)!;
    const stats = getHouseguestStats(houseguest, weeklyEvents, blockSurvivors, totalHouseguests, evictedCount);
    const multiplier = DRAFT_MULTIPLIERS[index];
    const pick_score = Math.round(stats.base_score * multiplier * 100) / 100;

    return {
      position: index + 1,
      multiplier,
      houseguest,
      stats,
      pick_score,
    };
  });

  const total_score = picks.reduce((sum, p) => sum + p.pick_score, 0);

  return {
    ...bracket,
    total_score: Math.round(total_score * 100) / 100,
    picks,
  };
}
