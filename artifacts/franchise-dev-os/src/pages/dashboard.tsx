import { useGetDashboard, useGetTask, getGetTaskQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getInitials, formatDate, getTaskDateColor } from "@/lib/utils";
import { AlertCircle, CheckCircle2, Clock, CheckSquare, Circle } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useState } from "react";
import { TaskFormDialog } from "@/components/task-form-dialog";
import { QueryError } from "@/components/query-error";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";

const PROJECT_STATUS_COLORS: Record<string, string> = {
  "On Track": "#10B981",
  "At Risk": "#F59E0B",
  Blocked: "#EF4444",
  Complete: "#6366F1",
  "Not Started": "#9CA3AF",
};

const PRIORITY_COLORS: Record<string, string> = {
  Critical: "#DC2626",
  High: "#F59E0B",
  Medium: "#3B82F6",
  Low: "#9CA3AF",
};

// Maps the tactic-status donut segment label to the /projects?status= key.
const PROJECT_STATUS_FILTER_KEY: Record<string, string> = {
  "On Track": "onTrack",
  "At Risk": "atRisk",
  Blocked: "blocked",
  Complete: "complete",
  "Not Started": "notStarted",
};

interface KpiCardProps {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  href?: string;
  accent?: "primary" | "dark" | "default";
}

