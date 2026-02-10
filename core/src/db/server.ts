import { createClient } from "@supabase/supabase-js";
import {Database} from "../types/supabase";
import { Database as EU_DB } from "../types/supabaseEU";


export function initSupabase(SUPABASE_URL : string, SUPABASE_KEY:string){
    return createClient<Database>(SUPABASE_URL, SUPABASE_KEY);
        /*, {
        //@ts-ignore
        fetch: (...args: any) => fetch(...args),
    });*/
}

export function initEUSupabaseRegion(SUPABASE_URL : string, SUPABASE_KEY:string){
    return createClient<EU_DB>(SUPABASE_URL, SUPABASE_KEY);
}
