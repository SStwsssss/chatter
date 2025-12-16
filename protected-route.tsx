import { useAuth } from "@/hooks/use-auth";
import { Redirect, Route } from "wouter";

export function ProtectedRoute({
  path,
  component: Component,
}: {
  path: string;
  component: () => React.JSX.Element;
}) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <Route path={path}>
        <div className="flex items-center justify-center min-h-screen bg-background">
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-foreground border-t-transparent animate-spin mx-auto mb-4" />
            <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
              LOADING
            </p>
          </div>
        </div>
      </Route>
    );
  }

  if (!user) {
    return (
      <Route path={path}>
        <Redirect to="/auth" />
      </Route>
    );
  }

  return <Component />;
}
