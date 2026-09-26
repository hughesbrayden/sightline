export const metadata = { title: "Sightline", description: "Jev context-curation harness: live lineage" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#11161C", color: "#E6E8EB", fontFamily: "system-ui, sans-serif" }}>
        {children}
      </body>
    </html>
  );
}
