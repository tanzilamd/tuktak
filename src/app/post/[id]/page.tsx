import {notFound} from "next/navigation";
import Link from "next/link";
import {getPost,viewer,comments} from "@/lib/data";
import {PostCard} from "@/components/post-card";
import {Composer,Mutation} from "@/components/forms";
import {Avatar} from "@/components/avatar";
import {RichText} from "@/components/rich-text";
import {bn} from "@/lib/config";
import {z} from "zod";
export async function generateMetadata({params}:{params:Promise<{id:string}>}){const {id}=await params;if(!z.string().uuid().safeParse(id).success)return {title:"পোস্ট পাওয়া যায়নি"};const p=await getPost(id);return {title:p?`${p.profiles.display_name}-এর কথা`:"পোস্ট পাওয়া যায়নি",description:p?.body};}
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;if(!z.string().uuid().safeParse(id).success)notFound();const p=await getPost(id);if(!p)notFound();const [v,replies]=await Promise.all([viewer(),comments(id)]);return <><div className="page-top"><div><Link className="eyebrow" href="/">← আড্ডায় ফিরে যাই</Link><h1>কথায় কথায় 💬</h1></div></div><PostCard post={p} viewer={v} detail/><section className="card content-card reply-section"><h2>{bn(replies.length)}টা উত্তর</h2>{v?<Composer replyTo={id}/>:<p className="muted"><Link href="/login">লগইন করো</Link>, তারপর কথা হবে।</p>}{!replies.length&&<p className="reply-empty">সবাই চুপ। প্রথম কথাটা তুমি বলবে?</p>}{replies.map(c=><article key={c.id} className="comment"><Link className="post-person" href={`/u/${c.profiles.username}`}><Avatar profile={c.profiles}/><span><b>{c.profiles.display_name}</b><small>@{c.profiles.username}</small></span></Link><p className="post-body"><RichText text={c.body}/></p>{v&&(v.id===c.author_id?<Mutation action="delete_comment" values={{id:c.id}} label="মুছে দিই" confirm="এই উত্তর মুছে দেবে?"/>:<Link className="small muted" href={`/report?type=comment&id=${c.id}`}>রিপোর্ট করি</Link>)}</article>)}</section></>;}
