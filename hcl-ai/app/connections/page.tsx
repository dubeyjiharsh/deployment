"use client";

import * as React from "react";
import ReactDOM from "react-dom";
import { Plug, Plus, Trash2, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import type { McpServerConfig } from "@/lib/validators/canvas-schema";

/**
 * Connections page for managing MCP servers
 */
export default function ConnectionsPage() {
  const [servers, setServers] = React.useState<McpServerConfig[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [isTesting, setIsTesting] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [headerPortal, setHeaderPortal] = React.useState<HTMLElement | null>(null);
  const [actionsPortal, setActionsPortal] = React.useState<HTMLElement | null>(null);

  // Form state
  const [formData, setFormData] = React.useState({
    name: "",
    type: "stdio",
    command: "",
    args: "",
    env: "",
  });

  // Set up portals for header and actions
  React.useEffect(() => {
    setHeaderPortal(document.getElementById("page-header"));
    setActionsPortal(document.getElementById("page-actions"));
  }, []);

  // Load servers on mount
  React.useEffect(() => {
    loadServers();
  }, []);

  const loadServers = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/mcp");
      if (!response.ok) throw new Error("Failed to fetch servers");
      const data = await response.json();
      setServers(data);
    } catch (error) {
      console.error("Error loading servers:", error);
      toast.error("Failed to load MCP servers");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddServer = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setIsSubmitting(true);

      const config: Record<string, unknown> = {
        command: formData.command,
      };

      if (formData.args) {
        config.args = formData.args.split(",").map((arg) => arg.trim());
      }

      if (formData.env) {
        try {
          config.env = JSON.parse(formData.env);
        } catch {
          toast.error("Invalid JSON format for environment variables");
          return;
        }
      }

      const response = await fetch("/api/mcp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          type: formData.type,
          config,
          enabled: true,
        }),
      });

      if (!response.ok) throw new Error("Failed to add server");

      const newServer = await response.json();
      setServers([...servers, newServer]);

      toast.success("MCP server added successfully");
      setIsDialogOpen(false);
      setFormData({ name: "", type: "stdio", command: "", args: "", env: "" });
    } catch (error) {
      console.error("Error adding server:", error);
      toast.error("Failed to add MCP server");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleServer = async (id: string) => {
    try {
      const response = await fetch("/api/mcp", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      if (!response.ok) throw new Error("Failed to toggle server");

      setServers(
        servers.map((s) =>
          s.id === id ? { ...s, enabled: !s.enabled } : s
        )
      );

      toast.success("Server status updated");
    } catch (error) {
      console.error("Error toggling server:", error);
      toast.error("Failed to toggle server");
    }
  };

  const handleDeleteServer = async (id: string) => {
    if (!confirm("Are you sure you want to delete this server?")) return;

    try {
      const response = await fetch(`/api/mcp?id=${id}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete server");

      setServers(servers.filter((s) => s.id !== id));
      toast.success("Server deleted successfully");
    } catch (error) {
      console.error("Error deleting server:", error);
      toast.error("Failed to delete server");
    }
  };

  const handleTestConnection = async (server: McpServerConfig) => {
    try {
      setIsTesting(server.id);

      const response = await fetch("/api/mcp/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(server),
      });

      if (!response.ok) throw new Error("Failed to test connection");

      const result = await response.json();

      if (result.success) {
        toast.success(
          `Connection successful! Found ${result.tools?.length || 0} tools and ${result.resources?.length || 0} resources.`
        );
      } else {
        toast.error(`Connection failed: ${result.error}`);
      }
    } catch (error) {
      console.error("Error testing connection:", error);
      toast.error("Failed to test connection");
    } finally {
      setIsTesting(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      {/* Render page title in header */}
      {headerPortal && ReactDOM.createPortal(
        <>
          <Plug className="h-5 w-5" />
          <h1 className="text-lg font-semibold">Connections</h1>
        </>,
        headerPortal
      )}

      {/* Render actions in header */}
      {actionsPortal && ReactDOM.createPortal(
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Server
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Add MCP Server</DialogTitle>
              <DialogDescription>
                Configure a new Model Context Protocol server connection
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddServer}>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Server Name</Label>
                  <Input
                    id="name"
                    placeholder="My MCP Server"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="command">Command</Label>
                  <Input
                    id="command"
                    placeholder="npx"
                    value={formData.command}
                    onChange={(e) =>
                      setFormData({ ...formData, command: e.target.value })
                    }
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    The command to execute (e.g., npx, node, python)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="args">Arguments (comma-separated)</Label>
                  <Input
                    id="args"
                    placeholder="-y, @modelcontextprotocol/server-filesystem, /path/to/files"
                    value={formData.args}
                    onChange={(e) =>
                      setFormData({ ...formData, args: e.target.value })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="env">Environment Variables (JSON)</Label>
                  <Textarea
                    id="env"
                    placeholder='{"KEY": "value"}'
                    value={formData.env}
                    onChange={(e) =>
                      setFormData({ ...formData, env: e.target.value })
                    }
                    rows={3}
                    className="resize-none font-mono text-xs"
                  />
                  <p className="text-xs text-muted-foreground">
                    Optional environment variables in JSON format
                  </p>
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    "Add Server"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>,
        actionsPortal
      )}

      <div className="container max-w-4xl px-6 py-8 md:px-8">
        {/* Server List */}
        <div className="space-y-6">
        {servers.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Plug className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium mb-1">No servers configured</p>
              <p className="text-sm text-muted-foreground mb-4">
                Add your first MCP server to get started
              </p>
              <Button onClick={() => setIsDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Server
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
          {servers.map((server) => (
            <Card key={server.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <CardTitle>{server.name}</CardTitle>
                      <Badge variant={server.enabled ? "default" : "secondary"}>
                        {server.enabled ? "Enabled" : "Disabled"}
                      </Badge>
                    </div>
                    <CardDescription>Type: {server.type}</CardDescription>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleTestConnection(server)}
                      disabled={isTesting === server.id}
                    >
                      {isTesting === server.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : server.enabled ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : (
                        <XCircle className="h-4 w-4" />
                      )}
                    </Button>
                    <Switch
                      checked={server.enabled}
                      onCheckedChange={() => handleToggleServer(server.id)}
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleDeleteServer(server.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="font-medium">Command:</span>{" "}
                    <code className="bg-muted px-1.5 py-0.5 rounded">
                      {server.config.command as string}
                    </code>
                  </div>
                  {server.config.args !== undefined && server.config.args !== null && (
                    <div>
                      <span className="font-medium">Arguments:</span>{" "}
                      <code className="bg-muted px-1.5 py-0.5 rounded">
                        {Array.isArray(server.config.args)
                          ? server.config.args.join(" ")
                          : String(server.config.args)}
                      </code>
                    </div>
                  )}
                  {server.config.env !== undefined && server.config.env !== null && (
                    <div>
                      <span className="font-medium">Environment:</span>{" "}
                      <code className="bg-muted px-1.5 py-0.5 rounded text-xs">
                        {JSON.stringify(server.config.env)}
                      </code>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
          </div>
        )}

        {/* Info Section */}
        <Card>
          <CardHeader>
            <CardTitle>About MCP Servers</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>
              Model Context Protocol (MCP) servers provide additional context to
              the AI during canvas generation. They can access filesystems,
              databases, APIs, and other data sources.
            </p>
            <div className="space-y-2">
              <p className="font-medium text-foreground">Common MCP Servers:</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>
                  <strong>Filesystem:</strong> Access local files and documents
                </li>
                <li>
                  <strong>GitHub:</strong> Query repositories, issues, and pull requests
                </li>
                <li>
                  <strong>PostgreSQL:</strong> Query database for metrics and data
                </li>
                <li>
                  <strong>Google Drive:</strong> Access documents and spreadsheets
                </li>
                <li>
                  <strong>Slack:</strong> Retrieve conversations and context
                </li>
              </ul>
            </div>
            <p>
              Visit{" "}
              <a
                href="https://github.com/modelcontextprotocol"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline"
              >
                github.com/modelcontextprotocol
              </a>{" "}
              for available servers and installation instructions.
            </p>
          </CardContent>
        </Card>
        </div>
      </div>
    </>
  );
}
