"use client";

import { useState, useEffect } from "react";

import { useTranslations } from "next-intl";

export default function SkillsPage() {
  const [loading, setLoading] = useState(true);

  // skills.sh marketplace state
  const [skillsShQuery, setSkillsShQuery] = useState("");
  const [skillsShResults, setSkillsShResults] = useState<
    {
      id: string;
      skillId: string;
      name: string;
      installs: number;
      source: string;
    }[]
  >([]);
  const [skillsShLoading, setSkillsShLoading] = useState(false);
  const [skillsShError, setSkillsShError] = useState("");
  const [skillsShInstallingId, setSkillsShInstallingId] = useState<string | null>(null);

  // Installed skills from skills.sh
  const [installedSkills, setInstalledSkills] = useState<
    {
      skillId: string;
      name: string;
      path: string;
      installedAt: string;
      size: number;
      provider: string;
      providerName: string;
    }[]
  >([]);
  const [skillsByProvider, setSkillsByProvider] = useState<
    Record<
      string,
      {
        skillId: string;
        name: string;
        path: string;
        installedAt: string;
        size: number;
        provider: string;
        providerName: string;
      }[]
    >
  >({});
  const [providers, setProviders] = useState<Array<{ id: string; name: string; count: number }>>(
    []
  );
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);

  const _t = useTranslations("skills");

  useEffect(() => {
    fetch("/api/skills/skillssh/installed")
      .then((r) => r.json())
      .then((installedData) => {
        console.log("Installed data:", installedData);
        setInstalledSkills(installedData.skills || []);
        setSkillsByProvider(installedData.byProvider || {});
        setProviders(installedData.providers || []);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to fetch skills:", err);
        setLoading(false);
      });
  }, []);

  const refreshInstalledSkills = async () => {
    const res = await fetch("/api/skills/skillssh/installed").then((r) => r.json());
    setInstalledSkills(res.skills || []);
    setSkillsByProvider(res.byProvider || {});
    setProviders(res.providers || []);
  };

  const deleteInstalledSkill = async (skillId: string, provider: string) => {
    const res = await fetch(
      `/api/skills/skillssh/installed?skillId=${skillId}&provider=${provider}`,
      {
        method: "DELETE",
      }
    );
    if (res.ok) {
      await refreshInstalledSkills();
    }
  };

  const searchSkillsSh = async () => {
    setSkillsShLoading(true);
    setSkillsShError("");
    setSkillsShResults([]);
    try {
      const res = await fetch(
        `/api/skills/skillssh?q=${encodeURIComponent(skillsShQuery)}&limit=20`
      );
      const data = await res.json();
      if (!res.ok) {
        setSkillsShError(data.error || "Search failed");
      } else {
        setSkillsShResults(data.skills || []);
      }
    } catch (err) {
      setSkillsShError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setSkillsShLoading(false);
    }
  };

  const installFromSkillsSh = async (skill: {
    id: string;
    skillId: string;
    name: string;
    installs: number;
    source: string;
  }) => {
    setSkillsShInstallingId(skill.id);
    setSkillsShError("");
    try {
      const res = await fetch("/api/skills/skillssh/install", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          skillId: skill.skillId,
          name: skill.name,
          source: skill.source,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        await refreshInstalledSkills();
        setSkillsShInstallingId(null);
        setSkillsShError("");
        setSkillsShError(`✓ Successfully installed ${skill.name}`);
        setTimeout(() => setSkillsShError(""), 3000);
      } else {
        setSkillsShError(data.error || "Install failed");
        setSkillsShInstallingId(null);
      }
    } catch (err) {
      setSkillsShError(err instanceof Error ? err.message : "Install failed");
      setSkillsShInstallingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-text-muted">Loading...</div>
      </div>
    );
  }

  const displayedProviders = selectedProvider
    ? providers.filter((p) => p.id === selectedProvider)
    : providers;

  return (
    <div className="flex flex-col gap-12 pb-12">
      {/* Hero Search Section */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 via-blue-500 to-violet-600 p-8 md:p-12">
        <div className="relative z-10 max-w-3xl mx-auto text-center space-y-6">
          <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight">
            Skills Marketplace
          </h1>
          <p className="text-lg text-blue-50 max-w-2xl mx-auto">
            Discover and install skills from skills.sh to supercharge your CLI tools
          </p>

          {/* Hero Search Bar */}
          <div className="flex gap-3 max-w-2xl mx-auto">
            <input
              type="text"
              value={skillsShQuery}
              onChange={(e) => setSkillsShQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && searchSkillsSh()}
              placeholder="Search for skills..."
              className="flex-1 px-6 py-4 rounded-xl bg-white/95 backdrop-blur border-2 border-transparent text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-white/30 focus:border-white transition-all duration-200 text-lg shadow-xl"
            />
            <button
              onClick={searchSkillsSh}
              disabled={skillsShLoading}
              className="px-8 py-4 text-lg font-semibold rounded-xl bg-orange-500 text-white hover:bg-orange-600 active:scale-95 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-xl hover:shadow-2xl"
            >
              {skillsShLoading ? "Searching..." : "Search"}
            </button>
          </div>

          {/* Status Messages */}
          {skillsShError && (
            <div
              className={`p-4 rounded-xl text-sm font-medium max-w-2xl mx-auto transition-all duration-300 ${
                skillsShError.startsWith("✓")
                  ? "bg-green-500/20 text-green-100 border-2 border-green-400/30"
                  : "bg-red-500/20 text-red-100 border-2 border-red-400/30"
              }`}
            >
              {skillsShError}
            </div>
          )}
        </div>

        {/* Decorative Elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-violet-500/20 rounded-full blur-3xl"></div>
      </div>

      {/* Search Results */}
      {skillsShResults.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-text-main">Search Results</h2>
            <span className="text-sm text-text-muted">{skillsShResults.length} skills found</span>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {skillsShResults.map((skill) => (
              <div
                key={skill.id}
                className="group relative overflow-hidden rounded-xl bg-surface border-2 border-border hover:border-blue-500/50 transition-all duration-200 hover:shadow-xl hover:-translate-y-1"
              >
                <div className="p-6 space-y-4">
                  <div className="space-y-2">
                    <h3 className="font-semibold text-lg text-text-main group-hover:text-blue-500 transition-colors duration-200">
                      {skill.name}
                    </h3>
                    <div className="flex items-center gap-2 text-sm text-text-muted">
                      <span className="font-mono">{skill.source}</span>
                      <span>/</span>
                      <span className="font-mono">{skill.skillId}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-blue-500/10 text-blue-400 text-sm font-medium">
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                        />
                      </svg>
                      {skill.installs.toLocaleString()}
                    </span>

                    <button
                      onClick={() => installFromSkillsSh(skill)}
                      disabled={skillsShInstallingId === skill.id}
                      className="px-4 py-2 text-sm font-semibold rounded-lg bg-orange-500 text-white hover:bg-orange-600 active:scale-95 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {skillsShInstallingId === skill.id ? "Installing..." : "Install"}
                    </button>
                  </div>
                </div>

                {/* Hover Gradient Effect */}
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/0 via-transparent to-violet-500/0 group-hover:from-blue-500/5 group-hover:to-violet-500/5 transition-all duration-300 pointer-events-none"></div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Installed Skills Section */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-text-main">Installed Skills</h2>
          <span className="text-sm text-text-muted">{installedSkills.length} total skills</span>
        </div>

        {/* Provider Filter Pills */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedProvider(null)}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 ${
              selectedProvider === null
                ? "bg-blue-500 text-white shadow-lg"
                : "bg-surface text-text-muted hover:bg-surface-hover border border-border"
            }`}
          >
            All Providers ({providers.length})
          </button>
          {providers.map((provider) => (
            <button
              key={provider.id}
              onClick={() => setSelectedProvider(provider.id)}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 ${
                selectedProvider === provider.id
                  ? "bg-blue-500 text-white shadow-lg"
                  : "bg-surface text-text-muted hover:bg-surface-hover border border-border"
              }`}
            >
              {provider.name} ({provider.count})
            </button>
          ))}
        </div>

        {/* Provider Cards Grid */}
        <div className="grid gap-6 lg:grid-cols-2">
          {displayedProviders.map((provider) => {
            const providerSkills = skillsByProvider[provider.id] || [];
            return (
              <div
                key={provider.id}
                className="rounded-xl bg-surface border-2 border-border overflow-hidden hover:border-blue-500/30 transition-all duration-200"
              >
                {/* Provider Header */}
                <div className="bg-gradient-to-r from-blue-500/10 to-violet-500/10 px-6 py-4 border-b border-border">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-lg text-text-main">{provider.name}</h3>
                    <span className="px-3 py-1 rounded-full bg-blue-500/20 text-blue-400 text-sm font-semibold">
                      {provider.count} {provider.count === 1 ? "skill" : "skills"}
                    </span>
                  </div>
                </div>

                {/* Skills List */}
                <div className="p-6">
                  {providerSkills.length > 0 ? (
                    <div className="space-y-3">
                      {providerSkills.map((skill) => (
                        <div
                          key={`${skill.provider}-${skill.path}`}
                          className="group relative rounded-lg bg-surface-hover border border-border p-4 hover:border-blue-500/50 transition-all duration-200"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 space-y-2">
                              <h4 className="font-semibold text-text-main group-hover:text-blue-500 transition-colors duration-200">
                                {skill.name}
                              </h4>
                              <p className="text-xs font-mono text-text-muted break-all">
                                {skill.path}
                              </p>
                              <div className="flex items-center gap-4 text-xs text-text-muted">
                                <span className="flex items-center gap-1">
                                  <svg
                                    className="w-3.5 h-3.5"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                                    />
                                  </svg>
                                  {new Date(skill.installedAt).toLocaleDateString()}
                                </span>
                                <span className="flex items-center gap-1">
                                  <svg
                                    className="w-3.5 h-3.5"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                                    />
                                  </svg>
                                  {(skill.size / 1024).toFixed(1)} KB
                                </span>
                              </div>
                            </div>

                            <button
                              onClick={() => deleteInstalledSkill(skill.skillId, skill.provider)}
                              className="flex-shrink-0 p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 active:scale-95 transition-all duration-200"
                              title="Delete skill"
                            >
                              <svg
                                className="w-5 h-5"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                />
                              </svg>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 space-y-3">
                      <div className="w-16 h-16 mx-auto rounded-full bg-surface-hover flex items-center justify-center">
                        <svg
                          className="w-8 h-8 text-text-muted"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                          />
                        </svg>
                      </div>
                      <p className="text-sm text-text-muted">No skills installed for this CLI</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
