import { useCallback, useState } from "react";
import { useLocation } from "react-router-dom";

import { useAuth } from "../../context/useAuth";
import useIdleStandby from "../../hooks/useIdleStandby";
import WelljobStandbyScreen from "./WelljobStandbyScreen";

const DEFAULT_IDLE_TIMEOUT_MS = 3 * 60 * 1000;
const DEFAULT_WAKE_DELAY_MS = 600;

export default function StandbyExperience({
  idleTimeoutMs = DEFAULT_IDLE_TIMEOUT_MS,
  wakeDelayMs = DEFAULT_WAKE_DELAY_MS,
}) {
  const location = useLocation();
  const { user } = useAuth();

  const [dismissedLoginVisitKey, setDismissedLoginVisitKey] = useState("");

  const isLoginRoute = location.pathname === "/login";
  const loginVisitKey = location.key || "login";

  const shouldShowLoginIntro =
    isLoginRoute &&
    !user &&
    dismissedLoginVisitKey !== loginVisitKey;

  const shouldMonitorIdle = Boolean(user) && !shouldShowLoginIntro;

  const { isIdle, wake } = useIdleStandby({
    enabled: shouldMonitorIdle,
    timeoutMs: idleTimeoutMs,
    wakeDelayMs,
  });

  const handleIntroDismiss = useCallback(() => {
    setDismissedLoginVisitKey(loginVisitKey);
  }, [loginVisitKey]);

  if (shouldShowLoginIntro) {
    return (
      <WelljobStandbyScreen
        mode="intro"
        onDismiss={handleIntroDismiss}
      />
    );
  }

  if (shouldMonitorIdle && isIdle) {
    return (
      <WelljobStandbyScreen
        mode="idle"
        onDismiss={wake}
      />
    );
  }

  return null;
}