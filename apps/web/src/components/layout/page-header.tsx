import type { ReactNode } from "react";

interface Props {
  readonly title: string;
  readonly eyebrow?: ReactNode;
  readonly actions?: ReactNode;
  readonly children?: ReactNode;
}

export function PageHeader({ title, eyebrow, actions, children }: Props) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && (
          <p className="mb-2 font-mono text-xs tracking-wider text-muted-foreground uppercase">
            {eyebrow}
          </p>
        )}
        <h1 className="display-heading text-4xl sm:text-5xl">{title}</h1>
        {children}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
