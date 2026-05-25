import { AppShell } from "@/components/layout/AppShell";
import { RssPreviewProvider } from "@/components/events/RssPreviewStore";

export default function Home() {
  return (
    <RssPreviewProvider>
      <AppShell />
    </RssPreviewProvider>
  );
}
