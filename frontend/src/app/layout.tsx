import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'CA Deal Engine',
  description: 'California Off-Market Real Estate Deal Engine',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
      </head>
      <body className="bg-gray-50">{children}</body>
    </html>
  );
}
