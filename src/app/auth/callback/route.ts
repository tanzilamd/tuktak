import {NextResponse,type NextRequest} from "next/server";
import {db} from "@/lib/supabase";
import {safeNext} from "@/lib/config";
export async function GET(request:NextRequest){const url=new URL(request.url);const code=url.searchParams.get("code");const client=await db();if(code&&client){const {error}=await client.auth.exchangeCodeForSession(code);if(!error)return NextResponse.redirect(new URL(safeNext(url.searchParams.get("next")),url.origin));}return NextResponse.redirect(new URL("/login?error=verification",url.origin));}
