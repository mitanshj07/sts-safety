import { createClient } from "@/lib/supabase/server";

import { homePathForRole, type UserRole } from "./roles";

const SEEDED_DEMO_EMAIL = /@demo\.sts$/i;

export async function touristHasIssuedId(profileId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data: tourist } = await supabase
    .from("tourists")
    .select("id")
    .eq("profile_id", profileId)
    .maybeSingle();
  if (!tourist?.id) return false;
  const { data: issued } = await supabase
    .from("digital_ids")
    .select("id")
    .eq("tourist_id", tourist.id)
    .limit(1)
    .maybeSingle();
  return Boolean(issued?.id);
}

export async function postAuthPath(args: {
  role: UserRole;
  profileId: string;
  email?: string | null;
}): Promise<string> {
  if (args.role !== "tourist") return homePathForRole(args.role);
  if (await touristHasIssuedId(args.profileId)) return "/home";
  if (args.email && SEEDED_DEMO_EMAIL.test(args.email)) return "/home";
  return "/onboard";
}
