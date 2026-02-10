"use client";

/**
 * Wrapper that makes tables horizontally scrollable on mobile (#50).
 */
export function ResponsiveTable({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0 ${className ?? ""}`}
    >
      <div className="min-w-[640px]">{children}</div>
    </div>
  );
}
