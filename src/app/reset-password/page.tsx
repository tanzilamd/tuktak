import Link from "next/link";
import {AuthForm} from "@/components/forms";
import {safeNext} from "@/lib/config";
export const metadata={title:"নতুন করে শুরু।",robots:{index:false,follow:false}};
export default async function Page({searchParams}:{searchParams:Promise<{next?:string;error?:string;reset?:string}>}){const p=await searchParams;return <section className="auth-card card"><span className="auth-emoji">☕</span><h1>নতুন করে শুরু।</h1><p className="muted">একটা শক্ত, আলাদা password বেছে নাও।</p>{p.error&&<p role="alert" className="danger">লিংকটি মেয়াদোত্তীর্ণ বা সঠিক নয়। আবার চেষ্টা করো।</p>}{p.reset&&<p role="status">Password বদলে গেছে। এবার লগইন করো।</p>}<AuthForm kind="update_password" next={safeNext(p.next)}/><div className="auth-footer"><Link href="/login">লগইন পাতায় যাই ↗</Link></div></section>;}
