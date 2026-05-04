import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/status-badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft,
  Play,
  Server,
  HardDrive,
  AlertTriangle,
  Clock,
  Thermometer,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useLocation } from "wouter";
import type { ProxmoxHost, ProxmoxCheck } from "@shared/schema";
import { format, formatDistanceToNow } from "date-fns";

interface HealthPayload {
  overall_status?: string;
  storage_type?: string;
  components?: {
    zfs?: {
      status: string;
      pools?: { name: string; state: string }[];
    };
    smart?: {
      status: string;
      disks_total?: number;
      disks_warning?: number;
      disks_failed?: number;
      disks?: {
        name: string;
        model: string;
        status: string;
        temperature?: number;
        reallocated?: number;
        pending?: number;
      }[];
    };
    raid?: {
      status: string;
      virtual_disks_degraded?: number;
      predictive_failures?: number;
      virtual_disks?: {
        name: string;
        state: string;
        size?: string;
        raid_level?: string;
      }[];
    };
    mdadm?: {
      status: string;
      arrays_degraded?: number;
      arrays?: {
        name: string;
        state: string;
        level?: string;
        rebuild_progress?: string;
      }[];
    };
  };
  monitoring_error?: string | null;
}

interface ProxmoxHostWithCustomer extends ProxmoxHost {
  customerName?: string;
}

function StatusIcon({ status }: { status: string }) {
  if (status === "OK" || status === "ONLINE") return <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />;
  if (status === "WARN" || status === "DEGRADED") return <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />;
  if (status === "CRIT" || status === "FAILED" || status === "FAULTED") return <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />;
  return <AlertCircle className="h-4 w-4 text-slate-500" />;
}

function SmartStatusBadge({ status }: { status: string }) {
  const colorMap: Record<string, string> = {
    OK: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
    WARN: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
    CRIT: "bg-red-500/15 text-red-700 dark:text-red-400",
  };
  return (
    <Badge variant="outline" className={`no-default-hover-elevate no-default-active-elevate border-transparent text-xs ${colorMap[status] || colorMap.WARN}`}>
      {status}
    </Badge>
  );
}

