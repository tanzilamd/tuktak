"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Compass,
  PenLine,
  Bell,
  UserRound,
  Settings,
  Shield,
} from "lucide-react";
import { useNotificationCount } from "./notification-count";
import { notificationLabel, unreadLabel } from "@/lib/notifications";
import { BRAND, loginHref } from "@/lib/config";
import { Avatar } from "./avatar";
import type { Viewer } from "@/lib/types";
const nav = [
  { href: "/", label: "আড্ডা", Icon: Home },
  { href: "/discover", label: "খুঁজে দেখি", Icon: Compass },
  { href: "/compose", label: "বলি", Icon: PenLine },
  { href: "/notifications", label: "খবর", Icon: Bell },
];
export function Navigation({ viewer }: { viewer: Viewer | null }) {
  const path = usePathname();
  const { count } = useNotificationCount();
  const items = [
    ...nav,
    {
      href: viewer ? `/u/${viewer.profile.username}` : "/login",
      label: "আমি",
      Icon: UserRound,
    },
  ];
  return (
    <>
      <aside className="sidebar" aria-label="আড্ডার নেভিগেশন">
        <Link className="brand" href="/" aria-label={`${BRAND.name} — আড্ডা`}>
          <span className="brand-mark">{Array.from(BRAND.name)[0]}</span>
          {BRAND.name}
          <span className="brand-dot">✦</span>
        </Link>
        <p className="brand-tagline">কথা জমাইও না।</p>
        <div className="sidebar-middle">
          <nav aria-label="প্রধান নেভিগেশন" className="desktop-nav">
            {nav
              .filter((item) => item.href !== "/compose")
              .map(({ href, label, Icon }) => (
                <Link
                  key={label}
                  className={`nav-item ${path === href ? "active" : ""}`}
                  href={href}
                  aria-label={
                    href === "/notifications"
                      ? notificationLabel(count)
                      : undefined
                  }
                  aria-current={path === href ? "page" : undefined}
                >
                  <span className="nav-icon">
                    <Icon size={21} />
                    {href === "/notifications" && count > 0 && (
                      <span className="notification-badge" aria-hidden="true">
                        {unreadLabel(count)}
                      </span>
                    )}
                  </span>
                  {label}
                  {path === href && <span className="nav-dot" />}
                </Link>
              ))}
            <Link
              className={`nav-item ${path.startsWith("/settings") ? "active" : ""}`}
              href={viewer ? "/settings" : loginHref("/settings")}
            >
              <Settings size={21} />
              সেটিংস
            </Link>
            {viewer && viewer.role !== "user" && (
              <Link className="nav-item" href="/moderation">
                <Shield size={21} />
                আড্ডা সামলাই
              </Link>
            )}
          </nav>
        </div>
        <Link
          className="button button-primary sidebar-compose"
          href={viewer ? "/compose" : loginHref("/compose")}
        >
          <PenLine size={18} />
          কিছু একটা বলি
        </Link>
        <div className="sidebar-bottom">
          <div className="footer-links">
            <Link href="/community">আড্ডার নিয়ম</Link>
            <Link href="/privacy">গোপনীয়তা</Link>
            <Link href="/terms">ব্যবহারের শর্ত</Link>
          </div>
          <small>বাংলায়, ভালোবাসায়। 🇧🇩</small>
        </div>
      </aside>
      <header className="mobile-header">
        <Link className="brand" href="/">
          <span className="brand-mark">{Array.from(BRAND.name)[0]}</span>
          {BRAND.name}
          <span className="brand-dot">✦</span>
        </Link>
        <Link
          className="mobile-account"
          aria-label={viewer ? "আমার সেটিংস" : "আড্ডায় যোগ দিই"}
          href={viewer ? "/settings" : "/signup"}
        >
          {viewer ? <Avatar profile={viewer.profile} /> : "যোগ দিই ↗"}
        </Link>
      </header>
      <nav className="bottom-nav" aria-label="মোবাইল নেভিগেশন">
        {items.map(({ href, label, Icon }) => (
          <Link
            key={label}
            href={href}
            className={path === href ? "active" : ""}
            aria-label={
              href === "/notifications" ? notificationLabel(count) : undefined
            }
            aria-current={path === href ? "page" : undefined}
          >
            <span className="nav-icon">
              <Icon size={21} />
              {href === "/notifications" && count > 0 && (
                <span className="notification-badge" aria-hidden="true">
                  {unreadLabel(count)}
                </span>
              )}
            </span>
            <span>{label}</span>
          </Link>
        ))}
      </nav>
    </>
  );
}
