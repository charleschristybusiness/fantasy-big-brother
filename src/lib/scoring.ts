import {
  Houseguest,
  WeeklyEvent,
  BlockSurvivor,
  Bracket,
  HouseguestStats,
  BracketWithPicks,
  DRAFT_MULTIPLIERS,
  PLACEMENT_POINTS,
  POINT_VALUES,
} from './types';

export function getPlacementPoints(houseguest: Houseguest, totalHouseguests: number, evictedCount: number = 0): number {
  if (houseguest.status === 'winner') {
    return PLACEMENT_POINTS[totalHouseguests] || 40;
  }
  if (houseguest.status === 'runner_up') {
    return PLACEMENT_POINTS[totalHouseguests - 1] || 35;
  }
  if (houseguest.eviction_order !== null) {
    return PLACEMENT_POINTS[houseguest.eviction_order] || 0;
  }
  // Active houseguests get minimum guaranteed placement points
  // If 5 have been evicted from 16, remaining players are guaranteed at least 6th place
  // which corresponds to eviction_order = totalHouseguests - evictedCount
  if (houseguest.status === 'active' && evictedCount > 0) {
    const minPlacement = evictedCount + 1;
    return PLACEMENT_POINTS[minPlacement] || 0;
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
  const hoh_wins = weeklyEvents.filter((e) => e.hoh_winner_id === houseguest.id).length;
  const veto_wins = weeklyEvents.filter((e) => e.veto_winner_id === houseguest.id).length;
  const block_survivals = blockSurvivors.filter((bs) => bs.houseguest_id === houseguest.id).length;
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
