import Link from "next/link";
import {ArrowUpRight,MessageCircle,Sparkles,Smile} from "lucide-react";
import {feed,viewer} from "@/lib/data";
import {configured} from "@/lib/supabase";
import {BRAND,questionOfDay} from "@/lib/config";
import {Composer} from "@/components/forms";
import {PostCard} from "@/components/post-card";
import {Empty} from "@/components/empty";
export default async function Home({searchParams}:{searchParams:Promise<{feed?:string;before?:string}>}){const params=await searchParams;const v=await viewer();const mode=["following","institution"].includes(params.feed??"")?params.feed:"all";const posts=await feed({mode,before:params.before});const question=questionOfDay();return <>
 <div className="page-top"><div><span className="eyebrow">একটু কথায়, একটু কাছাকাছি</span><h1>আড্ডা <span className="heading-spark" aria-hidden="true">✳</span></h1></div><span className="today">{new Intl.DateTimeFormat("bn-BD",{weekday:"long",month:"long",day:"numeric",timeZone:"Asia/Dhaka"}).format(new Date())}</span></div>
 {!v&&<section className="welcome-card"><span className="eyebrow"><Smile size={14}/> এখানে তোমার মতোই সবাই</span><h2>বড় কথা না হোক,<br/><span>ছোট্ট কিছু বলে ফেলো।</span></h2><p>{BRAND.description}<br/>{BRAND.tagline}</p><div className="welcome-bottom"><Link className="button button-primary" href="/signup">আড্ডায় যোগ দিই<ArrowUpRight size={17}/></Link><span className="welcome-avatars" aria-hidden="true"><i>রা</i><i>মি</i><i>অ</i><span>তোমার জন্যও জায়গা আছে</span></span></div><span className="hero-doodle" aria-hidden="true">✺</span></section>}
 <section className="daily-question"><div className="question-icon"><MessageCircle size={22}/></div><div><span className="eyebrow">আজকের প্রশ্ন <span>· একটু ভাবি?</span></span><h2>{question}</h2></div><Link href={`/compose?prompt=${encodeURIComponent(question+"\n")}`} aria-label="আজকের প্রশ্নের উত্তর দিই">উত্তর দিই <ArrowUpRight size={15}/></Link></section>
 {v&&!v.suspended&&<Composer/>}
 <nav className="feed-tabs" aria-label="আড্ডার ধরন"><Link href="/" className={mode==="all"?"active":""}>সবার <Sparkles size={14}/></Link><Link href={v?"/?feed=following":"/login"} className={mode==="following"?"active":""}>যাদের সাথে আছি</Link>{v?.profile.institution&&<Link href="/?feed=institution" className={mode==="institution"?"active":""}>আমার প্রতিষ্ঠান</Link>}<span>নতুন কথা আগে ↓</span></nav>
 {!configured()&&<p className="sample-note">আড্ডার এক ঝলক · নিচের মানুষ আর গল্পগুলো কাল্পনিক নমুনা।</p>}
 <div className="post-list">{posts.map(post=><PostCard key={post.id} post={post} viewer={v}/>)}{!posts.length&&<Empty href="/compose" label="কিছু একটা বলি"/>}</div>{configured()&&posts.length>=20&&<Link className="button load-more" href={`/?feed=${mode}&before=${encodeURIComponent(posts.at(-1)!.created_at)}`}>আরও কিছু কথা ↓</Link>}
 <p className="feed-end">✦ এইটুকুই আপাতত। এবার একটু চা হোক?</p></>;}
