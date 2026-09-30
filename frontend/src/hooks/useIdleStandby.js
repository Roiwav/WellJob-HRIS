import { useCallback, useEffect, useRef, useState } from "react";

const DEFAULT_IDLE_TIMEOUT_MS = 3 * 60 * 1000;
const DEFAULT_WAKE_DELAY_MS = 600;
const ACTIVITY_THROTTLE_MS = 350;

export default function useIdleStandby({
  enabled = true,
  timeoutMs = DEFAULT_IDLE_TIMEOUT_MS,
  wakeDelayMs = DEFAULT_WAKE_DELAY_MS,
} = {}) {
  const [isIdle, setIsIdle] = useState(false);

  const timerRef = useRef(null);
  const wakeTimerRef = useRef(null);
  const isIdleRef = useRef(false);
  const lastActivityRef = useRef(0);

  const clearIdleTimer = useCallback(() => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const clearWakeTimer = useCallback(() => {
    if (wakeTimerRef.current) {
      window.clearTimeout(wakeTimerRef.current);
      wakeTimerRef.current = null;
    }
  }, []);

  const armIdleTimer = useCallback(() => {
    clearIdleTimer();

    const normalizedTimeout = Number(timeoutMs);

    if (
      !enabled ||
      !Number.isFinite(normalizedTimeout) ||
      normalizedTimeout <= 0
    ) {
      return;
    }

    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      isIdleRef.current = true;
      setIsIdle(true);
    }, normalizedTimeout);
  }, [clearIdleTimer, enabled, timeoutMs]);

  const wake = useCallback(() => {
    if (!enabled) {
      return;
    }

    if (!isIdleRef.current) {
      armIdleTimer();
      return;
    }

    if (wakeTimerRef.current) {
      return;
    }

    const normalizedDelay = Math.max(0, Number(wakeDelayMs) || 0);

    wakeTimerRef.current = window.setTimeout(() => {
      wakeTimerRef.current = null;
      isIdleRef.current = false;
      setIsIdle(false);
      armIdleTimer();
    }, normalizedDelay);
  }, [armIdleTimer, enabled, wakeDelayMs]);

  useEffect(() => {
    if (!enabled) {
      clearIdleTimer();
      clearWakeTimer();
      isIdleRef.current = false;
      return undefined;
    }

    const handleActivity = () => {
      const now = Date.now();

      if (
        !isIdleRef.current &&
        now - lastActivityRef.current < ACTIVITY_THROTTLE_MS
      ) {
        return;
      }

      lastActivityRef.current = now;
      wake();
    };

    const passiveEvents = [
      "pointermove",
      "pointerdown",
      "wheel",
      "touchstart",
      "scroll",
    ];

    passiveEvents.forEach((eventName) => {
      window.addEventListener(eventName, handleActivity, {
        passive: true,
      });
    });

    window.addEventListener("keydown", handleActivity);

    armIdleTimer();

    return () => {
      clearIdleTimer();
      clearWakeTimer();

      passiveEvents.forEach((eventName) => {
        window.removeEventListener(eventName, handleActivity);
      });

      window.removeEventListener("keydown", handleActivity);
    };
  }, [
    armIdleTimer,
    clearIdleTimer,
    clearWakeTimer,
    enabled,
    wake,
  ]);

  return {
    isIdle: enabled ? isIdle : false,
    wake,
    resetIdleTimer: wake,
  };
}