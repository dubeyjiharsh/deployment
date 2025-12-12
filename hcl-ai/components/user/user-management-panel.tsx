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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { UserPlus, Trash2, Loader2 } from "lucide-react";

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  teamId: string | null;
  createdAt: string;
}

interface Team {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string;
}

const DEFAULT_ROLE_DEFINITIONS = [
  { id: "admin", name: "Admin" },
  { id: "user", name: "User" },
  { id: "viewer", name: "Viewer" },
];

/**
 * User management panel for admins
 */
export function UserManagementPanel(): React.ReactElement {
  const [users, setUsers] = React.useState<User[]>([]);
  const [teams, setTeams] = React.useState<Team[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Form state
  const [newUserEmail, setNewUserEmail] = React.useState("");
  const [newUserName, setNewUserName] = React.useState("");
  const [newUserPassword, setNewUserPassword] = React.useState("");
  const [newUserRole, setNewUserRole] = React.useState<string>("user");
  const [newUserTeamId, setNewUserTeamId] = React.useState<string>("no-team");
  const [roleOptions, setRoleOptions] = React.useState<string[]>(["user", "admin"]);
  const [roleLabels, setRoleLabels] = React.useState<Record<string, string>>({
    admin: "Admin",
    user: "User",
  });
  const [editingUser, setEditingUser] = React.useState<User | null>(null);
  const [editUserName, setEditUserName] = React.useState("");
  const [editUserEmail, setEditUserEmail] = React.useState("");
  const [editUserRole, setEditUserRole] = React.useState<string>("user");
  const [editUserTeamId, setEditUserTeamId] = React.useState<string>("no-team");

  // Fetch users and teams
  const fetchData = async (): Promise<void> => {
    try {
      const [usersResponse, teamsResponse] = await Promise.all([
        fetch("/api/users"),
        fetch("/api/teams"),
      ]);

      if (usersResponse.ok) {
        const { users: fetchedUsers } = await usersResponse.json();
        setUsers(fetchedUsers);
      }

      if (teamsResponse.ok) {
        const { teams: fetchedTeams } = await teamsResponse.json();
        setTeams(fetchedTeams);
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    fetchData();
    // Pull role definitions so we can assign custom roles
    (async () => {
      try {
        const res = await fetch("/api/settings");
        if (!res.ok) return;
        const data = await res.json();
        const definitions =
          (Array.isArray(data.settings?.roleDefinitions) && data.settings.roleDefinitions.length > 0
            ? data.settings.roleDefinitions
            : DEFAULT_ROLE_DEFINITIONS) as Array<{ id: string; name?: string }>;

        const customRoles = definitions.map((def) => def.id);
        const labels = definitions.reduce((acc: Record<string, string>, def) => {
          acc[def.id] = def.name || def.id;
          return acc;
        }, { admin: "Admin", user: "User" });

        setRoleLabels(labels);
        setRoleOptions(Array.from(new Set(["user", "admin", ...customRoles])));
      } catch (error) {
        console.error("Failed to fetch role definitions:", error);
      }
    })();
  }, []);

  const handleOpenEdit = (user: User): void => {
    setEditingUser(user);
    setEditUserName(user.name);
    setEditUserEmail(user.email);
    setEditUserRole(user.role);
    setEditUserTeamId(user.teamId || "no-team");
    setIsEditDialogOpen(true);
  };

  const handleUpdateUser = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!editingUser) return;
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: editingUser.id,
          name: editUserName,
          email: editUserEmail,
          role: editUserRole,
          teamId: editUserTeamId === "no-team" ? null : editUserTeamId,
        }),
      });

      if (response.ok) {
        await fetchData();
        setIsEditDialogOpen(false);
        setEditingUser(null);
      } else {
        const { error } = await response.json();
        alert(error || "Failed to update user");
      }
    } catch (error) {
      console.error("Failed to update user:", error);
      alert("Failed to update user");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: newUserEmail,
          name: newUserName,
          password: newUserPassword,
          role: newUserRole,
          teamId: newUserTeamId === "no-team" ? null : newUserTeamId,
        }),
      });

      if (response.ok) {
        await fetchData();
        setIsDialogOpen(false);
        // Reset form
        setNewUserEmail("");
        setNewUserName("");
        setNewUserPassword("");
        setNewUserRole("user");
        setNewUserTeamId("no-team");
      } else {
        const { error } = await response.json();
        alert(error || "Failed to create user");
      }
    } catch (error) {
      console.error("Failed to create user:", error);
      alert("Failed to create user");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteUser = async (userId: string): Promise<void> => {
    if (!confirm("Are you sure you want to delete this user?")) return;

    try {
      const response = await fetch(`/api/users?userId=${userId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        await fetchData();
      } else {
        const { error } = await response.json();
        alert(error || "Failed to delete user");
      }
    } catch (error) {
      console.error("Failed to delete user:", error);
      alert("Failed to delete user");
    }
  };

  const getTeamName = (teamId: string | null): string => {
    if (!teamId) return "No team";
    const team = teams.find((t) => t.id === teamId);
    return team?.name || "Unknown team";
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
          <h2 className="text-2xl font-bold">User Management</h2>
          <p className="text-sm text-muted-foreground">
            Manage users and their permissions
          </p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="mr-2 h-4 w-4" />
              Add User
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleCreateUser}>
              <DialogHeader>
                <DialogTitle>Create New User</DialogTitle>
                <DialogDescription>
                  Add a new user to your organization
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                    required
                    disabled={isSubmitting}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    type="text"
                    value={newUserName}
                    onChange={(e) => setNewUserName(e.target.value)}
                    required
                    disabled={isSubmitting}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={newUserPassword}
                    onChange={(e) => setNewUserPassword(e.target.value)}
                    required
                    disabled={isSubmitting}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <Select
                    value={newUserRole}
                    onValueChange={(value) =>
                      setNewUserRole(value)
                    }
                    disabled={isSubmitting}
                  >
                    <SelectTrigger id="role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {roleOptions.map((role) => (
                        <SelectItem key={role} value={role}>
                          {roleLabels[role] || role}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="team">Team (Optional)</Label>
                  <Select
                    value={newUserTeamId}
                    onValueChange={setNewUserTeamId}
                    disabled={isSubmitting}
                  >
                    <SelectTrigger id="team">
                      <SelectValue placeholder="No team" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="no-team">No team</SelectItem>
                      {teams.map((team) => (
                        <SelectItem key={team.id} value={team.id}>
                          {team.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                    "Create User"
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
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Team</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  No users found
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <Badge variant={user.role === "admin" ? "default" : "secondary"}>
                      {roleLabels[user.role] || user.role}
                    </Badge>
                  </TableCell>
                  <TableCell>{getTeamName(user.teamId)}</TableCell>
                  <TableCell>
                    {new Date(user.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleOpenEdit(user)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleDeleteUser(user.id)}
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

      {/* Edit user dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <form onSubmit={handleUpdateUser}>
            <DialogHeader>
              <DialogTitle>Edit User</DialogTitle>
              <DialogDescription>
                Update basic details, role, or team assignment.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Name</Label>
                <Input
                  id="edit-name"
                  type="text"
                  value={editUserName}
                  onChange={(e) => setEditUserName(e.target.value)}
                  required
                  disabled={isSubmitting}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-email">Email</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={editUserEmail}
                  onChange={(e) => setEditUserEmail(e.target.value)}
                  required
                  disabled={isSubmitting}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-role">Role</Label>
                <Select
                  value={editUserRole}
                  onValueChange={setEditUserRole}
                  disabled={isSubmitting}
                >
                  <SelectTrigger id="edit-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {roleOptions.map((role) => (
                      <SelectItem key={role} value={role}>
                        {roleLabels[role] || role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-team">Team (Optional)</Label>
                <Select
                  value={editUserTeamId}
                  onValueChange={setEditUserTeamId}
                  disabled={isSubmitting}
                >
                  <SelectTrigger id="edit-team">
                    <SelectValue placeholder="No team" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="no-team">No team</SelectItem>
                    {teams.map((team) => (
                      <SelectItem key={team.id} value={team.id}>
                        {team.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                    Saving...
                  </>
                ) : (
                  "Save Changes"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
