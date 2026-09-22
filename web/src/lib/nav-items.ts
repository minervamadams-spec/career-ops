import { LayoutDashboard, Compass, Send, Radar, BarChart3, FileText, Settings } from "lucide-react";
import type { ComponentType, SVGProps } from "react";

// Single source of truth for the app's primary destinations — shared by the
// desktop sidebar and the mobile nav so they can never drift.
export type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  chip?: string;
};

// Pipeline (raw manual-browse list) and Top Leads (ranked scored-role table)
// both removed 2026-09-22 (Minerva: "this page should go away" / "remove
// this page, use what is yielded in today areas") — Today's uncapped,
// score-filtered decision list absorbed Top Leads' job; the automated,
// time-windowed "Fresh matches" already did Pipeline's discovery job without
// a second manual-browse surface. The underlying routes (/pipeline/[id],
// /pipeline/add, /pipeline/inbox) still exist as direct-link destinations —
// only the list pages and their nav entries are gone.
export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Today", icon: LayoutDashboard },
  { href: "/explore", label: "Explore", icon: Compass, chip: "New" },
  { href: "/followups", label: "Follow-ups", icon: Send },
  { href: "/portals", label: "Portals", icon: Radar },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/cv", label: "CV", icon: FileText },
  { href: "/config", label: "Config", icon: Settings },
];

export function isActivePath(href: string, pathname: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}
