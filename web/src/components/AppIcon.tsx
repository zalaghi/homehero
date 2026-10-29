import type { SVGProps } from "react";

export type IconName = "home" | "calendar" | "wallet" | "tasks" | "basket" | "users" | "camera" | "arrow" | "check" | "menu" | "spark";
const paths: Record<IconName, React.ReactNode> = {
  home: <><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M16 3v4M8 3v4M3 11h18m-13 5 2 2 5-5" /></>,
  wallet: <><path d="M20 8V6a2 2 0 0 0-2-2H5a3 3 0 0 0 0 6h16v10H5a3 3 0 0 1-3-3V7m19 6h-5v4h5" /><path d="M17 15h.01" /></>,
  tasks: <><rect x="5" y="4" width="15" height="18" rx="3" /><path d="M9 4V2h7v2M8 11l2 2 3-3m2 2h2M8 17h9" /></>,
  basket: <><path d="m8 3-4 7m12-7 4 7M2 10h20l-2 10H4ZM9 14v3m6-3v3" /></>,
  users: <><circle cx="9" cy="7" r="3" /><path d="M3 21v-3a6 6 0 0 1 12 0v3m2-18a4 4 0 0 1 0 8m4 10v-3a6 6 0 0 0-3-5" /></>,
  camera: <><path d="m4 7 2-3h12l2 3h1v14H3V7Z" /><circle cx="12" cy="13" r="4" /></>,
  arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
  check: <path d="m5 12 4 4L19 6" />,
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  spark: <><path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z" /></>,
};
export default function AppIcon({ name, ...props }: SVGProps<SVGSVGElement> & { name: IconName }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name]}</svg>;
}
