import { createClerkClient, verifyToken } from "@clerk/nextjs/server";

type AutoApprovalRequest = {
  role?: "agent" | "operator";
  agentId?: string | null;
};

export async function POST(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const clerkSecretKey = process.env.CLERK_SECRET_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const approvalSecret = process.env.ACCESS_AUTO_APPROVE_SECRET;

  if (!token || !clerkSecretKey) {
    return Response.json({ error: "Authentication is required." }, { status: 401 });
  }
  if (!supabaseUrl || !supabaseKey || !approvalSecret) {
    return Response.json({ error: "Automatic approval is not configured." }, { status: 503 });
  }

  try {
    const claims = await verifyToken(token, { secretKey: clerkSecretKey });
    const userId = claims.sub;
    if (!userId) return Response.json({ error: "Authentication is required." }, { status: 401 });

    const body = await request.json() as AutoApprovalRequest;
    if (body.role !== "agent" && body.role !== "operator") {
      return Response.json({ error: "A valid requested role is required." }, { status: 400 });
    }
    if (body.role === "agent" && !body.agentId) {
      return Response.json({ error: "An agent profile is required." }, { status: 400 });
    }

    const clerk = createClerkClient({ secretKey: clerkSecretKey });
    const user = await clerk.users.getUser(userId);
    const primaryEmail = user.primaryEmailAddress;
    const email = primaryEmail?.emailAddress.trim().toLowerCase() || "";
    const domain = email.split("@").at(-1);

    if (!email || primaryEmail?.verification?.status !== "verified") {
      return Response.json({ error: "A verified primary email address is required." }, { status: 403 });
    }
    if (domain !== "linpanrealty.com") {
      return Response.json({ autoApproved: false });
    }

    const approvalResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/auto_approve_company_access`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: supabaseKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        p_role: body.role,
        p_agent_id: body.role === "agent" ? body.agentId : null,
        p_email: email,
        p_secret: approvalSecret,
      }),
    });

    if (!approvalResponse.ok) {
      const details = await approvalResponse.json().catch(() => null) as { message?: string } | null;
      return Response.json({ error: details?.message || "Automatic approval failed." }, { status: 400 });
    }

    return Response.json({ autoApproved: true, role: body.role });
  } catch {
    return Response.json({ error: "Unable to verify this account." }, { status: 401 });
  }
}