function KpiCard({ label, value, icon, href, accent = "default" }: KpiCardProps) {
  const base =
    accent === "primary"
      ? "bg-primary text-primary-foreground border-none shadow-md"
      : accent === "dark"
        ? "bg-sidebar text-sidebar-foreground border-none"
        : "";
  const body = (
    <Card className={`${base} ${href ? "cursor-pointer hover:shadow-lg hover:-translate-y-0.5 transition-all" : ""}`}>
      <CardContent className="p-5 flex flex-col items-center justify-center text-center h-full">
        {icon}
        <p className={`text-3xl font-serif font-bold mt-2 ${accent === "primary" ? "" : accent === "dark" ? "text-primary" : ""}`}>
          {value}
        </p>
        <p className={`text-[10px] uppercase tracking-wider mt-1 ${accent === "default" ? "text-muted-foreground" : "opacity-80"}`}>
          {label}
        </p>
      </CardContent>
    </Card>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

export default function DashboardPage() {
  const { data: dashboard, isLoading, isError, refetch, isRefetching } = useGetDashboard();
  const [, navigate] = useLocation();
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
  const { data: editingTask } = useGetTask(editingTaskId ?? 0, {
    query: { enabled: !!editingTaskId, queryKey: getGetTaskQueryKey(editingTaskId ?? 0) } as any,
  });

  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground">Loading dashboard...</div>;
  }
  if (isError || !dashboard) {
    return (
      <QueryError
        message="Failed to load dashboard"
        onRetry={() => refetch()}
        retrying={isRefetching}
      />
    );
  }

  const { kpis, focusAreas, needsAttention, workload, taskBreakdown } = dashboard;

  const projectStatusData = [
    { name: "On Track", value: kpis.onTrack, color: PROJECT_STATUS_COLORS["On Track"] },
    { name: "At Risk", value: kpis.atRisk, color: PROJECT_STATUS_COLORS["At Risk"] },
    { name: "Blocked", value: kpis.blocked, color: PROJECT_STATUS_COLORS.Blocked },
    { name: "Complete", value: kpis.complete, color: PROJECT_STATUS_COLORS.Complete },
    { name: "Not Started", value: kpis.notStartedProjects, color: PROJECT_STATUS_COLORS["Not Started"] },
  ].filter((d) => d.value > 0);

  const priorityData = [
    { name: "Critical", value: taskBreakdown.critical, color: PRIORITY_COLORS.Critical },
    { name: "High", value: taskBreakdown.high, color: PRIORITY_COLORS.High },
    { name: "Medium", value: taskBreakdown.medium, color: PRIORITY_COLORS.Medium },
    { name: "Low", value: taskBreakdown.low, color: PRIORITY_COLORS.Low },
  ];

  const focusAreaChartData = focusAreas.map((fa) => ({
    name: fa.focusAreaName.split(" – ")[0] || fa.focusAreaName,
    fullName: fa.focusAreaName,
    focusAreaId: fa.focusAreaId,
    percent: fa.percentComplete,
    tasks: fa.taskCount,
    hasOverdue: fa.hasOverdue,
  }));

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <h1 className="text-3xl font-serif font-bold text-foreground">Executive Dashboard</h1>

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <KpiCard
          label="Active Tactics"
          value={kpis.activeProjects}
          icon={<CheckSquare className="w-5 h-5 opacity-80" />}
          accent="primary"
        />
        <KpiCard
          label="On Track"
          value={kpis.onTrack}
          icon={<CheckCircle2 className="w-5 h-5 text-green-500" />}
          href="/projects?status=onTrack"
        />
        <KpiCard
          label="At Risk"
          value={kpis.atRisk}
          icon={<Clock className="w-5 h-5 text-amber-500" />}
          href="/projects?status=atRisk"
        />
        <KpiCard
          label="Blocked"
          value={kpis.blocked}
          icon={<AlertCircle className="w-5 h-5 text-destructive" />}
          href="/projects?status=blocked"
        />
        <KpiCard
          label="Complete"
          value={kpis.complete}
          icon={<CheckSquare className="w-5 h-5 text-indigo-500" />}
          href="/projects?status=complete"
        />
        <KpiCard
          label="Not Started"
          value={kpis.notStartedProjects}
          icon={<Circle className="w-5 h-5 text-muted-foreground" />}
          href="/projects?status=notStarted"
        />
        <KpiCard
          label="Avg Complete"
          value={`${Math.round(kpis.avgCompletion)}%`}
          icon={<Circle className="w-5 h-5 text-primary" />}
          accent="dark"
        />
      </div>

      {/* Task-level stat strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-lg p-4 flex items-center justify-between">
          <div>
            <p className="text-2xl font-serif font-bold">{kpis.totalTasks}</p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Total Tasks</p>
          </div>
          <CheckSquare className="w-8 h-8 text-muted-foreground/30" />
        </div>
        <div className="bg-card border border-destructive/30 rounded-lg p-4 flex items-center justify-between">
          <div>
            <p className="text-2xl font-serif font-bold text-destructive">{kpis.overdueTasks}</p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Overdue Tasks</p>
          </div>
          <AlertCircle className="w-8 h-8 text-destructive/30" />
        </div>
        <div className="bg-card border border-amber-500/30 rounded-lg p-4 flex items-center justify-between">
          <div>
            <p className="text-2xl font-serif font-bold text-amber-600">{kpis.dueSoonTasks}</p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Due in 7 Days</p>
          </div>
          <Clock className="w-8 h-8 text-amber-500/30" />
        </div>
        <div className="bg-card border border-border rounded-lg p-4 flex items-center justify-between">
          <div>
            <p className="text-2xl font-serif font-bold">{kpis.teamMemberCount}</p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Team Members</p>
          </div>
          <div className="w-8 h-8 rounded-full bg-primary/10" />
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Project status donut */}
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="font-serif text-base">Tactic Status</CardTitle>
          </CardHeader>
          <CardContent className="pb-4 flex flex-col items-center">
            <div style={{ width: 220, height: 220 }}>
              <PieChart width={220} height={220}>
                <Pie
                  data={projectStatusData}
                  cx={110}
                  cy={110}
                  innerRadius={55}
                  outerRadius={95}
                  paddingAngle={2}
                  dataKey="value"
                  nameKey="name"
                  isAnimationActive={false}
                  className="cursor-pointer focus:outline-none"
                  onClick={(d: { name?: string }) => {
                    const key = d?.name ? PROJECT_STATUS_FILTER_KEY[d.name] : undefined;
                    if (key) navigate(`/projects?status=${key}`);
                  }}
                >
                  {projectStatusData.map((d) => (
                    <Cell key={d.name} fill={d.color} className="cursor-pointer focus:outline-none" />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid var(--border)" }}
                  formatter={(v: number, name: string) => [`${v} tactics`, name]}
                />
              </PieChart>
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1 justify-center mt-2">
              {projectStatusData.map((d) => (
                <div key={d.name} className="flex items-center gap-1.5 text-xs">
                  <span className="w-2.5 h-2.5 rounded-sm" style={{ background: d.color }} />
                  <span className="text-muted-foreground">{d.name}</span>
                  <span className="font-bold">{d.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Tasks by priority */}
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="font-serif text-base">Tasks by Priority</CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={priorityData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid var(--border)" }}
                  cursor={{ fill: "rgba(0,0,0,0.04)" }}
                />
                <Bar
                  dataKey="value"
                  radius={[6, 6, 0, 0]}
                  className="cursor-pointer focus:outline-none"
                  onClick={(d: { name?: string }) => {
                    if (d?.name) navigate(`/tasks?priority=${encodeURIComponent(d.name)}`);
                  }}
                >
                  {priorityData.map((d) => (
                    <Cell key={d.name} fill={d.color} className="cursor-pointer focus:outline-none" />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Task status mini stats */}
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="font-serif text-base">Tasks by Status</CardTitle>
          </CardHeader>
          <CardContent className="pb-4 space-y-2.5">
            {[
              { label: "Complete", status: "Complete", value: taskBreakdown.complete, color: "#10B981" },
              { label: "Pending Review", status: "Pending Review", value: taskBreakdown.pendingReview, color: "#A855F7" },
              { label: "In Progress", status: "In Progress", value: taskBreakdown.inProgress, color: "#3B82F6" },
              { label: "Waiting", status: "Waiting on Someone", value: taskBreakdown.waitingOnSomeone, color: "#A78BFA" },
              { label: "Blocked", status: "Blocked", value: taskBreakdown.blocked, color: "#EF4444" },
              { label: "Not Started", status: "Not Started", value: taskBreakdown.notStarted, color: "#9CA3AF" },
            ].map((row) => {
              const total = Math.max(1, kpis.totalTasks);
              const pct = Math.round((row.value / total) * 100);
              return (
                <Link
                  key={row.label}
                  href={`/tasks?status=${encodeURIComponent(row.status)}`}
                  className="block rounded-md -mx-1 px-1 py-0.5 hover:bg-muted/50 transition-colors cursor-pointer"
                  data-testid={`status-bar-${row.status}`}
                >
                  <div className="flex justify-between items-center text-xs mb-1">
                    <span className="font-medium">{row.label}</span>
                    <span className="text-muted-foreground">
                      <span className="font-bold text-foreground">{row.value}</span> · {pct}%
                    </span>
                  </div>
                  <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, backgroundColor: row.color }}
                    />
                  </div>
                </Link>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* Focus area progress chart */}
      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="font-serif text-base">Strategic Pillar Progress</CardTitle>
        </CardHeader>
        <CardContent className="pb-4">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={focusAreaChartData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                domain={[0, 100]}
                tickFormatter={(v) => `${v}%`}
              />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid var(--border)" }}
                cursor={{ fill: "rgba(0,0,0,0.04)" }}
                labelFormatter={(_l, payload) => {
                  const p = payload?.[0]?.payload as { fullName?: string } | undefined;
                  return p?.fullName ?? "";
                }}
                formatter={(v: number, _n, item) => {
                  const p = item.payload as { tasks?: number };
                  return [`${v}% complete · ${p.tasks ?? 0} tasks`, "Progress"];
                }}
              />
              <Bar
                dataKey="percent"
                radius={[6, 6, 0, 0]}
                className="cursor-pointer focus:outline-none"
                onClick={(d: { focusAreaId?: number }) => {
                  if (d?.focusAreaId != null) navigate(`/projects?pillar=${d.focusAreaId}`);
                }}
              >
                {focusAreaChartData.map((d) => (
                  <Cell
                    key={d.name}
                    fill={d.hasOverdue ? "#F59E0B" : "#0F2238"}
                    className="cursor-pointer focus:outline-none"
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Needs Attention */}
        <Card className="shadow-sm border-destructive/20">
          <CardHeader className="border-b border-border bg-destructive/5 pb-4">
            <CardTitle className="flex items-center gap-2 text-destructive font-serif">
              <AlertCircle className="w-5 h-5" />
              Needs Attention
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {needsAttention.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">All clear.</div>
            ) : (
              <div className="divide-y divide-border max-h-[420px] overflow-auto">
                {needsAttention.map((item, i) => (
                  <div
                    key={i}
                    role="button"
                    tabIndex={0}
                    onClick={() => setEditingTaskId(item.taskId)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setEditingTaskId(item.taskId);
                      }
                    }}
                    data-testid={`needs-attention-${item.taskId}`}
                  >
                    <div className="p-4 hover:bg-muted/30 transition-colors cursor-pointer">
                      <div className="flex justify-between items-start gap-4">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium line-clamp-2">{item.description}</p>
                          <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                            <span className="font-mono bg-muted px-1 rounded text-xs">{item.projectId}</span>
                            <span>•</span>
                            <span className={getTaskDateColor(item.dueDate)}>{formatDate(item.dueDate)}</span>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2 shrink-0">
                          <span
                            className={`px-2 py-1 text-xs rounded-full font-medium ${
                              item.reason === "Blocked"
                                ? "bg-destructive/10 text-destructive"
                                : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {item.reason}
                          </span>
                          <div className="flex items-center gap-1">
                            <Avatar className="w-5 h-5">
                              <AvatarFallback
                                style={{
                                  backgroundColor: item.assigneeAvatarColor || "#333",
                                  color: "white",
                                  fontSize: "9px",
                                }}
                              >
                                {getInitials(item.assigneeName || "?")}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-xs text-muted-foreground truncate max-w-[80px]">
                              {item.assigneeName}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Workload */}
        <Card className="shadow-sm">
          <CardHeader className="border-b border-border pb-4">
            <CardTitle className="font-serif">Workload by Member</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border max-h-[420px] overflow-auto">
              {workload.map((row) => (
                <Link key={row.userId} href={`/people/${row.userId}`}>
                  <div className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors cursor-pointer">
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar className="w-8 h-8">
                        <AvatarFallback
                          style={{ backgroundColor: row.avatarColor || "#333", color: "white", fontSize: "12px" }}
                        >
                          {getInitials(row.name || "?")}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="font-medium truncate">{row.name}</p>
                        <p className="text-[11px] text-muted-foreground">{row.percentComplete}% avg complete</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-5 shrink-0">
                      <div className="text-center">
                        <p className="text-sm font-bold">{row.openTasks}</p>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Open</p>
                      </div>
                      <div className="text-center">
                        <p
                          className={`text-sm font-bold ${
                            row.overdueCount > 0 ? "text-destructive" : "text-muted-foreground"
                          }`}
                        >
                          {row.overdueCount}
                        </p>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Overdue</p>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <TaskFormDialog
        open={!!editingTaskId && !!editingTask}
        onOpenChange={(o) => { if (!o) setEditingTaskId(null); }}
        task={editingTask ?? undefined}
      />
    </div>
  );
}
