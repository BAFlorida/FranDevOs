import { Switch, Route, Router as WouterRouter, Link, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth, AuthProvider } from "@workspace/replit-auth-web";
import {
  useGetMe,
  getGetMeQueryKey,
  useStopImpersonation,
  useChangeMyPassword,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { 
  LayoutDashboard, 
  CheckSquare, 
  FolderKanban, 
  Users, 
  LogOut,
  Menu,
  FileSpreadsheet,
  Users2,
  UserPlus,
  ClipboardCheck,
  ShieldAlert,
  TrendingUp,
  Megaphone,
  BarChart3,
  Plug,
  ShieldCheck,
  KeyRound,
  Loader2,
  UserCog,
  Lock,
} from "lucide-react";
import { useState } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

const queryClient = new QueryClient();

// Pages
import MyTasksPage from "@/pages/my-tasks";
import TasksPage from "@/pages/tasks";
import TaskAssignmentPage from "@/pages/task-assignment";
import DashboardPage from "@/pages/dashboard";
import ProjectsPage from "@/pages/projects";
import ProjectDetailPage from "@/pages/project-detail";
import PeoplePage from "@/pages/people";
import PersonDetailPage from "@/pages/person-detail";
import ReportsPage from "@/pages/reports";
import GroupsPage from "@/pages/groups";
import CompletionRequestsPage from "@/pages/completion-requests";
import RoadblocksPage from "@/pages/roadblocks";
import SalesPage from "@/pages/sales";
import MarketingPage from "@/pages/marketing";
import ReportBuilderPage from "@/pages/report-builder";
import IntegrationsPage from "@/pages/integrations";
import InvitePage from "@/pages/invite";
import AdminPage from "@/pages/admin";
import RequestAccessPage from "@/pages/request-access";
import NotFound from "@/pages/not-found";

function LoginScreen() {
  const { login } = useAuth();
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    setSubmitting(true);
    setError(null);
    const result = await login(email.trim(), password);
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error ?? "Sign in failed.");
    }
  };

  return (
    <div className="min-h-[100dvh] w-full flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full p-8 space-y-7 bg-card border border-border shadow-2xl rounded-xl">
        <div className="space-y-4 text-center">
          <div className="w-16 h-16 bg-primary rounded-xl mx-auto flex items-center justify-center shadow-inner">
            <LayoutDashboard className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-serif font-bold text-foreground">Franchise Dev OS</h1>
          <p className="text-muted-foreground font-sans">Sign in to your account.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="login-email" className="text-xs">Email</Label>
            <Input
              id="login-email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              data-testid="input-login-email"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="login-password" className="text-xs">Password</Label>
            <Input
              id="login-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              data-testid="input-login-password"
            />
          </div>

          {error && (
            <p className="text-sm text-destructive" data-testid="text-login-error">{error}</p>
          )}

          <Button
            type="submit"
            size="lg"
            disabled={submitting}
            className="w-full font-serif text-lg h-12 shadow-md"
            data-testid="button-login-submit"
          >
            {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "Sign in"}
          </Button>
        </form>

        <p className="text-sm text-muted-foreground text-center">
          Need an account?{" "}
          <button
            type="button"
            onClick={() => navigate("/request-access")}
            className="font-medium text-primary underline-offset-2 hover:underline"
            data-testid="link-request-access"
          >
            Request access
          </button>
        </p>
      </div>
    </div>
  );
}

