export interface Season {
  id: string;
  name: string;
  houseguest_count: number;
  submissions_locked: boolean;
  status: 'active' | 'completed';
  admin_password: string;
  created_at: string;
}

export interface Houseguest {
  id: string;
  season_id: string;
  name: string;
  photo_url: string | null;
  status: 'active' | 'evicted' | 'winner' | 'runner_up';
  eviction_order: number | null;
  created_at: string;
}

export interface Bracket {
  id: string;
  season_id: string;
  team_name: string;
  pick_1_houseguest_id: string;
  pick_2_houseguest_id: string;
  pick_3_houseguest_id: string;
  pick_4_houseguest_id: string;
  pick_5_houseguest_id: string;
  total_score: number;
  created_at: string;
}

export interface WeeklyEvent {
  id: string;
  season_id: string;
  week_number: number;
  hoh_winner_id: string | null;
  veto_winner_id: string | null;
  evicted_houseguest_id: string | null;
  created_at: string;
}

export interface BlockSurvivor {
  id: string;
  weekly_event_id: string;
  houseguest_id: string;
}

// Computed types for display
export interface HouseguestStats {
  houseguest: Houseguest;
  hoh_wins: number;
  veto_wins: number;
  block_survivals: number;
  placement_points: number;
  base_score: number;
}

export interface BracketWithPicks extends Bracket {
  picks: {
    position: number;
    multiplier: number;
    houseguest: Houseguest;
    stats: HouseguestStats;
    pick_score: number;
  }[];
}

export const DRAFT_MULTIPLIERS = [1.5, 1.25, 1.0, 0.75, 0.5] as const;

export const PLACEMENT_POINTS: Record<number, number> = {
  1: 0,   // 16th place (first out)
  2: 2,   // 15th
  3: 4,   // 14th
  4: 6,   // 13th
  5: 8,   // 12th
  6: 10,  // 11th
  7: 12,  // 10th
  8: 15,  // 9th
  9: 17,  // 8th
  10: 20, // 7th
  11: 22, // 6th
  12: 25, // 5th
  13: 27, // 4th
  14: 30, // 3rd
  15: 35, // 2nd (runner-up)
  16: 40, // 1st (winner)
};

export const POINT_VALUES = {
  HOH_WIN: 7,
  VETO_WIN: 5,
  BLOCK_SURVIVAL: 2,
} as const;
