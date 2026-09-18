import { LanguageProvider } from "@/lib/i18n/LanguageContext";
import { PublicHeader } from "@/components/public/PublicHeader";
import { KakaoInAppBanner } from "@/components/public/KakaoInAppBanner";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <LanguageProvider>
      <div className="min-h-screen">
        <PublicHeader />
        <KakaoInAppBanner />
        <main className="container py-8">{children}</main>
      </div>
    </LanguageProvider>
  );
}
