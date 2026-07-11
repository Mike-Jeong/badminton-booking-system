import { LanguageProvider } from "@/lib/i18n/LanguageContext";
import { PublicHeader } from "@/components/public/PublicHeader";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <LanguageProvider>
      <div className="min-h-screen">
        <PublicHeader />
        <main className="container py-8">{children}</main>
      </div>
    </LanguageProvider>
  );
}
