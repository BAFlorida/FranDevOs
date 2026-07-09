import {
  useGetIntegrationStatus,
  useRefreshIntegration,
  getGetIntegrationStatusQueryKey,
  CrmExternalSource,
  type IntegrationConnectionCard,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SourceBadge } from "@/components/source-badge";
import { QueryError } from "@/components/query-error";
import { freshness, isStale } from "@/lib/crm";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import {
  Plug,
  RefreshCw,
  CheckCircle2,
  KeyRound,
  Database,
  Clock,
} from "lucide-react";

export default function IntegrationsPage() {
  const queryClient = useQueryClient();
  const { data: cards, isLoading, isError, refetch, isRefetching } = useGetIntegrationStatus();
  const refreshMutation = useRefreshIntegration();

  const refresh = (source: CrmExternalSource) => {
    refreshMutation.mutate(
      { data: { source } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: getGetIntegrationStatusQueryKey(),
          });
          toast.success(`Refreshed ${source} (mock sync)`);
        },
        onError: () => toast.error("Refresh failed"),
      },
    );
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <header>
        <h1 className="text-3xl font-serif font-bold text-foreground flex items-center gap-2">
          <Plug className="h-7 w-7 text-primary" /> Integrations
        </h1>
        <p className="text-muted-foreground mt-1">
          CRM source connections. All connections are mocked — no external calls
          are made.
        </p>
      </header>

      <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm">
        <KeyRound className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
        <p className="text-muted-foreground">
          When real connections are enabled, credentials (OAuth tokens, API
          keys) will live in{" "}
          <span className="font-medium text-foreground">Replit Secrets</span> —
          never in the database or client. This prototype reads from canonical
          tables seeded with mock Salesforce & HubSpot data.
        </p>
      </div>

      {isLoading ? (
        <div className="p-8 text-center text-muted-foreground">
          Loading connections…
        </div>
      ) : isError ? (
        <QueryError
          message="Failed to load connections"
          onRetry={() => refetch()}
          retrying={isRefetching}
        />
      ) : (cards ?? []).length === 0 ? (
        <div className="p-12 text-center text-muted-foreground border border-dashed rounded-lg">
          No connections configured.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {(cards ?? []).map((card) => (
            <ConnectionCard
              key={card.connection.id}
              card={card}
              onRefresh={() =>
                refresh(card.connection.sourceSystem as CrmExternalSource)
              }
              refreshing={refreshMutation.isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ConnectionCard({
  card,
  onRefresh,
  refreshing,
}: {
  card: IntegrationConnectionCard;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  const { connection, recentEvents } = card;
  const stale = isStale(connection.lastSyncAt);

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-2">
        <div className="space-y-1.5">
          <CardTitle className="text-lg flex items-center gap-2">
            <SourceBadge source={connection.sourceSystem} />
            {connection.displayName}
          </CardTitle>
          <Badge
            variant="outline"
            className="bg-green-100 text-green-800 border-transparent dark:bg-green-900/30 dark:text-green-400"
          >
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Connected — mock
          </Badge>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={refreshing}
        >
          <RefreshCw
            className={`h-4 w-4 mr-1.5 ${refreshing ? "animate-spin" : ""}`}
          />
          Sync
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2 text-sm">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span className={stale ? "text-amber-600 dark:text-amber-400" : ""}>
            Last sync {freshness(connection.lastSyncAt)}
          </span>
        </div>

        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-1.5 flex items-center gap-1">
            <Database className="h-3.5 w-3.5" /> Objects synced
          </p>
          <div className="flex flex-wrap gap-1.5">
            {connection.objectsSynced.map((o) => (
              <Badge key={o} variant="secondary" className="capitalize">
                {o}
              </Badge>
            ))}
          </div>
        </div>

        {recentEvents.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-1.5">
              Recent sync history
            </p>
            <ul className="space-y-1">
              {recentEvents.slice(0, 4).map((e) => (
                <li
                  key={e.id}
                  className="flex items-center justify-between text-xs rounded-md bg-muted/40 px-2.5 py-1.5"
                >
                  <span className="capitalize font-medium">{e.objectType}</span>
                  <span className="text-muted-foreground">
                    {e.recordsSynced} records · {formatDate(e.startedAt)}
                  </span>
                  <Badge
                    variant="outline"
                    className="text-[10px] capitalize border-transparent bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                  >
                    {e.status}
                  </Badge>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
