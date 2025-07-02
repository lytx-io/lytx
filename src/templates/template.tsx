import { html } from "hono/html";

export interface SiteData {
  children?: any;
  head?: { title: string };
  includeHTMX?: boolean;
}
export const AppScript = (props: { data: string }) => html`
<script type="module">
import {startApp} from "./js/app.js";
await startApp(${props.data});
</script>   
`;

export const Layout = (props: SiteData) => html`<!DOCTYPE html>
  <html>
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <link
        rel="apple-touch-icon"
        sizes="180x180"
        href="https://cdn.lytx.io/static%2Fapple-touch-icon.png"
      />
      <link
        rel="icon" 
        type="image/png"
        sizes="32x32"
        href="https://cdn.lytx.io/static%2Ffavicon-32x32.png"
      />
      <link
        rel="icon"
        type="image/png"
        sizes="16x16"
        href="https://cdn.lytx.io/static%2Ffavicon-16x16.png"
      />
     
      <link rel="manifest" href="https://cdn.lytx.io/static%2Fsite.webmanifest" />
      <link rel="mask-icon" href="https://cdn.lytx.io/static%2Fsafari-pinned-tab.svg" color="#5bbad5" />
      <meta name="msapplication-TileColor" content="#da532c" />
      <meta name="theme-color" content="#ffffff" />
      <title>
        ${props.head && props.head.title ? props.head.title : "Lytx"}
      </title>
     
    </head>
    <body>
      ${props.children}    
    </body> 
  </html> `; 