function ImpersonationBanner() {
  const { refresh } = useAuth();
  const { data: me } = useGetMe({ query: { queryKey: getGetMeQueryKey() } });
  const stop = useStopImpersonation();

  if (!me?.impersonating) return null;

  const handleStop = async () => {
    try {
      await stop.mutateAsync();
    } catch {
      // ignore — reload regardless to resync session state
    }
    await refresh();
    window.location.href = import.meta.env.BASE_URL?.replace(/\/+$/, "") || "/";
  };

  return (
    <div className="sticky top-0 z-30 flex items-center justify-between gap-3 bg-amber-500 px-4 py-2 text-amber-950 shadow-md">
      <div className="flex items-center gap-2 text-sm font-medium min-w-0">
        <UserCog className="w-4 h-4 shrink-0" />
        <span className="truncate">
          Acting as <span className="font-bold">{me.name}</span>
          {me.realUser ? <> · signed in as {me.realUser.name}</> : null}
        </span>
      </div>
      <Button
        size="sm"
        variant="outline"
        onClick={handleStop}
        disabled={stop.isPending}
        className="bg-amber-950 text-amber-50 border-amber-950 hover:bg-amber-900 hover:text-amber-50 shrink-0"
        data-testid="button-stop-impersonation"
      >
        {stop.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Switch back"}
      </Button>
    </div>
  );
}

function ChangePasswordDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const changePassword = useChangeMyPassword();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setCurrent("");
    setNext("");
    setConfirm("");
    setError(null);
  };

  const handleSubmit = async () => {
    setError(null);
    if (!current) {
      setError("Enter your current password.");
      return;
    }
    if (next.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    if (next !== confirm) {
      setError("New passwords do not match.");
      return;
    }
    try {
      await changePassword.mutateAsync({
        data: { currentPassword: current, newPassword: next },
      });
      toast.success("Password changed");
      reset();
      onClose();
    } catch {
      setError("Could not change password. Check your current password.");
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          reset();
          onClose();
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change password</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Current password</Label>
            <Input
              type="password"
              autoComplete="current-password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              data-testid="input-current-password"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">New password</Label>
            <Input
              type="password"
              autoComplete="new-password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              placeholder="At least 8 characters"
              data-testid="input-new-password"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Confirm new password</Label>
            <Input
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              data-testid="input-confirm-password"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              reset();
              onClose();
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={changePassword.isPending}
            data-testid="button-submit-change-password"
          >
            {changePassword.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Change password"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SidebarContent({ isMobile = false, close = () => {} }) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const { data: me } = useGetMe({ query: { enabled: !!user, queryKey: getGetMeQueryKey() } });
  const [showChangePassword, setShowChangePassword] = useState(false);

  const perms = me?.permissions ?? [];
  const has = (p: string) => perms.includes(p as never);
  const canAssign = has("assign_tasks");
  const canApprove = has("approve_completion");
  const canReports = has("view_reports") || has("run_reports");
  const canAdmin =
    has("manage_users") ||
    has("manage_permissions") ||
    has("view_audit_log") ||
    has("manage_access_requests") ||
    has("manage_invitations");
  const nav = [
    { href: "/", label: "My Tasks", icon: CheckSquare },
    ...(canAssign ? [{ href: "/assignments", label: "Task Assignment", icon: UserPlus }] : []),
    ...(canApprove ? [{ href: "/completion-requests", label: "Completion Requests", icon: ClipboardCheck }] : []),
    ...(canApprove ? [{ href: "/roadblocks", label: "Roadblocks", icon: ShieldAlert }] : []),
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/projects", label: "Tactics", icon: FolderKanban },
    { href: "/people", label: "People", icon: Users },
    ...(has("manage_groups") ? [{ href: "/groups", label: "Groups", icon: Users2 }] : []),
    ...(canReports ? [{ href: "/reports", label: "Reports", icon: FileSpreadsheet }] : []),
  ];

  const crmNav = canReports
    ? [
        { href: "/sales", label: "Sales", icon: TrendingUp },
        { href: "/marketing", label: "Marketing", icon: Megaphone },
        { href: "/report-builder", label: "Report Builder", icon: BarChart3 },
        { href: "/integrations", label: "Integrations", icon: Plug },
      ]
    : [];

  const adminNav = [
    ...(canAdmin ? [{ href: "/admin", label: "Users & Access", icon: ShieldCheck }] : []),
    { href: "/request-access", label: "Request Access", icon: KeyRound },
  ];

  return (
    <div className="flex flex-col h-full bg-sidebar text-sidebar-foreground">
      <div className="p-6 flex items-center gap-3">
        <div className="w-8 h-8 bg-sidebar-primary rounded flex items-center justify-center">
          <LayoutDashboard className="w-4 h-4 text-sidebar-primary-foreground" />
        </div>
        <span className="font-serif font-bold text-xl tracking-tight">FD OS</span>
      </div>

      <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
        {nav.map((item) => {
          const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
          return (
            <Link key={item.href} href={item.href}>
              <div 
                onClick={close}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors cursor-pointer",
                  isActive 
                    ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm" 
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                )}
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </div>
            </Link>
          );
        })}

        {crmNav.length > 0 && (
          <>
            <p className="px-3 pt-5 pb-1.5 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50">
              CRM
            </p>
            {crmNav.map((item) => {
              const isActive = location === item.href || location.startsWith(item.href);
              return (
                <Link key={item.href} href={item.href}>
                  <div
                    onClick={close}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors cursor-pointer",
                      isActive
                        ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                        : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                    )}
                  >
                    <item.icon className="w-5 h-5" />
                    {item.label}
                  </div>
                </Link>
              );
            })}
          </>
        )}

        <p className="px-3 pt-5 pb-1.5 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50">
          Admin
        </p>
        {adminNav.map((item) => {
          const isActive = location === item.href || location.startsWith(item.href);
          return (
            <Link key={item.href} href={item.href}>
              <div
                onClick={close}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors cursor-pointer",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                )}
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </div>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 mt-auto border-t border-sidebar-border">
        <div className="flex items-center gap-3 mb-4 px-2">
          {me?.profileImageUrl ? (
            <img src={me.profileImageUrl} alt="" className="w-10 h-10 rounded-full bg-sidebar-accent object-cover" />
          ) : (
            <div 
              className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm text-white shadow-inner"
              style={{ backgroundColor: me?.avatarColor || '#333' }}
            >
              {me?.name?.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-semibold truncate">{me?.name}</span>
            <span className="text-xs text-sidebar-foreground/60 capitalize truncate">{me?.role}</span>
          </div>
        </div>
        <Button
          variant="ghost"
          className="w-full justify-start text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"
          onClick={() => setShowChangePassword(true)}
          data-testid="button-change-password"
        >
          <Lock className="w-4 h-4 mr-2" />
          Change password
        </Button>
        <Button 
          variant="ghost" 
          className="w-full justify-start text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground" 
          onClick={() => logout()}
        >
          <LogOut className="w-4 h-4 mr-2" />
          Sign out
        </Button>
      </div>
      <ChangePasswordDialog
        open={showChangePassword}
        onClose={() => setShowChangePassword(false)}
      />
    </div>
  );
}

function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-[100dvh] flex bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 flex-col fixed inset-y-0 left-0 border-r border-sidebar-border z-20 shadow-xl">
        <SidebarContent />
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col md:pl-64 min-w-0">
        <ImpersonationBanner />
        {/* Mobile Header */}
        <header className="md:hidden flex items-center justify-between p-4 border-b border-border bg-card sticky top-0 z-10 shadow-sm">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-primary rounded flex items-center justify-center">
              <LayoutDashboard className="w-3 h-3 text-primary-foreground" />
            </div>
            <span className="font-serif font-bold text-lg">FD OS</span>
          </div>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-64 border-r-sidebar-border">
              <SidebarContent isMobile close={() => setOpen(false)} />
            </SheetContent>
          </Sheet>
        </header>

        <main className="flex-1 p-4 md:p-8 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();
  const [location] = useLocation();

  // The invite acceptance screen must be reachable without an existing session.
  if (location.startsWith("/invite/")) {
    return (
      <Switch>
        <Route path="/invite/:token">
          {(params) => <InvitePage token={params.token} />}
        </Route>
      </Switch>
    );
  }

  if (isLoading) {
    return <div className="min-h-[100dvh] flex items-center justify-center bg-background"><div className="animate-pulse w-8 h-8 bg-primary rounded" /></div>;
  }

  // Self-service access/account requests must work for people WITHOUT an
  // account. Render the request screen standalone (no authed app shell) when
  // the visitor is not signed in.
  if (!isAuthenticated && location === "/request-access") {
    return <RequestAccessPage />;
  }

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  return (
    <AppShell>
      <Switch>
        <Route path="/" component={MyTasksPage} />
        <Route path="/tasks" component={TasksPage} />
        <Route path="/assignments" component={TaskAssignmentPage} />
        <Route path="/completion-requests" component={CompletionRequestsPage} />
        <Route path="/roadblocks" component={RoadblocksPage} />
        <Route path="/dashboard" component={DashboardPage} />
        <Route path="/projects" component={ProjectsPage} />
        <Route path="/projects/:id" component={ProjectDetailPage} />
        <Route path="/people" component={PeoplePage} />
        <Route path="/people/:id" component={PersonDetailPage} />
        <Route path="/groups" component={GroupsPage} />
        <Route path="/reports" component={ReportsPage} />
        <Route path="/sales" component={SalesPage} />
        <Route path="/marketing" component={MarketingPage} />
        <Route path="/report-builder" component={ReportBuilderPage} />
        <Route path="/integrations" component={IntegrationsPage} />
        <Route path="/admin" component={AdminPage} />
        <Route path="/request-access" component={RequestAccessPage} />
        <Route component={NotFound} />
      </Switch>
    </AppShell>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <AppContent />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
