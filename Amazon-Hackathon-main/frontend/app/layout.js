import './globals.css';

export const metadata = { title: 'Anchor AI | Inventory Intelligence', description: 'AI-powered inventory command center for Amazon sellers' };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
