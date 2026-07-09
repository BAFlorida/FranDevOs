import {
  useGetMe,
  useCreateAccessRequest,
  getGetMeQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@workspace/replit-auth-web";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { KeyRound, UserPlus, Send } from "lucide-react";
import { useState } from "react";

type Role = "member" | "lead" | "admin" | "vp";
const ROLES: Role[] = ["member", "lead", "admin", "vp"];
const ROLE_LABEL: Record<Role, string> = {
  member: "Member",
  lead: "Lead",
  admin: "Admin",
  vp: "VP",
};

export default function RequestAccessPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const isAuthed = !!user;
  const { data: me } = useGetMe({
    query: { enabled: isAuthed, queryKey: getGetMeQueryKey() },
  });
  const createRequest = useCreateAccessRequest();

  // Signed-in members default to asking for elevated access; anonymous visitors
  // can only request a brand-new account for themselves.
  const [kind, setKind] = useState<"access" | "account">(
    isAuthed ? "access" : "account",
  );
  const [requestedRole, setRequestedRole] = useState<Role>(
    isAuthed ? "lead" : "member",
  );
  const [reason, setReason] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (kind === "account") {
      if (!name.trim()) {
        toast.error(isAuthed ? "Enter the new teammate's name" : "Enter your name");
        return;
      }
      if (!isAuthed && !email.trim()) {
        toast.error("Enter your email so an admin can reach you");
        return;
      }
    }
    try {
      await createRequest.mutateAsync({
        data: {
          kind,
          requestedRole,
          reason: reason.trim() || null,
          ...(kind === "account"
            ? { name: name.trim(), email: email.trim() || null }
            : {}),
        },
      });
      setSubmitted(true);
      setReason("");
      setName("");
      setEmail("");
      toast.success("Request submitted");
    } catch {
      toast.error("Failed to submit request");
    }
  };

  const form = (
    <div className="max-w-2xl mx-auto space-y-6 w-full">
      <div className="flex items-center gap-3">
        <KeyRound className="w-8 h-8 text-primary" />
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">
            {isAuthed ? "Request Access" : "Request an Account"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isAuthed
              ? "Ask an administrator for elevated access or to add a new teammate."
              : "Tell us who you are and an administrator will set you up with an account."}
          </p>
        </div>
      </div>

      {submitted && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-4 text-sm">
            Your request has been submitted. An administrator will review it
            shortly.
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-5 space-y-5">
          {isAuthed && (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant={kind === "access" ? "default" : "outline"}
                onClick={() => setKind("access")}
                data-testid="button-kind-access"
              >
                <KeyRound className="w-4 h-4 mr-1.5" /> More access for me
              </Button>
              <Button
                type="button"
                size="sm"
                variant={kind === "account" ? "default" : "outline"}
                onClick={() => setKind("account")}
                data-testid="button-kind-account"
              >
                <UserPlus className="w-4 h-4 mr-1.5" /> Add a teammate
              </Button>
            </div>
          )}

          {kind === "access" ? (
            <div className="rounded-md border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
              Requesting as{" "}
              <span className="font-medium text-foreground">{me?.name}</span>
              {me?.email ? ` (${me.email})` : ""}.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">
                  {isAuthed ? "Teammate name" : "Your name"}
                </Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Jane Smith"
                  data-testid="input-request-name"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">
                  {isAuthed ? "Email (optional)" : "Email"}
                </Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="jane@example.com"
                  data-testid="input-request-email"
                />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs">
              {kind === "access"
                ? "Requested role"
                : isAuthed
                  ? "Role for new teammate"
                  : "Role you need"}
            </Label>
            <Select
              value={requestedRole}
              onValueChange={(v) => setRequestedRole(v as Role)}
            >
              <SelectTrigger data-testid="select-request-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Reason (optional)</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why do you need this access?"
              rows={3}
              data-testid="input-request-reason"
            />
          </div>

          <Button
            onClick={handleSubmit}
            disabled={createRequest.isPending}
            data-testid="button-submit-request"
          >
            <Send className="w-4 h-4 mr-2" /> Submit request
          </Button>

          {!isAuthed && (
            <p className="text-sm text-muted-foreground">
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => navigate("/")}
                className="font-medium text-primary underline-offset-2 hover:underline"
                data-testid="link-sign-in"
              >
                Sign in
              </button>
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );

  // When unauthenticated, this page renders standalone (outside the app shell),
  // so provide its own full-height background and padding.
  if (!isAuthed) {
    return (
      <div className="min-h-[100dvh] w-full bg-background flex items-start justify-center p-4 md:p-8">
        {form}
      </div>
    );
  }

  return form;
}
