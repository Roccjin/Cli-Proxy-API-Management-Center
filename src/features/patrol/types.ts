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
  credits?: PatrolLastResult;
  activity?: PatrolLastResult;
};

export type BuddyPatrolState = {
  homeMode: boolean;
  credits: PatrolSettings;
  activity: PatrolSettings;
  accounts: PatrolAccount[];
};

export type PatrolSettingsPatch = {
  enabled?: boolean;
  interval?: string;
  minAccountInterval?: string;
  model?: string;
};
