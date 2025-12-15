import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserManagementPanel } from "@/components/user/user-management-panel";
import { TeamManagementPanel } from "@/components/user/team-management-panel";

export default async function AdminPage(): Promise<React.ReactElement> {
  const session = await auth();

  if (!session?.user) {
    redirect("/auth/signin");
  }

  if (session.user.role !== "admin") {
    redirect("/");
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Administration</h1>
        <p className="text-muted-foreground mt-2">
          Manage users, teams, and permissions
        </p>
      </div>

      <Tabs defaultValue="users" className="space-y-6">
        <TabsList>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="teams">Teams</TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <UserManagementPanel />
        </TabsContent>

        <TabsContent value="teams">
          <TeamManagementPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
