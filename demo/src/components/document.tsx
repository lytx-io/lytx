import type { ReactNode } from "react";
import styles from "lytx/styles.css?url";
import { IS_DEV } from "rwsdk/constants";

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

        {!IS_DEV && <script src="https://demo.lytx.io/lytx.js?account=f6nexy5nspoayffsbw8te4bo"></script>}
      </body>
    </html>
  );
}
