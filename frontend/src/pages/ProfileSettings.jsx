import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiArrowRight,
  FiBriefcase,
  FiCamera,
  FiCheckCircle,
  FiInfo,
  FiKey,
  FiLock,
  FiMail,
  FiShield,
  FiUser,
} from "react-icons/fi";

import PageHeader from "../components/ui/PageHeader";
import ProfilePictureActions from "../components/profile/ProfilePictureActions";
import RecoveryEmailVerificationAction from "../components/auth/RecoveryEmailVerificationAction";
import { useAuth } from "../context/useAuth";

const ROLE_LABELS = {
  SUPER_ADMIN: "Super Admin",
  HR_MANAGER: "HR Manager",
  HR_STAFF: "HR Staff",
  HR_COORDINATOR: "HR Coordinator",
  IT_SUPPORT: "IT Support",
};

function normalizeRole(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
}

function SectionCard({
  icon,
  eyebrow,
  title,
  description,
  children,
  className = "",
}) {
  return (
    <section
      className={[
        "overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm",
        "dark:border-slate-700 dark:bg-slate-900",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="border-b border-slate-200 bg-slate-50/60 px-5 py-4 dark:border-slate-700 dark:bg-slate-950/30 sm:px-6">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-300 dark:ring-indigo-500/10">
            {icon}
          </div>

          <div className="min-w-0">
            {eyebrow && (
              <p className="text-[10px] font-extrabold uppercase tracking-[0.17em] text-indigo-600 dark:text-indigo-300">
                {eyebrow}
              </p>
            )}

            <h2 className="mt-0.5 text-base font-extrabold text-slate-900 dark:text-white">
              {title}
            </h2>

            {description && (
              <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
                {description}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="p-5 sm:p-6">
        {children}
      </div>
    </section>
  );
}

export default function ProfileSettings() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const currentRole = useMemo(
    () => normalizeRole(user?.role),
    [user?.role]
  );

  const roleLabel =
    ROLE_LABELS[currentRole] ||
    currentRole ||
    "User";

  const displayName =
    user?.name ||
    user?.fullName ||
    user?.fullname ||
    user?.full_name ||
    user?.username ||
    "User";

  const username =
    user?.username || "—";

  const assignedCompany = String(
    user?.assignedCompany ??
      user?.assigned_company ??
      ""
  ).trim();

  const isHRCoordinator =
    currentRole === "HR_COORDINATOR";

  const initials =
    String(displayName || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0] || "")
      .join("")
      .toUpperCase() || "U";

  const companyDisplay =
    isHRCoordinator
      ? assignedCompany || "Not assigned"
      : "Not applicable";

  return (
    <main className="min-w-0 space-y-6 p-4 sm:p-6 lg:p-8">
      <PageHeader
        eyebrow="My Account"
        title="Profile & Account Settings"
        description="Manage your account identity, recovery options, profile photo, and password security from one place."
        icon={<FiUser size={22} />}
      />

      <section className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-indigo-600 dark:text-indigo-300">
            Account Overview
          </p>

          <h2 className="mt-1 text-lg font-extrabold text-slate-900 dark:text-white">
            Your account information
          </h2>
        </div>

        <p className="text-xs text-slate-500 dark:text-slate-400">
          Read-only account details
        </p>
      </section>

      <section className="relative overflow-hidden rounded-3xl border border-indigo-500/20 bg-gradient-to-br from-slate-950 via-indigo-950 to-violet-950 p-5 text-white shadow-xl sm:p-6 lg:p-7">
        <div
          className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-indigo-400/15 blur-3xl"
          aria-hidden="true"
        />

        <div
          className="absolute -bottom-24 left-1/3 h-64 w-64 rounded-full bg-violet-400/10 blur-3xl"
          aria-hidden="true"
        />

        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-col items-start gap-4 sm:flex-row sm:items-center">
            <div className="relative">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-3xl border border-white/15 bg-white/10 text-2xl font-black text-white shadow-lg backdrop-blur-sm sm:h-24 sm:w-24 sm:text-3xl">
                {initials}
              </div>

              <div
                className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-slate-950 bg-emerald-500 text-white shadow-lg"
                title="Authenticated account"
              >
                <FiCheckCircle
                  size={14}
                  aria-hidden="true"
                />
              </div>
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.14em] text-indigo-100">
                  Account Profile
                </span>

                <span className="rounded-full bg-indigo-400/15 px-2.5 py-1 text-[10px] font-extrabold text-indigo-100 ring-1 ring-inset ring-indigo-300/20">
                  {roleLabel}
                </span>
              </div>

              <h2 className="mt-3 break-words text-2xl font-black tracking-tight text-white sm:text-3xl">
                {displayName}
              </h2>

              <p className="mt-1 text-sm font-medium text-indigo-100/80">
                @{username}
              </p>

              {isHRCoordinator && (
                <div className="mt-3 inline-flex max-w-full items-center gap-2 rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-indigo-50">
                  <FiBriefcase
                    className="shrink-0"
                    aria-hidden="true"
                  />

                  <span className="truncate">
                    {assignedCompany || "No company assigned"}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="grid w-full gap-3 sm:grid-cols-2 lg:w-auto lg:min-w-[360px]">
            <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur-sm">
              <div className="flex items-center gap-2 text-indigo-100">
                <FiShield aria-hidden="true" />

                <p className="text-[10px] font-extrabold uppercase tracking-[0.15em]">
                  Access Role
                </p>
              </div>

              <p className="mt-2 text-sm font-extrabold text-white">
                {roleLabel}
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur-sm">
              <div className="flex items-center gap-2 text-indigo-100">
                <FiBriefcase aria-hidden="true" />

                <p className="text-[10px] font-extrabold uppercase tracking-[0.15em]">
                  Company Scope
                </p>
              </div>

              <p
                className="mt-2 truncate text-sm font-extrabold text-white"
                title={companyDisplay}
              >
                {companyDisplay}
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid min-w-0 gap-6 xl:grid-cols-2">
        <SectionCard
          icon={<FiCamera size={19} aria-hidden="true" />}
          eyebrow="Personalization"
          title="Profile Picture"
          description="Choose how your account photo appears across the HRIS."
        >
          <ProfilePictureActions />
        </SectionCard>

        <SectionCard
          icon={<FiMail size={19} aria-hidden="true" />}
          eyebrow="Account Recovery"
          title="Recovery Email"
          description="Keep your recovery email verified so account recovery remains available."
        >
          <RecoveryEmailVerificationAction />
        </SectionCard>
      </div>

      <SectionCard
        icon={<FiLock size={19} aria-hidden="true" />}
        eyebrow="Security"
        title="Password & Sign-in Security"
        description="Keep your account protected with a strong and updated password."
      >
        <div className="relative overflow-hidden rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-50 via-white to-violet-50 p-5 dark:border-indigo-900/60 dark:from-indigo-950/30 dark:via-slate-900 dark:to-violet-950/20 sm:p-6">
          <div
            className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-indigo-200/30 blur-2xl dark:bg-indigo-500/10"
            aria-hidden="true"
          />

          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-md shadow-indigo-500/20">
                <FiKey
                  size={21}
                  aria-hidden="true"
                />
              </div>

              <div className="min-w-0">
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                  Change your password
                </h3>

                <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-400">
                  Update your password using the secure password workflow.
                  After a successful change, you will be asked to sign in again.
                </p>

                <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                  <FiShield aria-hidden="true" />
                  Existing authentication and security rules remain enforced.
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                navigate("/change-password")
              }
              className="group inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-extrabold text-white shadow-sm transition hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/20"
            >
              Change Password

              <FiArrowRight
                className="transition-transform group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </button>
          </div>
        </div>
      </SectionCard>

      <section className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 sm:flex-row sm:items-start">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          <FiInfo aria-hidden="true" />
        </div>

        <div>
          <p className="font-bold text-slate-800 dark:text-slate-200">
            Account information is protected
          </p>

          <p className="mt-1 text-xs leading-5">
            Your role and assigned-company details are shown here for reference only.
            Access permissions and company assignments continue to follow the existing
            WellJob HRIS authorization workflow.
          </p>
        </div>
      </section>
    </main>
  );
}