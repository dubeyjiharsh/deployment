import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { linkTo } from "@/lib/router";

export function NotFoundPage(): React.ReactElement {
  return (
    <div className="p-6">
      <div className="max-w-2xl">
        <Card className="border">
          <CardHeader>
            <CardTitle className="text-base">Not found</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <a href={linkTo("/")} className="text-primary underline underline-offset-4">
              Go back to dashboard
            </a>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
