import {db} from '@/lib/supabase';
export async function GET(){const client=await db();if(!client)return Response.json({status:'unavailable'},{status:503});const {error}=await client.from('profiles').select('id').limit(1);return Response.json({status:error?'unavailable':'ok'},{status:error?503:200,headers:{'Cache-Control':'no-store'}});}
