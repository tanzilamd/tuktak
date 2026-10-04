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
  ArrowUpRight,
} from "lucide-react";
import { BRAND } from "@/lib/config";
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
      <aside className="sidebar">
        <Link className="brand" href="/" aria-label={`${BRAND.name} — আড্ডা`}>
          <span className="brand-mark">{Array.from(BRAND.name)[0]}</span>
          {BRAND.name}
          <span className="brand-dot">✦</span>
        </Link>
        <p className="brand-tagline">কথা জমাইও না।</p>
        <nav aria-label="প্রধান নেভিগেশন" className="desktop-nav">
          {items.map(({ href, label, Icon }) => (
            <Link
              key={label}
              className={`nav-item ${path === href ? "active" : ""}`}
              href={href}
              aria-current={path === href ? "page" : undefined}
            >
              <Icon size={21} />
              {label}
              {path === href && <span className="nav-dot" />}
            </Link>
          ))}
          {viewer && (
            <Link
              className={`nav-item ${path.startsWith("/settings") ? "active" : ""}`}
              href="/settings"
            >
              <Settings size={21} />
              সেটিংস
            </Link>
          )}
          {viewer && viewer.role !== "user" && (
            <Link className="nav-item" href="/moderation">
              <Shield size={21} />
              আড্ডা সামলাই
            </Link>
          )}
        </nav>
        <Link
          className="button button-primary sidebar-compose"
          href={viewer ? "/compose" : "/signup"}
        >
          <PenLine size={18} />
          {viewer ? "কিছু একটা বলি" : "আড্ডায় যোগ দিই"}
        </Link>
        <div className="sidebar-bottom">
          {viewer ? (
            <Link
              className="mini-profile"
              href={`/u/${viewer.profile.username}`}
            >
              <Avatar profile={viewer.profile} />
              <span>
                <b>{viewer.profile.display_name}</b>
                <small>@{viewer.profile.username}</small>
              </span>
              <ArrowUpRight size={17} />
            </Link>
          ) : (
            <p>
              তোমার কথারও জায়গা আছে।
              <br />
              <Link href="/login">আগেই আছ? ঢুকে পড়ো ↗</Link>
            </p>
          )}
          <div className="footer-links">
            <Link href="/community">আড্ডার নিয়ম</Link>
            <Link href="/privacy">গোপনীয়তা</Link>
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
            aria-current={path === href ? "page" : undefined}
          >
            <Icon size={21} />
            <span>{label}</span>
          </Link>
        ))}
      </nav>
    </>
  );
}
