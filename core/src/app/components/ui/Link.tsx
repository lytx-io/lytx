"use client";
import type { AnchorHTMLAttributes, ReactNode } from "react";

interface LinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  href: string;
  children: ReactNode;
}

/**
 * A semantic Link component for internal navigation.
 * View transitions are handled globally in client.tsx for all navigation.
 */
export function Link({
  href,
  children,
  ...props
}: LinkProps) {
  return (
    <a href={href} {...props}>
      {children}
    </a>
  );
}
