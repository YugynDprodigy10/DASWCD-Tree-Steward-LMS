export function createVisibleTimer(startedAt, isVisible) {
  let accumulatedMilliseconds = 0;
  let visible = isVisible;
  let activeSince = isVisible ? startedAt : null;

  return {
    seconds(now) {
      const currentMilliseconds = visible
        ? Math.max(0, now - activeSince)
        : 0;
      return Math.floor(
        (accumulatedMilliseconds + currentMilliseconds) / 1000,
      );
    },
    setVisible(nextVisible, now) {
      if (nextVisible === visible) return;
      if (visible) {
        accumulatedMilliseconds += Math.max(0, now - activeSince);
      }
      visible = nextVisible;
      activeSince = nextVisible ? now : null;
    },
  };
}
