export const createLatestUsageRequestGuard = () => {
  let latestRequestId = 0;

  return {
    begin: () => ++latestRequestId,
    isLatest: (requestId: number) => requestId === latestRequestId,
    invalidate: () => {
      latestRequestId += 1;
    },
  };
};
