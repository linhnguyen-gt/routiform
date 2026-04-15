"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";

interface QuickStartProps {
  currentEndpoint: string;
}

export default function QuickStart({ currentEndpoint }: QuickStartProps) {
  const t = useTranslations("home");
  const ts = useTranslations("sidebar");

  const steps = [
    {
      icon: "M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z",
      title: t("step1Title"),
      desc: "step1Desc",
      color: "blue",
      link: "/dashboard/endpoint",
    },
    {
      icon: "M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01",
      title: t("step2Title"),
      desc: "step2Desc",
      color: "green",
      link: "/dashboard/providers",
    },
    {
      icon: "M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1",
      title: t("step3Title"),
      desc: t("step3Desc", { url: currentEndpoint }),
      color: "violet",
      link: null,
    },
    {
      icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
      title: t("step4Title"),
      desc: "step4Desc",
      color: "orange",
      link: "/dashboard/analytics",
    },
  ];

  const colorMap = {
    blue: "from-blue-500/10 to-blue-600/10 border-blue-500/20 group-hover:border-blue-500/40",
    green: "from-green-500/10 to-green-600/10 border-green-500/20 group-hover:border-green-500/40",
    violet:
      "from-violet-500/10 to-violet-600/10 border-violet-500/20 group-hover:border-violet-500/40",
    orange:
      "from-orange-500/10 to-orange-600/10 border-orange-500/20 group-hover:border-orange-500/40",
  };

  const iconColorMap = {
    blue: "text-blue-400",
    green: "text-green-400",
    violet: "text-violet-400",
    orange: "text-orange-400",
  };

  const quickLinks = [
    {
      label: t("documentation"),
      href: "/docs",
      icon: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253",
    },
    {
      label: ts("providers"),
      href: "/dashboard/providers",
      icon: "M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01",
    },
    {
      label: ts("combos"),
      href: "/dashboard/combos",
      icon: "M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z",
    },
    {
      label: ts("analytics"),
      href: "/dashboard/analytics",
      icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
    },
    {
      label: t("healthMonitor"),
      href: "/dashboard/health",
      icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
    },
    {
      label: ts("cliTools"),
      href: "/dashboard/cli-tools",
      icon: "M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z",
    },
  ];

  return (
    <div className="rounded-xl border-2 border-border bg-surface p-6 shadow-lg">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-text-main">{t("quickStart")}</h2>
          <p className="text-sm text-text-muted mt-1">{t("quickStartDesc")}</p>
        </div>
        <Link
          href="/docs"
          className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-border text-sm font-semibold text-text-muted hover:text-blue-400 hover:border-blue-500/50 hover:bg-blue-500/5 transition-all duration-200"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
            />
          </svg>
          {t("fullDocs")}
        </Link>
      </div>

      {/* Steps Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {steps.map((step, index) => {
          const content = (
            <div
              className={`group relative overflow-hidden rounded-xl border-2 bg-gradient-to-br ${colorMap[step.color]} p-5 transition-all duration-200 hover:shadow-lg ${step.link ? "cursor-pointer" : ""}`}
            >
              <div className="relative z-10 flex gap-4">
                <div className="shrink-0">
                  <div className="w-12 h-12 rounded-xl bg-surface/50 backdrop-blur-sm flex items-center justify-center">
                    <svg
                      className={`w-6 h-6 ${iconColorMap[step.color]}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d={step.icon}
                      />
                    </svg>
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-xs font-bold ${iconColorMap[step.color]}`}>
                      STEP {index + 1}
                    </span>
                  </div>
                  <h3 className="font-bold text-text-main mb-1">{step.title}</h3>
                  <p className="text-sm text-text-muted leading-relaxed">{step.desc}</p>
                </div>
              </div>
              {step.link && (
                <div className="absolute top-3 right-3">
                  <svg
                    className={`w-5 h-5 ${iconColorMap[step.color]} opacity-0 group-hover:opacity-100 transition-opacity duration-200`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 7l5 5m0 0l-5 5m5-5H6"
                    />
                  </svg>
                </div>
              )}
            </div>
          );

          return step.link ? (
            <Link key={index} href={step.link}>
              {content}
            </Link>
          ) : (
            <div key={index}>{content}</div>
          );
        })}
      </div>

      {/* Quick Links */}
      <div className="flex flex-wrap gap-2">
        {quickLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-border text-sm font-medium text-text-muted hover:text-blue-400 hover:border-blue-500/50 hover:bg-blue-500/5 transition-all duration-200"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={link.icon} />
            </svg>
            {link.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
