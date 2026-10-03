"use client";
import {useSyncExternalStore} from "react";
const subscribe=(callback:()=>void)=>{window.addEventListener("tuktak-theme",callback);return ()=>window.removeEventListener("tuktak-theme",callback);};
function apply(value:string){localStorage.setItem("tuktak-theme",value);document.documentElement.dataset.theme=value==="system"?(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):value;window.dispatchEvent(new Event("tuktak-theme"));}
export function ThemePicker(){const theme=useSyncExternalStore(subscribe,()=>localStorage.getItem("tuktak-theme")??"system",()=>"system");return <div className="theme-picker" role="group" aria-label="দেখতে কেমন হবে">{["light","dark","system"].map((t,i)=><button key={t} className={`chip ${theme===t?"selected":""}`} aria-pressed={theme===t} onClick={()=>apply(t)}>{["☀️ আলো","🌙 অন্ধকার","◐ সিস্টেম"][i]}</button>)}</div>;}
