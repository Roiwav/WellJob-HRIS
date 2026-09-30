import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiAlertCircle,
  FiAlertTriangle,
  FiBell,
  FiChevronDown,
  FiChevronRight,
  FiClock,
  FiEye,
  FiLogOut,
  FiSettings,
  FiUser,
} from "react-icons/fi";
import { API_BASE } from "../config/api";
import { useAuth } from "../context/useAuth";
import useSmartNotifications from "../hooks/useSmartNotifications";
import SmartAlertToast from "./notifications/SmartAlertToast";
import {
  formatSmartAlertDate,
  getAlertPriorityClasses,
} from "../utils/notifications/smartNotifications";
const ROLE_CONFIGS = {
  HR_MANAGER: {
    label: "HM",
    color: "bg-blue-600",
    roleName: "HR Manager",
  },
  HR_STAFF: {
    label: "HS",
    color: "bg-amber-500",
    roleName: "HR Staff",
  },
  HR_COORDINATOR: {
    label: "HC",
    color: "bg-violet-600",
    roleName: "HR Coordinator",
  },
  IT_SUPPORT: {
    label: "IT",
    color: "bg-green-600",
    roleName: "IT Support",
  },
  SUPER_ADMIN: {
    label: "SA",
    color: "bg-red-600",
    roleName: "Super Admin",
  },
};
const DEFAULT_ROLE_CONFIG = {
  label: "US",
  color: "bg-gray-500",
  roleName: "User",
};
const SMART_ALERT_POLL_INTERVAL = 30000;
const RECOVERY_STATUS_URL = `${API_BASE}/auth/recovery-email-status`;
function normalizeRole(value) {
  const role = String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
  if (["SUPERADMIN", "SUPER_ADMIN", "ADMIN"].includes(role)) {
    return "SUPER_ADMIN";
  }
  if (["HRMANAGER", "HR_MANAGER"].includes(role)) {
    return "HR_MANAGER";
  }
  if (["HRSTAFF", "HR_STAFF"].includes(role)) {
    return "HR_STAFF";
  }
  if (["HRCOORDINATOR", "HR_COORDINATOR"].includes(role)) {
    return "HR_COORDINATOR";
  }
  if (["ITSUPPORT", "IT_SUPPORT"].includes(role)) {
    return "IT_SUPPORT";
  }
  return role || "USER";
}
function getAlertKey(alert) {
  return String(alert?.alertKey ||
    alert?.id ||
    "");
}
function getAlertStatusClasses(status) {
  const normalized = String(status || "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
  if (normalized === "open") {
    return "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/15 dark:text-blue-300";
  }
  if (normalized === "investigating") {
    return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-300";
  }
  if (normalized === "for review") {
    return "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-500/30 dark:bg-violet-500/15 dark:text-violet-300";
  }
  if (normalized === "closed") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-300";
  }
  return "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300";
}
function useAuthenticatedAvatar(userId, avatarFilename) {
  const [avatarState, setAvatarState] = useState({
    key: null,
    url: null,
  });
  const avatarKey = userId &&
    avatarFilename
    ? `${userId}:${avatarFilename}`
    : null;
  useEffect(() => {
    if (!avatarKey) {
      return undefined;
    }
    const token = localStorage.getItem("token");
    if (!token) {
      return undefined;
    }
    const controller = new AbortController();
    let objectUrl = null;
    async function loadAvatar() {
      try {
        const response = await fetch(`${API_BASE}/users/${encodeURIComponent(userId)}/avatar`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) {
          return;
        }
        const type = String(response.headers.get("content-type") || "").toLowerCase();
        if (!type.startsWith("image/webp")) {
          return;
        }
        const blob = await response.blob();
        if (controller.signal.aborted) {
          return;
        }
        objectUrl =
          URL.createObjectURL(blob);
        if (controller.signal.aborted) {
          URL.revokeObjectURL(objectUrl);
          objectUrl = null;
          return;
        }
        setAvatarState({
          key: avatarKey,
          url: objectUrl,
        });
      }
      catch (error) {
        if (error.name !==
          "AbortError") {
          console.error("Unable to load profile picture:", error);
        }
      }
    }
    void loadAvatar();
    return () => {
      controller.abort();
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [
    avatarKey,
    userId,
  ]);
  return avatarKey &&
    avatarState.key === avatarKey
    ? avatarState.url
    : null;
}
function AvatarCircle({ imageUrl, roleConfig, showUserIcon = false, size = "small", }) {
  return (<div className={[
      "flex shrink-0 items-center justify-center overflow-hidden rounded-full text-xs font-bold text-white",
      size === "large"
        ? "h-11 w-11"
        : "h-9 w-9",
      roleConfig.color,
    ].join(" ")}>

   {imageUrl ? (<img src={imageUrl} alt="" className="h-full w-full object-cover"/>) : showUserIcon ? (<FiUser size={17} aria-hidden="true"/>) : (roleConfig.label)}

  </div>);
}
export default function Navbar({ title = "Welljob Solutions & General Services", }) {
  const navigate = useNavigate();
  const { user, setUser, } = useAuth();
  const [openProfile, setOpenProfile] = useState(false);
  const [openNotifications, setOpenNotifications] = useState(false);
  const [animateNotificationBell, setAnimateNotificationBell] = useState(false);
  const profileRef = useRef(null);
  const notificationRef = useRef(null);
  const previousPopupAlertKeyRef = useRef("");
  const bellAnimationTimerRef = useRef(null);
  const [recoveryStatus, setRecoveryStatus] = useState("loading");
  const [recoveryStatusError, setRecoveryStatusError] = useState("");
  const recoveryRequestSequenceRef = useRef(0);
  const userId = user?.id;
  const refreshRecoveryStatus = useCallback(async () => {
    const sequence = ++recoveryRequestSequenceRef.current;
    const token = String(localStorage.getItem("token") || "").trim();
    if (!userId ||
      !token) {
      setRecoveryStatus("loading");
      setRecoveryStatusError("");
      return;
    }
    try {
      const response = await fetch(RECOVERY_STATUS_URL, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      });
      const data = await response
        .json()
        .catch(() => null);
      if (!response.ok) {
        throw new Error(data?.message ||
          (response.status ===
            401
            ? "Session expired. Please sign in again."
            : "Unable to check recovery email status."));
      }
      if (typeof data?.registered !==
        "boolean" ||
        typeof data?.verified !==
          "boolean") {
        throw new Error("Invalid recovery email status response.");
      }
      if (sequence !==
        recoveryRequestSequenceRef.current) {
        return;
      }
      setRecoveryStatus(data.verified
        ? "verified"
        : data.registered
          ? "unverified"
          : "unregistered");
      setRecoveryStatusError("");
    }
    catch (error) {
      if (sequence !==
        recoveryRequestSequenceRef.current) {
        return;
      }
      setRecoveryStatus("error");
      setRecoveryStatusError(error?.message ||
        "Unable to check recovery email status.");
    }
  }, [userId]);
  useEffect(() => {
    setRecoveryStatus("loading");
    setRecoveryStatusError("");
    void refreshRecoveryStatus();
    return () => {
      recoveryRequestSequenceRef.current += 1;
    };
  }, [
    refreshRecoveryStatus,
  ]);
  useEffect(() => {
    if (!userId) {
      return undefined;
    }
    const onFocus = () => {
      void refreshRecoveryStatus();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState ===
        "visible") {
        void refreshRecoveryStatus();
      }
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [
    userId,
    refreshRecoveryStatus,
  ]);
  const needsRecoveryVerification = recoveryStatus ===
    "unregistered" ||
    recoveryStatus ===
      "unverified";
  const currentRole = normalizeRole(user?.role ||
    "USER");
  const isHRCoordinator = currentRole ===
    "HR_COORDINATOR";
  const { canView, latestAlerts, popupAlert, unreadCount, readAlertCount, hasReadAlerts, isFetching, isClearingRead, markAlertAsRead, dismissAlert, clearReadAlerts, } = useSmartNotifications(user, {
    pollInterval: SMART_ALERT_POLL_INTERVAL,
  });
  const canViewSmartNotifications = Boolean(canView &&
    !isHRCoordinator);
  const notificationsAreOpen = Boolean(canViewSmartNotifications &&
    openNotifications);
  const roleConfig = useMemo(() => ROLE_CONFIGS[currentRole] ||
    DEFAULT_ROLE_CONFIG, [currentRole]);
  const displayName = user?.name ||
    user?.fullName ||
    user?.fullname ||
    user?.full_name ||
    user?.username ||
    "User";
  const username = user?.username ||
    "-";
  const assignedCompany = String(user?.assignedCompany ??
    user?.assigned_company ??
    "").trim();
  const avatarFilename = user?.avatarFilename ??
    user?.avatar_filename ??
    null;
  const avatarImageUrl = useAuthenticatedAvatar(userId, avatarFilename);
  useEffect(() => {
    if (!canViewSmartNotifications) {
      previousPopupAlertKeyRef.current =
        "";
      if (bellAnimationTimerRef.current) {
        window.clearTimeout(bellAnimationTimerRef.current);
        bellAnimationTimerRef.current =
          null;
      }
      return undefined;
    }
    const key = getAlertKey(popupAlert);
    const previousKey = previousPopupAlertKeyRef.current;
    if (!key) {
      previousPopupAlertKeyRef.current =
        "";
      return undefined;
    }
    previousPopupAlertKeyRef.current =
      key;
    if (key === previousKey ||
      notificationsAreOpen) {
      return undefined;
    }
    let secondFrame;
    const firstFrame = window.requestAnimationFrame(() => {
      setAnimateNotificationBell(false);
      secondFrame =
        window.requestAnimationFrame(() => setAnimateNotificationBell(true));
    });
    if (bellAnimationTimerRef.current) {
      window.clearTimeout(bellAnimationTimerRef.current);
    }
    bellAnimationTimerRef.current =
      window.setTimeout(() => {
        setAnimateNotificationBell(false);
        bellAnimationTimerRef.current =
          null;
      }, 2600);
    return () => {
      window.cancelAnimationFrame(firstFrame);
      if (secondFrame) {
        window.cancelAnimationFrame(secondFrame);
      }
    };
  }, [
    canViewSmartNotifications,
    notificationsAreOpen,
    popupAlert,
  ]);
  useEffect(() => {
    const onPointerDown = (event) => {
      if (profileRef.current &&
        !profileRef.current.contains(event.target)) {
        setOpenProfile(false);
      }
      if (notificationRef.current &&
        !notificationRef.current.contains(event.target)) {
        setOpenNotifications(false);
      }
    };
    const onEscape = (event) => {
      if (event.key ===
        "Escape") {
        setOpenProfile(false);
        setOpenNotifications(false);
      }
    };
    if (openProfile ||
      notificationsAreOpen) {
      document.addEventListener("mousedown", onPointerDown);
      document.addEventListener("keydown", onEscape);
    }
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onEscape);
    };
  }, [
    openProfile,
    notificationsAreOpen,
  ]);
  useEffect(() => () => {
    if (bellAnimationTimerRef.current) {
      window.clearTimeout(bellAnimationTimerRef.current);
    }
  }, []);
  const stopBellAnimation = () => {
    setAnimateNotificationBell(false);
    if (bellAnimationTimerRef.current) {
      window.clearTimeout(bellAnimationTimerRef.current);
      bellAnimationTimerRef.current =
        null;
    }
  };
  const openAlertTarget = async (alert) => {
    if (!alert ||
      !canViewSmartNotifications) {
      return;
    }
    setOpenNotifications(false);
    stopBellAnimation();
    try {
      await markAlertAsRead(alert.alertKey);
    }
    catch (error) {
      console.error("Failed to mark smart alert as read:", error);
    }
    if (alert.route ===
      "/incidents" &&
      alert.incidentId) {
      navigate("/incidents", {
        state: {
          incidentId: alert.incidentId,
          action: alert.action ||
            alert.navigationAction ||
            "view",
        },
      });
      return;
    }
    navigate(alert.route ||
      "/notifications");
  };
  const handleToggleNotifications = () => {
    if (!canViewSmartNotifications) {
      return;
    }
    stopBellAnimation();
    setOpenNotifications((current) => !current);
    setOpenProfile(false);
  };
  const handleViewNotifications = () => {
    if (!canViewSmartNotifications) {
      return;
    }
    setOpenNotifications(false);
    navigate("/notifications");
  };
  const handleClearReadAlerts = async () => {
    if (!canViewSmartNotifications ||
      !hasReadAlerts ||
      isClearingRead) {
      return;
    }
    try {
      await clearReadAlerts();
    }
    catch (error) {
      console.error("Failed to clear read smart alerts:", error);
    }
  };
  const handleDismissToast = async (alert) => {
    if (!canViewSmartNotifications ||
      !alert?.alertKey) {
      return;
    }
    try {
      await dismissAlert(alert.alertKey);
    }
    catch (error) {
      console.error("Failed to dismiss smart alert:", error);
    }
  };
  const handleOpenProfileSettings = () => {
    setOpenProfile(false);
    setOpenNotifications(false);
    navigate("/profile-settings");
  };
  const handleLogout = () => {
    recoveryRequestSequenceRef.current +=
      1;
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    setUser(null);
    setOpenProfile(false);
    setOpenNotifications(false);
    navigate("/login", {
      replace: true,
    });
  };
  return (<>

   <div className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4 transition-colors duration-300 dark:border-white/10 dark:bg-slate-950">

    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">

     {title}

    </h2>

    <div className="flex items-center gap-3">

     {canViewSmartNotifications && (<div className="relative" ref={notificationRef}>

       <button type="button" onClick={handleToggleNotifications} className="relative flex h-10 w-10 items-center justify-center rounded-xl text-gray-600 transition hover:bg-gray-100 hover:text-indigo-600 focus:outline-none focus:ring-4 focus:ring-indigo-500/15 dark:text-gray-300 dark:hover:bg-white/10 dark:hover:text-white" title="Smart Alerts" aria-label={`Smart Alerts${unreadCount > 0
        ? `, ${unreadCount} unread`
        : ""}`} aria-expanded={notificationsAreOpen} aria-haspopup="dialog">

        <FiBell size={20} aria-hidden="true" className={animateNotificationBell &&
        !notificationsAreOpen
        ? "notification-bell-icon-new"
        : ""}/>

        {unreadCount > 0 && (<span className="absolute -right-1 -top-1 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-[10px] font-extrabold text-white ring-2 ring-white dark:ring-slate-950">

          {unreadCount > 99
          ? "99+"
          : unreadCount}

         </span>)}

       </button>

       {notificationsAreOpen && (<div role="dialog" aria-label="Smart Alerts" className="absolute right-0 z-[80] mt-3 w-[min(440px,calc(100vw-2rem))] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl ring-1 ring-slate-900/5 dark:border-slate-800 dark:bg-slate-900 dark:ring-white/5">

         <div className="border-b border-slate-200 bg-slate-50/80 px-4 py-3.5 dark:border-slate-800 dark:bg-slate-950/50">

          <div className="flex items-start justify-between gap-3">

           <div className="flex min-w-0 items-start gap-3">

            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300">

             <FiBell aria-hidden="true"/>

            </div>

            <div className="min-w-0">

             <div className="flex flex-wrap items-center gap-2">

              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">

               Smart Alerts

              </h3>

              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${unreadCount > 0
          ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300"
          : "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"}`}>

               {unreadCount > 0
          ? `${unreadCount} unread`
          : "All caught up"}

              </span>

             </div>

             <p className="mt-0.5 text-xs leading-5 text-slate-500 dark:text-slate-400">

              Incident notifications that may require HR attention.

             </p>

            </div>

           </div>

           <button type="button" onClick={handleClearReadAlerts} disabled={!hasReadAlerts ||
          isClearingRead} className="shrink-0 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white" title={hasReadAlerts
          ? `Remove ${readAlertCount} read alert${readAlertCount === 1
            ? ""
            : "s"} from this list`
          : "No read alerts to clear"}>

            {isClearingRead
          ? "Clearing..."
          : `Clear Read${readAlertCount > 0
            ? ` (${readAlertCount})`
            : ""}`}

           </button>

          </div>

         </div>

         <div className="max-h-[420px] overflow-y-auto">

          {isFetching &&
          latestAlerts.length ===
            0 ? (<div role="status" aria-live="polite" className="space-y-2.5 px-4 py-4">

            {[1, 2, 3].map((item) => (<div key={item} className="flex animate-pulse gap-3 rounded-xl border border-slate-100 p-3 dark:border-slate-800">

               <div className="h-9 w-9 shrink-0 rounded-xl bg-slate-200 dark:bg-slate-700"/>

               <div className="min-w-0 flex-1 space-y-2">

                <div className="h-3 w-2/3 rounded bg-slate-200 dark:bg-slate-700"/>

                <div className="h-2.5 w-full rounded bg-slate-100 dark:bg-slate-800"/>

                <div className="h-2.5 w-4/5 rounded bg-slate-100 dark:bg-slate-800"/>

               </div>

              </div>))}

            <span className="sr-only">

             Loading smart alerts...

            </span>

           </div>) : latestAlerts.length >
          0 ? (latestAlerts.map((alert) => {
          const styles = getAlertPriorityClasses(alert.priority);
          const statusClasses = getAlertStatusClasses(alert.status);
          return (<button type="button" key={alert.alertKey} onClick={() => openAlertTarget(alert)} className={`group relative flex w-full gap-3 border-b border-slate-100 px-4 py-3.5 text-left transition last:border-b-0 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500 dark:border-slate-800 dark:hover:bg-white/[0.04] ${!alert.isRead
              ? "bg-indigo-50/40 dark:bg-indigo-500/[0.05]"
              : ""}`} aria-label={`${alert.title}. ${alert.isRead
              ? "Read"
              : "Unread"}. Open affected record.`}>

               {!alert.isRead && (<span className="absolute left-1.5 top-5 h-2 w-2 rounded-full bg-indigo-500" aria-label="Unread"/>)}

               <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${styles.icon}`} aria-hidden="true">

                {alert.priority ===
              "High" ? (<FiAlertTriangle />) : (<FiClock />)}

               </div>

               <div className="min-w-0 flex-1">

                <div className="flex items-start justify-between gap-3">

                 <p className="line-clamp-1 text-sm font-extrabold text-slate-900 group-hover:text-indigo-700 dark:text-white dark:group-hover:text-indigo-300">

                  {alert.title}

                 </p>

                 <span className="shrink-0 pt-0.5 text-[10px] font-medium text-slate-400 dark:text-slate-500">

                  {formatSmartAlertDate(alert.date)}

                 </span>

                </div>

                <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500 dark:text-slate-400">

                 {alert.message}

                </p>

                <div className="mt-2 flex flex-wrap items-center gap-1.5">

                 <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${styles.badge}`}>

                  {alert.priority || "Low"}

                 </span>

                 <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${statusClasses}`}>

                  {alert.status || "Open"}

                 </span>

                 {!alert.isRead && (<span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300">

                   New

                  </span>)}

                </div>

               </div>

              </button>);
        })) : (<div className="px-5 py-10 text-center">

            <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500">

             <FiBell size={20} aria-hidden="true"/>

            </div>

            <p className="text-sm font-semibold text-slate-900 dark:text-white">

             No smart alerts

            </p>

            <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">

             New incident alerts will appear here when HR attention is required.

            </p>

           </div>)}

         </div>

         {latestAlerts.length >
          0 && (<div className="border-t border-slate-200 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-950/50">

           <button type="button" onClick={handleViewNotifications} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-950">

            <FiEye aria-hidden="true"/>

            Open Notifications Center

           </button>

           {isFetching && (<p className="mt-2 text-center text-[10px] font-medium text-slate-400 dark:text-slate-500">

             Syncing latest alerts...

            </p>)}

          </div>)}

        </div>)}

      </div>)}

     <div className="relative" ref={profileRef}>

      <button type="button" onClick={() => {
      setOpenProfile((current) => !current);
      setOpenNotifications(false);
      void refreshRecoveryStatus();
    }} className="relative flex max-w-[260px] items-center gap-3 rounded-xl px-2 py-1.5 text-sm text-gray-700 transition hover:bg-gray-100 focus:outline-none focus:ring-4 focus:ring-indigo-500/15 dark:text-gray-300 dark:hover:bg-white/10" aria-label={`Open profile menu for ${displayName}${needsRecoveryVerification
      ? ", recovery email verification required"
      : ""}`} aria-expanded={openProfile} aria-haspopup="menu">

       <div className="relative shrink-0">

        <AvatarCircle imageUrl={avatarImageUrl} roleConfig={roleConfig}/>

        {needsRecoveryVerification && (<span title="Recovery email needs attention" aria-label="Recovery email needs attention" className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1 text-xs font-black text-slate-950 ring-2 ring-white dark:ring-slate-950">

          !

         </span>)}

       </div>

       <div className="hidden min-w-0 text-left sm:block">

        <p className="max-w-[190px] truncate text-sm font-bold leading-5 text-gray-900 dark:text-white">

         {displayName}

        </p>

       </div>

       <FiChevronDown className={`shrink-0 text-sm transition-transform ${openProfile
      ? "rotate-180"
      : ""}`} aria-hidden="true"/>

      </button>

      {openProfile && (<div role="menu" aria-label="Account menu" className="absolute right-0 z-[80] mt-3 w-72 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-white/10 dark:bg-slate-900">

        <div className="border-b border-gray-100 px-4 py-4 dark:border-white/10">

         <div className="flex items-start gap-3">

          <AvatarCircle imageUrl={avatarImageUrl} roleConfig={roleConfig} showUserIcon size="large"/>

          <div className="min-w-0 flex-1">

           <p className="truncate text-sm font-extrabold text-gray-900 dark:text-white">

            {displayName}

           </p>

           <p className="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">

            {username} • {roleConfig.roleName}

           </p>

           {isHRCoordinator &&
        assignedCompany && (<p title={assignedCompany} className="mt-1.5 truncate text-xs font-semibold text-violet-600 dark:text-violet-300">

              {assignedCompany}

             </p>)}

          </div>

         </div>

        </div>

        {needsRecoveryVerification && (<div role="status" className="flex items-start gap-2.5 border-b border-amber-200 bg-amber-50 px-4 py-2.5 dark:border-amber-800/40 dark:bg-amber-950/30">

          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">

           <FiAlertCircle size={14} aria-hidden="true"/>

          </div>

          <div className="min-w-0">

           <p className="text-[11px] font-extrabold leading-4 text-amber-900 dark:text-amber-200">

            {recoveryStatus ===
          "unregistered"
          ? "Recovery email not registered"
          : "Recovery email not verified"}

           </p>

           <p className="mt-0.5 text-[10px] leading-4 text-amber-700 dark:text-amber-300">

            {recoveryStatus ===
          "unregistered"
          ? "Add it from Account Settings."
          : "Verify it from Account Settings."}

           </p>

          </div>

         </div>)}

        {recoveryStatus ===
        "error" && (<div className="border-b border-gray-100 px-4 py-3 dark:border-white/10">

          <div className="flex items-start gap-2">

           <FiAlertCircle className="mt-0.5 shrink-0 text-amber-500" aria-hidden="true"/>

           <div className="min-w-0">

            <p className="text-xs leading-5 text-gray-600 dark:text-gray-300">

             {recoveryStatusError}

            </p>

            <button type="button" onClick={() => {
          void refreshRecoveryStatus();
        }} className="mt-1 text-xs font-bold text-indigo-600 hover:underline dark:text-indigo-300">

             Retry status check

            </button>

           </div>

          </div>

         </div>)}

        <div className="p-2">

         <button type="button" role="menuitem" onClick={handleOpenProfileSettings} className="group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-indigo-50 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 dark:hover:bg-indigo-500/10">

          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 transition group-hover:bg-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-300 dark:group-hover:bg-indigo-500/15">

           <FiSettings aria-hidden="true"/>

          </div>

          <p className="min-w-0 flex-1 text-sm font-extrabold text-gray-900 dark:text-white">

           Profile & Account Settings

          </p>

          <FiChevronRight className="shrink-0 text-gray-400 transition-transform group-hover:translate-x-0.5 group-hover:text-indigo-600 dark:group-hover:text-indigo-300" aria-hidden="true"/>

         </button>

        </div>

        <div className="border-t border-gray-100 p-2 dark:border-white/10">

         <button type="button" role="menuitem" onClick={handleLogout} className="group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-red-50 focus:outline-none focus:ring-4 focus:ring-red-500/10 dark:hover:bg-red-500/10">

          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400">

           <FiLogOut aria-hidden="true"/>

          </div>

          <div className="min-w-0">

           <p className="text-sm font-extrabold text-red-600 dark:text-red-400">

            Logout

           </p>

           <p className="mt-0.5 text-[11px] leading-4 text-gray-500 dark:text-gray-400">

            End your current session

           </p>

          </div>

         </button>

        </div>

       </div>)}

     </div>

    </div>

   </div>

   {canViewSmartNotifications && (<SmartAlertToast alert={notificationsAreOpen
        ? null
        : popupAlert} onDismiss={handleDismissToast} onView={openAlertTarget}/>)}

  </>);
}
