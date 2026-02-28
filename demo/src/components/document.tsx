import type { ReactNode } from "react";
import styles from "lytx/styles.css?url";

export function Document({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="stylesheet" href={styles} />
        <link rel="modulepreload" href="/src/client.tsx" />
      </head>
      <body className="overflow-x-hidden">
        {children}
        <script>import("/src/client.tsx")</script>
      </body>
    </html>
  );
}
