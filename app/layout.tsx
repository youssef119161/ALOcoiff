import type { Metadata } from "next";
import "./globals.css";
import { BookingProvider } from "./context/BookingContext";
import { AuthProvider } from "./context/AuthContext";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { SupabaseStatus } from "./components/SupabaseStatus";

export const metadata: Metadata = {
  title: "RAED COIF - Réservation",
  description: "Système de réservation élégant",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body>
        <ErrorBoundary>
          <AuthProvider>
            <BookingProvider>
              {children}
              <SupabaseStatus />
            </BookingProvider>
          </AuthProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
