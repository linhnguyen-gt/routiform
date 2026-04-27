"use client";

import { useEffect, useState } from "react";
import { Card, Badge, Spinner } from "@/shared/components";

interface Activity {
  id: string;
  type: "spike" | "warning" | "improvement" | "error" | "info";
  message: string;
  timestamp: string;
  metadata?: {
    value?: string;
    change?: string;
  };
}

function getActivityIcon(type: Activity["type"]) {
  switch (type) {
    case "spike":
      return "trending_up";
    case "warning":
      return "warning";
    case "improvement":
      return "check_circle";
    case "error":
      return "error";
    case "info":
      return "info";
    default:
      return "circle";
  }
}

function getActivityColor(type: Activity["type"]) {
  switch (type) {
    case "spike":
      return "text-primary";
    case "warning":
      return "text-warning";
    case "improvement":
      return "text-success";
    case "error":
      return "text-error";
    case "info":
      return "text-text-muted";
    default:
      return "text-text";
  }
}

function getActivityBadgeVariant(type: Activity["type"]) {
  switch (type) {
    case "spike":
      return "default";
    case "warning":
      return "warning";
    case "improvement":
      return "success";
    case "error":
      return "error";
    case "info":
      return "default";
    default:
      return "default";
  }
}

function formatTimestamp(timestamp: string) {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export default function RecentActivityFeed() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchActivities() {
      try {
        const res = await fetch("/api/analytics/recent-activity");
        if (!res.ok) throw new Error("Failed to fetch activities");
        const data = await res.json();
        setActivities(data.activities);
      } catch (err) {
        console.error("Error fetching activities:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchActivities();
    // Refresh every 5 minutes
    const interval = setInterval(fetchActivities, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center h-32">
          <Spinner />
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-[20px]" aria-hidden="true">
            notifications_active
          </span>
          <h3 className="text-lg font-semibold text-text">Recent Activity</h3>
        </div>
        {activities.length > 0 && (
          <Badge variant="default" size="sm">
            {activities.length}
          </Badge>
        )}
      </div>

      {/* Activity List */}
      <div className="flex flex-col gap-3">
        {activities.length === 0 ? (
          <div className="text-center py-8 text-text-muted">
            <span
              className="material-symbols-outlined text-[48px] opacity-50 mb-2"
              aria-hidden="true"
            >
              check_circle
            </span>
            <p className="text-sm">All systems running smoothly</p>
          </div>
        ) : (
          activities.map((activity) => (
            <div
              key={activity.id}
              className="flex items-start gap-3 p-3 rounded-lg bg-surface-secondary hover:bg-surface-tertiary transition-colors"
            >
              <span
                className={`material-symbols-outlined text-[20px] mt-0.5 ${getActivityColor(activity.type)}`}
                aria-hidden="true"
              >
                {getActivityIcon(activity.type)}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-text leading-relaxed">{activity.message}</p>
                {activity.metadata && (
                  <div className="flex items-center gap-2 mt-1">
                    {activity.metadata.value && (
                      <Badge variant={getActivityBadgeVariant(activity.type)} size="sm">
                        {activity.metadata.value}
                      </Badge>
                    )}
                    {activity.metadata.change && (
                      <span className="text-xs text-text-muted">{activity.metadata.change}</span>
                    )}
                  </div>
                )}
              </div>
              <span className="text-xs text-text-muted whitespace-nowrap">
                {formatTimestamp(activity.timestamp)}
              </span>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}
