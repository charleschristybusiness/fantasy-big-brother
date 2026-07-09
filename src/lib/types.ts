export interface Season {
  id: string;
  name: string;
  houseguest_count: number;
  submissions_locked: boolean;
  brackets_hidden: boolean;
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

export interface WeeklyRanking {
  id: string;
  season_id: string;
  bracket_id: string;
  week_number: number;
  rank: number;
  total_score: number;
  created_at: string;
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

// Points by final placement (1 = winner), independent of cast size.
// Places 16th and beyond earn 0 — works for 16- and 17-houseguest seasons alike.
export const PLACEMENT_POINTS_BY_PLACE: Record<number, number> = {
  1: 40,
  2: 35,
  3: 30,
  4: 27,
  5: 25,
  6: 22,
  7: 20,
  8: 17,
  9: 15,
  10: 12,
  11: 10,
  12: 8,
  13: 6,
  14: 4,
  15: 2,
};

export const POINT_VALUES = {
  HOH_WIN: 7,
  VETO_WIN: 5,
  BLOCK_SURVIVAL: 2,
} as const;
