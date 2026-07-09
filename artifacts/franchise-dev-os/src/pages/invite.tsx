import { useState, useEffect } from "react";
import {
  useGetInvitationByToken,
  useAcceptInvitation,
} from "@workspace/api-client-react";
import { useAuth } from "@workspace/replit-auth-web";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  LayoutDashboard,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";

export default function InvitePage({ token }: { token: string }) {
  const { isAuthenticated } = useAuth();
  const { data, isLoading, isError } = useGetInvitationByToken(token);
  const accept = useAcceptInvitation();

  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);

  const appBase = () => import.meta.env.BASE_URL?.replace(/\/+$/, "") || "/";

  // Prefill the invited name once the invitation loads.
  useEffect(() => {
    if (data && data.status === "pending" && data.invitedAs) {
      setName((prev) => (prev === "" ? data.invitedAs : prev));
    }
  }, [data]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Enter your name.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    try {
      await accept.mutateAsync({
        data: { token, name: name.trim(), password },
      });
      window.location.href = appBase();
    } catch {
      setError("Could not accept this invitation. It may have expired.");
    }
  };

  return (
    <div className="min-h-[100dvh] w-full flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full p-8 space-y-6 bg-card border border-border shadow-2xl rounded-xl">
        <div className="space-y-3 text-center">
          <div className="w-16 h-16 bg-primary rounded-xl mx-auto flex items-center justify-center shadow-inner">
            <LayoutDashboard className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-serif font-bold text-foreground">Franchise Dev OS</h1>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center gap-2 text-muted-foreground py-6">
            <Loader2 className="w-5 h-5 animate-spin" /> Loading invitation…
          </div>
        )}

        {(isError || (!isLoading && !data)) && (
          <div className="space-y-3 py-4 text-center">
            <AlertCircle className="w-10 h-10 text-destructive mx-auto" />
            <p className="font-medium">This invitation link is not valid.</p>
            <p className="text-sm text-muted-foreground">
              It may have been mistyped or removed. Ask an administrator for a new link.
            </p>
          </div>
        )}

        {data && data.status === "pending" && (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2 text-center">
              <p className="text-muted-foreground text-sm">You've been invited to join as</p>
              <Badge variant="secondary" className="uppercase text-[10px] tracking-wider">
                {data.role}
              </Badge>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="invite-name" className="text-xs">Your name</Label>
              <Input
                id="invite-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Smith"
                data-testid="input-invite-name"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invite-password" className="text-xs">Create a password</Label>
              <Input
                id="invite-password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                data-testid="input-invite-password"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invite-confirm" className="text-xs">Confirm password</Label>
              <Input
                id="invite-confirm"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Re-enter your password"
                data-testid="input-invite-confirm"
              />
            </div>

            {error && (
              <p className="text-sm text-destructive" data-testid="text-invite-error">{error}</p>
            )}

            <Button
              type="submit"
              size="lg"
              disabled={accept.isPending}
              className="w-full font-serif text-lg h-12 shadow-md"
              data-testid="button-invite-submit"
            >
              {accept.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "Set password & sign in"}
            </Button>
          </form>
        )}

        {data && data.status === "accepted" && (
          <div className="space-y-3 py-4 text-center">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
            <p className="font-medium">This invitation has already been used.</p>
            <Button asChild className="w-full">
              <a href={appBase()}>{isAuthenticated ? "Go to dashboard" : "Go to sign in"}</a>
            </Button>
          </div>
        )}

        {data && data.status === "revoked" && (
          <div className="space-y-3 py-4 text-center">
            <AlertCircle className="w-10 h-10 text-destructive mx-auto" />
            <p className="font-medium">This invitation has been revoked.</p>
            <p className="text-sm text-muted-foreground">
              Ask an administrator for a new invite link.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
