"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

interface DashboardHeaderProps {
  versionInfo: any;
  onUpdate: () => void;
  updating: boolean;
  stats: {
    totalProviders: number;
    activeProviders: number;
    totalModels: number;
    totalRequests: number;
    avgLatency: number;
  };
}

export default function DashboardHeader({
  versionInfo,
  onUpdate,
  updating,
  stats,
}: DashboardHeaderProps) {
  const t = useTranslations("home");
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 via-blue-500 to-violet-600 p-8 shadow-xl">
      <div className="relative z-10 flex flex-col gap-6">
        {/* Header Content */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-white tracking-tight">Welcome to Routiform</h1>
            <p className="text-base text-blue-50 leading-relaxed max-w-2xl">
              Your unified AI gateway for seamless model orchestration and intelligent routing
            </p>
          </div>

          {/* Live Status */}
          <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse"></span>
              <span className="text-sm font-semibold text-white">System Online</span>
            </div>
            <div className="h-4 w-px bg-white/20"></div>
            <span className="text-sm text-blue-50 font-mono">
              {currentTime.toLocaleTimeString()}
            </span>
          </div>
        </div>

        {/* Update Banner */}
        {versionInfo?.updateAvailable && (
          <div className="flex items-center justify-between gap-4 px-5 py-4 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-500/20">
                <svg
                  className="w-5 h-5 text-orange-300"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-white text-sm">
                  Update Available: v{versionInfo.latest}
                </p>
                <p className="text-xs text-blue-100 mt-0.5">
                  {versionInfo.autoUpdateSupported
                    ? `You are currently using v${versionInfo.current}. Update to access the latest features.`
                    : versionInfo.autoUpdateError ||
                      "Manual update required for this installation type."}
                </p>
              </div>
            </div>
            <button
              onClick={versionInfo.autoUpdateSupported ? onUpdate : undefined}
              disabled={updating || !versionInfo.autoUpdateSupported}
              className="shrink-0 px-5 py-2.5 rounded-lg bg-orange-500 text-white font-semibold text-sm hover:bg-orange-600 active:scale-95 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
            >
              {versionInfo.autoUpdateSupported
                ? updating
                  ? "Updating..."
                  : "Update Now"
                : "Manual Update"}
            </button>
          </div>
        )}

        {/* Quick Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="px-4 py-3 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20">
            <div className="flex items-center gap-2 mb-1">
              <svg
                className="w-4 h-4 text-blue-200"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"
                />
              </svg>
              <span className="text-xs text-blue-100 font-medium">Providers</span>
            </div>
            <p className="text-2xl font-bold text-white">
              {stats.activeProviders > 0 ? (
                <>
                  {stats.activeProviders}
                  <span className="text-sm text-blue-200 font-normal ml-1">
                    / {stats.totalProviders}
                  </span>
                </>
              ) : (
                stats.totalProviders
              )}
            </p>
          </div>

          <div className="px-4 py-3 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20">
            <div className="flex items-center gap-2 mb-1">
              <svg
                className="w-4 h-4 text-blue-200"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"
                />
              </svg>
              <span className="text-xs text-blue-100 font-medium">Models</span>
            </div>
            <p className="text-2xl font-bold text-white">{stats.totalModels.toLocaleString()}</p>
          </div>

          <div className="px-4 py-3 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20">
            <div className="flex items-center gap-2 mb-1">
              <svg
                className="w-4 h-4 text-blue-200"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
              <span className="text-xs text-blue-100 font-medium">Requests</span>
            </div>
            <p className="text-2xl font-bold text-white">
              {stats.totalRequests > 0 ? stats.totalRequests.toLocaleString() : "0"}
            </p>
          </div>

          <div className="px-4 py-3 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20">
            <div className="flex items-center gap-2 mb-1">
              <svg
                className="w-4 h-4 text-blue-200"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span className="text-xs text-blue-100 font-medium">Avg Latency</span>
            </div>
            <p className="text-2xl font-bold text-white">
              {stats.avgLatency > 0 ? `${Math.round(stats.avgLatency)}ms` : "—"}
            </p>
          </div>
        </div>
      </div>

      {/* Decorative Elements */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-violet-500/20 rounded-full blur-3xl"></div>
    </div>
  );
}
