import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

// عميل بصلاحيات كاملة (service role) — يُستخدم فقط داخل server actions/route handlers
// لعمليات إدارية حساسة مثل إنشاء حسابات الطلاب. لا يُستورد أبداً في كود المتصفح.
export function createAdminClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
