const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform",
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

  try {
    // Read the incoming body and content-type to forward as-is
    const contentType = req.headers.get("content-type") || "";
    const body = await req.arrayBuffer();

    const headers: Record<string, string> = {
      Authorization: basicAuth,
    };

    // Preserve content-type so n8n can parse FormData or JSON
    if (contentType) {
      headers["Content-Type"] = contentType;
    }

    const webhookResponse = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers,
      body,
    });

    const responseBody = await webhookResponse.text();

    // Try to parse as JSON, otherwise return as text
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
    console.error("Error proxying to n8n webhook:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
