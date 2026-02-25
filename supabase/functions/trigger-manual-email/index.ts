const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const WEBHOOK_URL =
  "https://lbhcuracao.app.n8n.cloud/webhook/MANUAL-EMAIL-CREATION";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const username = Deno.env.get("N8N_BASIC_AUTH_USER");
  const password = Deno.env.get("N8N_BASIC_AUTH_PASSWORD");

  if (!username || !password) {
    console.error("N8N_BASIC_AUTH credentials not configured");
    return new Response(
      JSON.stringify({ error: "Server configuration error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const basicAuth = `Basic ${btoa(`${username}:${password}`)}`;

  console.log("[trigger-manual-email] Forwarding request to n8n webhook:", WEBHOOK_URL);
  console.log("[trigger-manual-email] Basic Auth user:", username);

  try {
    const contentType = req.headers.get("content-type") || "";
    const body = await req.arrayBuffer();

    console.log("[trigger-manual-email] Request content-type:", contentType);
    console.log("[trigger-manual-email] Request body size:", body.byteLength, "bytes");

    const headers: Record<string, string> = {
      Authorization: basicAuth,
    };

    if (contentType) {
      headers["Content-Type"] = contentType;
    }

    const webhookResponse = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers,
      body,
    });

    const responseBody = await webhookResponse.text();

    console.log("[trigger-manual-email] n8n response status:", webhookResponse.status);
    console.log("[trigger-manual-email] n8n response headers:", JSON.stringify(Object.fromEntries(webhookResponse.headers.entries())));
    console.log("[trigger-manual-email] n8n response body:", responseBody.substring(0, 2000));

    let parsedBody: unknown;
    try {
      parsedBody = JSON.parse(responseBody);
    } catch {
      parsedBody = { raw: responseBody };
    }

    return new Response(
      JSON.stringify({ upstream_status: webhookResponse.status, data: parsedBody }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[trigger-manual-email] Error proxying to n8n webhook:", error);
    console.error("[trigger-manual-email] Error name:", error?.name);
    console.error("[trigger-manual-email] Error message:", error?.message);
    console.error("[trigger-manual-email] Error stack:", error?.stack);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
