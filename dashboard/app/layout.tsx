export const metadata = {
  title: "Sightline",
  description: "A frozen model, a harness that evolves how it reads a hurricane's reports. Live demo and recorded run.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@75..125,500..700&family=IBM+Plex+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" />
      </head>
      <body style={{ margin: 0, background: "#f4f5f3", color: "#15191b" }}>{children}</body>
    </html>
  );
}
