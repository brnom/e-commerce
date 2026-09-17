import { Button } from "@/components/ui/button";

import type { ReactNode } from "react";

export function EmptyState({
  title,
  description,
  action,
}: {
  readonly title: string;
  readonly description: string;
  readonly action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed px-6 py-16 text-center">
      <h2 className="display-heading text-2xl">{title}</h2>
      <p className="max-w-sm text-muted-foreground">{description}</p>
      {action}
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  readonly message: string;
  readonly onRetry: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-4 rounded-lg border px-6 py-16 text-center"
    >
      <h2 className="display-heading text-2xl">Something went wrong</h2>
      <p className="text-muted-foreground">{message}</p>
      <Button variant="outline" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}

export function NotFoundState({
  title,
  description,
  action,
}: {
  readonly title: string;
  readonly description: string;
  readonly action: ReactNode;
}) {
  return (
    <div className="flex flex-col items-start gap-4 py-10">
      <p className="font-mono text-xs tracking-wider text-muted-foreground uppercase">404</p>
      <h1 className="display-heading text-4xl sm:text-5xl">{title}</h1>
      <p className="max-w-md text-muted-foreground">{description}</p>
      {action}
    </div>
  );
}
