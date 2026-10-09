export type PatrolSettings = {
  enabled: boolean;
  interval: string;
  startupJitter: string;
  minAccountInterval: string;
  accountJitter: string;
  minRemain: number;
  requestTimeout: string;
  model: string;
};

export type PatrolLastResult = {
  at: string;
  result: string;
  remain?: number;
};

export type PatrolAccount = {
  id: string;
  name: string;
  email: string;
  provider: string;
  disabled: boolean;
  disabledReason: string;
  region: string;
  activityEligible: boolean;
  webDailyEligible: boolean;
  credits?: PatrolLastResult;
  activity?: PatrolLastResult;
  webDaily?: PatrolLastResult;
};

export type BuddyPatrolState = {
  homeMode: boolean;
  credits: PatrolSettings;
  activity: PatrolSettings;
  webDaily: PatrolSettings;
  accounts: PatrolAccount[];
};

export type PatrolKind = 'credits' | 'activity' | 'webDaily';

export type PatrolSettingsPatch = {
  enabled?: boolean;
  interval?: string;
  minAccountInterval?: string;
  minRemain?: number;
  model?: string;
};
