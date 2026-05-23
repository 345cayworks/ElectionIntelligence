import clsx from "clsx";

export function Card({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={clsx(
        "rounded-lg border border-gray-200 bg-white shadow-sm",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  description,
  actions,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={clsx(
        "flex flex-col gap-2 border-b border-gray-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div>
        <div className="text-sm font-semibold text-gray-900">{title}</div>
        {description ? (
          <div className="mt-0.5 text-xs text-gray-500">{description}</div>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function CardBody({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={clsx("p-4", className)}>{children}</div>;
}

export function StatCard({
  label,
  value,
  hint,
  accent,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  hint?: React.ReactNode;
  accent?: "green" | "yellow" | "red" | "blue" | "gray";
}) {
  const accentClass: Record<NonNullable<typeof accent>, string> = {
    green: "border-l-4 border-green-500",
    yellow: "border-l-4 border-yellow-500",
    red: "border-l-4 border-red-500",
    blue: "border-l-4 border-blue-500",
    gray: "border-l-4 border-gray-300",
  };
  return (
    <Card
      className={clsx("p-4", accent ? accentClass[accent] : "border-l-4 border-blue-500")}
    >
      <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-gray-900">{value}</div>
      {hint ? <div className="mt-1 text-xs text-gray-500">{hint}</div> : null}
    </Card>
  );
}
