import * as React from "react";
import { nanoid } from "nanoid";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

type UserRole = "admin" | "user";

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
};

const initialUsers: UserRow[] = [
  { id: "u-1", name: "Demo Admin", email: "admin@example.com", role: "admin" },
  { id: "u-2", name: "Demo User", email: "user@example.com", role: "user" },
];

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function UserManagementPage(): React.ReactElement {
  const [users, setUsers] = React.useState<UserRow[]>(() => initialUsers);
  const [isOpen, setIsOpen] = React.useState(false);

  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState<UserRole>("user");
  const [error, setError] = React.useState<string | null>(null);

  const resetForm = () => {
    setName("");
    setEmail("");
    setRole("user");
    setError(null);
  };

  const openModal = () => {
    resetForm();
    setIsOpen(true);
  };

  const closeModal = () => {
    setIsOpen(false);
    setError(null);
  };

  const handleAddUser = () => {
    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedName) {
      setError("Name is required.");
      return;
    }
    if (!trimmedEmail || !isValidEmail(trimmedEmail)) {
      setError("Enter a valid email address.");
      return;
    }
    if (users.some((u) => u.email.toLowerCase() === trimmedEmail)) {
      setError("A user with this email already exists.");
      return;
    }

    setUsers((prev) => [
      ...prev,
      { id: nanoid(), name: trimmedName, email: trimmedEmail, role },
    ]);
    closeModal();
  };

  const handleDelete = (id: string) => {
    setUsers((prev) => prev.filter((u) => u.id !== id));
  };

  return (
    <div className="p-6">
      <div className="max-w-5xl space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-primary">User Management</h1>
            <p className="text-sm text-muted-foreground">Static demo page (no persistence, no auth).</p>
          </div>
          <Button onClick={openModal}>Add user</Button>
        </div>

        <Card className="border">
          <CardHeader>
            <CardTitle className="text-base">Users</CardTitle>
            <CardDescription>Manage users for the demo UI.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.name}</TableCell>
                    <TableCell className="text-muted-foreground">{u.email}</TableCell>
                    <TableCell>
                      <Badge variant={u.role === "admin" ? "default" : "secondary"} className="capitalize">
                        {u.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={() => handleDelete(u.id)}>
                        Remove
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Dialog open={isOpen} onOpenChange={(open) => (open ? setIsOpen(true) : closeModal())}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add user</DialogTitle>
              <DialogDescription>Creates a row in the table (static demo only).</DialogDescription>
            </DialogHeader>

            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="user-name">Name</Label>
                <Input
                  id="user-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Jane Doe"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="user-email">Email</Label>
                <Input
                  id="user-email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="jane@example.com"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Role</Label>
                  <Select value={role} onValueChange={(v) => setRole(v as UserRole)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">User</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {error && <div className="text-sm text-destructive">{error}</div>}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={closeModal}>
                Cancel
              </Button>
              <Button onClick={handleAddUser}>Add</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
