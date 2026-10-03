import type {Profile,Post} from "./types";
const people=[
 ["rafi","রাফি আহমেদ","বিশ্ববিদ্যালয়ে পড়ি","মেঘলা বিশ্ববিদ্যালয়","mint",["গান","ফুটবল"],"বৃষ্টি, চা আর একটু গান।","😌"],
 ["mithi","মিথি রহমান","কলেজে পড়ি","শিউলি কলেজ","berry",["বই","মিম"],"গল্পের বইয়ে হারিয়ে যাই।","🌷"],
 ["ayon","অয়ন","ভর্তি প্রস্তুতি নিচ্ছি",null,"sky",["গেমিং","ক্রিকেট"],"মাঝে মাঝে ভাবি। বেশিরভাগ সময় খাই।","🎮"],
 ["tisha","তিশা","গ্যাপ ইয়ার",null,"mango",["আঁকাআঁকি","সিনেমা"],"নিজের গতিতে, নিজের পথে।","🍃"],
 ["niloy","নিলয়","স্কুলে পড়ি","কদম স্কুল","mint",["ফুটবল","প্রযুক্তি"],"ফুটবলে মন, আড্ডায় প্রাণ।","⚽"],
 ["samia","সামিয়া","বর্তমানে পড়াশোনা করছি না",null,"berry",["রান্না","গান"],"ছোট ছোট আনন্দ জমাই।","✨"]
] as const;
export const demoProfiles:Profile[]=people.map((p,i)=>({id:`00000000-0000-4000-8000-${String(i+1).padStart(12,"0")}`,username:p[0],display_name:p[1],education:p[2],institution:p[3],accent:p[4],hobbies:[...p[5]],bio:p[6],status:p[7],class_year:"",ssc_batch:"",hsc_batch:"",discoverable:true,created_at:"2026-10-01T00:00:00Z"}));
const bodies=[
 "রিকশায় বসে বাতাস খাওয়ার মধ্যে unnecessarily main character vibe আছে। 🍃 #Random",
 "আজকে alarm আমাকে ৩ বার ডাকছে। আমি ৩ বারই relationship reject করছি। 😂",
 "বাসায় বলছিলাম ১০ মিনিট ফোন দেখব। ফোন বলল দুই ঘণ্টা। #মিম",
 "সবাই কোথাও পৌঁছাচ্ছে। আমি আজকে নিজের জন্য এক কাপ চা বানাইছি। এটাও একটা win। ☕",
 "মাঠের শেষ গোলটা আমার। বাকিটা ইতিহাস। ⚽ #Football",
 "বৃষ্টির দিনে খিচুড়ির জন্য আমার ভালোবাসাটা একটু বেশি ব্যক্তিগত। 🌧️"
];
export const demoPosts:Post[]=bodies.map((body,i)=>({id:`10000000-0000-4000-8000-${String(i+1).padStart(12,"0")}`,author_id:demoProfiles[i].id,body,mood:["😌 শান্তি","😂 হাসি পাচ্ছে","😭 আর পারি না",null,"🔥 উত্তেজিত","🥹 ইমোশনাল"][i],created_at:new Date(Date.UTC(2026,9,4,9,30-i*25)).toISOString(),profiles:demoProfiles[i],reactions:Array.from({length:7-i},(_,j)=>({user_id:`demo-${j}`,kind:["love","haha","relate","fire"][j%4]})),comments:[]}));
