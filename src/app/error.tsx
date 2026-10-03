"use client";
export default function ErrorPage({reset}:{reset:()=>void}){return <section className="empty card"><span className="empty-emoji">🫠</span><h1>আড্ডায় একটু জট লেগেছে।</h1><p>আবার চেষ্টা করো। তোমার ব্যক্তিগত তথ্য এখানে দেখানো হবে না।</p><button className="button button-primary" onClick={reset}>আবার দেখি</button></section>;}
