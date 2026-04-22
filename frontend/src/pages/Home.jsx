import { useEffect } from "react";
import SiteHeader from "@/components/SiteHeader";
import Hero from "@/components/Hero";
import LoreSection from "@/components/LoreSection";
import RosterSection from "@/components/RosterSection";
import ApplicationForm from "@/components/ApplicationForm";
import DiscordCTA from "@/components/DiscordCTA";
import SiteFooter from "@/components/SiteFooter";
import api from "@/lib/api";

export default function Home() {
  useEffect(() => {
    // track visit (fire and forget)
    api.post("/visits", {
      path: window.location.pathname,
      user_agent: navigator.userAgent,
      referer: document.referrer || "",
    }).catch(() => {});
  }, []);

  return (
    <div data-testid="home-page" className="min-h-screen bg-[#050505]">
      <SiteHeader />
      <main>
        <Hero />
        <LoreSection />
        <RosterSection />
        <ApplicationForm />
        <DiscordCTA />
      </main>
      <SiteFooter />
    </div>
  );
}