function OverviewTab({ payload }: { payload: HealthPayload | null }) {
  if (!payload) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No check data available. Run a check to see health details.
        </CardContent>
      </Card>
    );
  }

  if (payload.monitoring_error) {
    const errorLabels: Record<string, string> = {
      SSH_TIMEOUT: "SSH connection timed out",
      AUTH_FAILED: "Authentication failed",
      SUDO_DENIED: "Sudo access denied",
      TOOL_MISSING: "Required monitoring tool not found on host",
    };
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center gap-3 text-muted-foreground">
            <AlertTriangle className="h-5 w-5" />
            <div>
              <p className="font-medium">Monitoring Error</p>
              <p className="text-sm">{errorLabels[payload.monitoring_error] || payload.monitoring_error}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const comp = payload.components;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        <Card data-testid="card-storage-type">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Storage Type</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <HardDrive className="h-5 w-5" />
              <span className="text-lg font-semibold">{payload.storage_type || "Unknown"}</span>
            </div>
          </CardContent>
        </Card>

        {comp?.zfs && (
          <Card data-testid="card-zfs-summary">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">ZFS Pools</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 mb-2">
                <StatusIcon status={comp.zfs.status} />
                <span className="text-lg font-semibold">{comp.zfs.pools?.length || 0} pool{(comp.zfs.pools?.length || 0) !== 1 ? "s" : ""}</span>
              </div>
              {comp.zfs.pools?.map((p) => (
                <div key={p.name} className="flex items-center justify-between text-sm py-1">
                  <span className="font-mono text-xs">{p.name}</span>
                  <SmartStatusBadge status={p.state === "ONLINE" ? "OK" : p.state === "DEGRADED" ? "WARN" : "CRIT"} />
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {comp?.raid && (
          <Card data-testid="card-raid-summary">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">RAID Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 mb-2">
                <StatusIcon status={comp.raid.status} />
                <span className="text-lg font-semibold">{comp.raid.virtual_disks?.length || 0} Virtual Disk{(comp.raid.virtual_disks?.length || 0) !== 1 ? "s" : ""}</span>
              </div>
              <div className="space-y-1 text-sm">
                {comp.raid.virtual_disks_degraded ? (
                  <p className="text-amber-600 dark:text-amber-400">{comp.raid.virtual_disks_degraded} degraded</p>
                ) : null}
                {comp.raid.predictive_failures ? (
                  <p className="text-amber-600 dark:text-amber-400">{comp.raid.predictive_failures} predictive failure{comp.raid.predictive_failures !== 1 ? "s" : ""}</p>
                ) : null}
                {!comp.raid.virtual_disks_degraded && !comp.raid.predictive_failures && (
                  <p className="text-muted-foreground">All virtual disks healthy</p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {comp?.smart && (
          <Card data-testid="card-smart-summary">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">SMART Health</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 mb-2">
                <StatusIcon status={comp.smart.status} />
                <span className="text-lg font-semibold">{comp.smart.disks_total || 0} disk{(comp.smart.disks_total || 0) !== 1 ? "s" : ""}</span>
              </div>
              <div className="space-y-1 text-sm">
                {comp.smart.disks_warning ? (
                  <p className="text-amber-600 dark:text-amber-400">{comp.smart.disks_warning} warning{comp.smart.disks_warning !== 1 ? "s" : ""}</p>
                ) : null}
                {comp.smart.disks_failed ? (
                  <p className="text-red-600 dark:text-red-400">{comp.smart.disks_failed} failed</p>
                ) : null}
                {!comp.smart.disks_warning && !comp.smart.disks_failed && (
                  <p className="text-muted-foreground">All disks healthy</p>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function DisksTab({ payload }: { payload: HealthPayload | null }) {
  const disks = payload?.components?.smart?.disks;
  if (!disks || disks.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No disk data available.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Model</TableHead>
              <TableHead>SMART</TableHead>
              <TableHead className="text-right">Reallocated</TableHead>
              <TableHead className="text-right">Pending</TableHead>
              <TableHead className="text-right">Temp</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {disks.map((disk) => (
              <TableRow key={disk.name} data-testid={`row-disk-${disk.name.replace(/\//g, "-")}`}>
                <TableCell className="font-mono text-xs">{disk.name}</TableCell>
                <TableCell className="text-xs max-w-[200px] truncate">{disk.model}</TableCell>
                <TableCell>
                  <SmartStatusBadge status={disk.status} />
                </TableCell>
                <TableCell className={`text-right ${(disk.reallocated || 0) > 0 ? "text-amber-600 dark:text-amber-400 font-medium" : ""}`}>
                  {disk.reallocated ?? "-"}
                </TableCell>
                <TableCell className={`text-right ${(disk.pending || 0) > 0 ? "text-amber-600 dark:text-amber-400 font-medium" : ""}`}>
                  {disk.pending ?? "-"}
                </TableCell>
                <TableCell className="text-right">
                  {disk.temperature != null ? (
                    <span className={`inline-flex items-center gap-1 ${disk.temperature > 45 ? "text-amber-600 dark:text-amber-400" : ""}`}>
                      <Thermometer className="h-3 w-3" />
                      {disk.temperature}°C
                    </span>
                  ) : "-"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function PoolsArraysTab({ payload }: { payload: HealthPayload | null }) {
  const comp = payload?.components;
  const zfsPools = comp?.zfs?.pools;
  const raidVDs = comp?.raid?.virtual_disks;
  const mdadmArrays = comp?.mdadm?.arrays;

  if (!zfsPools && !raidVDs && !mdadmArrays) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No pool or array data available.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {zfsPools && zfsPools.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">ZFS Pools</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pool Name</TableHead>
                  <TableHead>State</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {zfsPools.map((pool) => (
                  <TableRow key={pool.name} data-testid={`row-pool-${pool.name}`}>
                    <TableCell className="font-mono text-xs">{pool.name}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <StatusIcon status={pool.state} />
                        <span className={pool.state !== "ONLINE" ? "text-amber-600 dark:text-amber-400 font-medium" : ""}>
                          {pool.state}
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {raidVDs && raidVDs.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">RAID Virtual Disks</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>RAID Level</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>State</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {raidVDs.map((vd) => (
                  <TableRow key={vd.name} data-testid={`row-vd-${vd.name}`}>
                    <TableCell className="font-mono text-xs">{vd.name}</TableCell>
                    <TableCell>{vd.raid_level || "-"}</TableCell>
                    <TableCell>{vd.size || "-"}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <StatusIcon status={vd.state} />
                        <span className={vd.state !== "ONLINE" ? "text-amber-600 dark:text-amber-400 font-medium" : ""}>
                          {vd.state}
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {mdadmArrays && mdadmArrays.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">mdadm Arrays</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Level</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>Rebuild</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mdadmArrays.map((arr) => (
                  <TableRow key={arr.name} data-testid={`row-mdadm-${arr.name}`}>
                    <TableCell className="font-mono text-xs">{arr.name}</TableCell>
                    <TableCell>{arr.level || "-"}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <StatusIcon status={arr.state} />
                        <span>{arr.state}</span>
                      </div>
                    </TableCell>
                    <TableCell>{arr.rebuild_progress || "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function HistoryTab({ hostId }: { hostId: number }) {
  const { data: checks, isLoading } = useQuery<ProxmoxCheck[]>({
    queryKey: ["/api/proxmox-hosts", hostId, "checks"],
    queryFn: async () => {
      const res = await fetch(`/api/proxmox-hosts/${hostId}/checks?limit=20`);
      if (!res.ok) throw new Error("Failed to load checks");
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-6 space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!checks || checks.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No check history available.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Checked At</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Storage Type</TableHead>
              <TableHead>Error</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {checks.map((check, i) => {
              const prevCheck = checks[i + 1];
              const statusChanged = prevCheck && prevCheck.overallStatus !== check.overallStatus;

              return (
                <TableRow key={check.id} data-testid={`row-check-${check.id}`} className={statusChanged ? "border-l-2 border-l-amber-500" : ""}>
                  <TableCell className="text-xs">
                    <div>{format(new Date(check.checkedAt), "MMM d, yyyy HH:mm")}</div>
                    <div className="text-muted-foreground">{formatDistanceToNow(new Date(check.checkedAt), { addSuffix: true })}</div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={check.overallStatus} />
                    {statusChanged && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        (was {prevCheck.overallStatus})
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">{check.storageType || "-"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{check.monitoringError || "-"}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export default function ProxmoxDetail({ params }: { params: { id: string } }) {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const hostId = parseInt(params.id);

  const { data: host, isLoading } = useQuery<ProxmoxHostWithCustomer>({
    queryKey: ["/api/proxmox-hosts", hostId],
    queryFn: async () => {
      const res = await fetch(`/api/proxmox-hosts/${hostId}`);
      if (!res.ok) throw new Error("Host not found");
      return res.json();
    },
  });

  const runCheckMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/proxmox-hosts/${hostId}/run-check`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/proxmox-hosts", hostId] });
      queryClient.invalidateQueries({ queryKey: ["/api/proxmox-hosts", hostId, "checks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/proxmox-hosts"] });
      toast({ title: "Check completed" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="p-6">
        <Skeleton className="h-8 w-64 mb-4" />
        <Skeleton className="h-4 w-48 mb-6" />
        <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  if (!host) {
    return (
      <div className="p-6">
        <Button variant="ghost" onClick={() => navigate("/proxmox")} data-testid="button-back">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Proxmox Health
        </Button>
        <Card className="mt-4">
          <CardContent className="py-8 text-center text-muted-foreground">
            Host not found
          </CardContent>
        </Card>
      </div>
    );
  }

  const payload = host.lastStatusDetails as HealthPayload | null;

  return (
    <div className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/proxmox")} data-testid="button-back">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
      </div>

      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md ${
              host.lastStatus === "OK"
                ? "bg-emerald-500/15"
                : host.lastStatus === "CRIT"
                ? "bg-red-500/15"
                : host.lastStatus === "WARN"
                ? "bg-amber-500/15"
                : "bg-slate-500/15"
            }`}
          >
            <Server className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold tracking-tight" data-testid="text-host-name">{host.name}</h1>
              <StatusBadge status={host.lastStatus || "UNKNOWN"} />
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              {host.host}:{host.port}
              {host.customerName && ` \u00B7 ${host.customerName}`}
              {host.lastCheckAt && (
                <span className="ml-2">
                  <Clock className="h-3 w-3 inline mr-1" />
                  Last check: {format(new Date(host.lastCheckAt), "MMM d, HH:mm")}
                </span>
              )}
            </p>
          </div>
        </div>
        <Button
          onClick={() => runCheckMutation.mutate()}
          disabled={!host.enabled || runCheckMutation.isPending}
          data-testid="button-run-check"
        >
          <Play className="h-4 w-4 mr-2" />
          {runCheckMutation.isPending ? "Running..." : "Run Check Now"}
        </Button>
      </div>

      {host.consecutiveFailures > 0 && (
        <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 font-medium mb-4 p-3 rounded-md bg-red-500/10" data-testid="text-consecutive-failures">
          <AlertTriangle className="h-4 w-4" />
          {host.consecutiveFailures} consecutive check failure{host.consecutiveFailures !== 1 ? "s" : ""}
        </div>
      )}

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList data-testid="tabs-host-detail">
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="disks" data-testid="tab-disks">Disks</TabsTrigger>
          <TabsTrigger value="pools" data-testid="tab-pools">Pools / Arrays</TabsTrigger>
          <TabsTrigger value="history" data-testid="tab-history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab payload={payload} />
        </TabsContent>

        <TabsContent value="disks">
          <DisksTab payload={payload} />
        </TabsContent>

        <TabsContent value="pools">
          <PoolsArraysTab payload={payload} />
        </TabsContent>

        <TabsContent value="history">
          <HistoryTab hostId={hostId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
