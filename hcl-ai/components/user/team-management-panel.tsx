"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Users, Trash2, Loader2, Plus, Edit2 } from "lucide-react";

interface Team {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string;
}

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  teamId: string | null;
}

/**
 * Team management panel for admins
 */
export function TeamManagementPanel(): React.ReactElement {
  const [teams, setTeams] = React.useState<Team[]>([]);
  const [users, setUsers] = React.useState<User[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Form state
  const [newTeamName, setNewTeamName] = React.useState("");
  const [newTeamOwnerId, setNewTeamOwnerId] = React.useState("");

  // Edit state
  const [editingTeam, setEditingTeam] = React.useState<Team | null>(null);
  const [editTeamName, setEditTeamName] = React.useState("");

  // Fetch teams and users
  const fetchData = async (): Promise<void> => {
    try {
      const [teamsResponse, usersResponse] = await Promise.all([
        fetch("/api/teams"),
        fetch("/api/users"),
      ]);

      if (teamsResponse.ok) {
        const { teams: fetchedTeams } = await teamsResponse.json();
        setTeams(fetchedTeams);
      }

      if (usersResponse.ok) {
        const { users: fetchedUsers } = await usersResponse.json();
        setUsers(fetchedUsers);
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    fetchData();
  }, []);

  const handleCreateTeam = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newTeamName,
          ownerId: newTeamOwnerId,
        }),
      });

      if (response.ok) {
        await fetchData();
        setIsDialogOpen(false);
        // Reset form
        setNewTeamName("");
        setNewTeamOwnerId("");
      } else {
        const { error } = await response.json();
        alert(error || "Failed to create team");
      }
    } catch (error) {
      console.error("Failed to create team:", error);
      alert("Failed to create team");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditTeam = (team: Team): void => {
    setEditingTeam(team);
    setEditTeamName(team.name);
    setIsEditDialogOpen(true);
  };

  const handleUpdateTeam = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!editingTeam) return;

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/teams", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId: editingTeam.id,
          name: editTeamName,
        }),
      });

      if (response.ok) {
        await fetchData();
        setIsEditDialogOpen(false);
        setEditingTeam(null);
        setEditTeamName("");
      } else {
        const { error } = await response.json();
        alert(error || "Failed to update team");
      }
    } catch (error) {
      console.error("Failed to update team:", error);
      alert("Failed to update team");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteTeam = async (teamId: string): Promise<void> => {
    if (!confirm("Are you sure you want to delete this team?")) return;

    try {
      const response = await fetch(`/api/teams?teamId=${teamId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        await fetchData();
      } else {
        const { error } = await response.json();
        alert(error || "Failed to delete team");
      }
    } catch (error) {
      console.error("Failed to delete team:", error);
      alert("Failed to delete team");
    }
  };

  const getOwnerName = (ownerId: string): string => {
    const owner = users.find((u) => u.id === ownerId);
    return owner?.name || "Unknown";
  };

  const getMemberCount = (teamId: string): number => {
    return users.filter((u) => u.teamId === teamId).length;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Team Management</h2>
          <p className="text-sm text-muted-foreground">
            Manage teams and their members
          </p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Team
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleCreateTeam}>
              <DialogHeader>
                <DialogTitle>Create New Team</DialogTitle>
                <DialogDescription>
                  Create a new team for your organization
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto">
                <div className="space-y-2">
                  <Label htmlFor="teamName">Team Name</Label>
                  <Input
                    id="teamName"
                    type="text"
                    value={newTeamName}
                    onChange={(e) => setNewTeamName(e.target.value)}
                    required
                    disabled={isSubmitting}
                    placeholder="Engineering, Sales, Marketing, etc."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="owner">Team Owner</Label>
                  <select
                    id="owner"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    value={newTeamOwnerId}
                    onChange={(e) => setNewTeamOwnerId(e.target.value)}
                    required
                    disabled={isSubmitting}
                  >
                    <option value="">Select owner...</option>
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name} ({user.email})
                      </option>
                    ))}
                  </select>
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
                      Creating...
                    </>
                  ) : (
                    "Create Team"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Team Name</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Members</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {teams.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  No teams found
                </TableCell>
              </TableRow>
            ) : (
              teams.map((team) => (
                <TableRow key={team.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      {team.name}
                    </div>
                  </TableCell>
                  <TableCell>{getOwnerName(team.ownerId)}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {getMemberCount(team.id)} members
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {new Date(team.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleEditTeam(team)}
                        title="Edit team"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleDeleteTeam(team.id)}
                        title="Delete team"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Edit Team Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <form onSubmit={handleUpdateTeam}>
            <DialogHeader>
              <DialogTitle>Edit Team</DialogTitle>
              <DialogDescription>
                Update team name and ownership
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto">
              <div className="space-y-2">
                <Label htmlFor="editTeamName">Team Name</Label>
                <Input
                  id="editTeamName"
                  type="text"
                  value={editTeamName}
                  onChange={(e) => setEditTeamName(e.target.value)}
                  required
                  disabled={isSubmitting}
                  placeholder="Engineering, Sales, Marketing, etc."
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditDialogOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  "Update Team"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
