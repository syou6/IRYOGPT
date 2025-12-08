import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <link rel="icon" href="/icons/chat-icon.png" type="image/png" />
        <link rel="shortcut icon" href="/icons/chat-icon.png" type="image/png" />
        <link rel="apple-touch-icon" href="/icons/chat-icon.png" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
