import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Get IP from headers (Supabase/Cloudflare forwards the real IP)
    const forwardedFor = req.headers.get("x-forwarded-for");
    const realIp = req.headers.get("x-real-ip");
    const cfConnectingIp = req.headers.get("cf-connecting-ip");
    
    // Priority: cf-connecting-ip > x-forwarded-for (first IP) > x-real-ip
    let clientIp = cfConnectingIp 
      || (forwardedFor ? forwardedFor.split(",")[0].trim() : null)
      || realIp
      || "unknown";

    // Get additional client info from headers
    const userAgent = req.headers.get("user-agent") || "unknown";
    const acceptLanguage = req.headers.get("accept-language") || "unknown";
    
    // Get country/region from Cloudflare headers if available
    const country = req.headers.get("cf-ipcountry") || null;
    const city = req.headers.get("cf-ipcity") || null;
    const region = req.headers.get("cf-region") || null;

    const clientInfo = {
      ip_address: clientIp,
      user_agent: userAgent,
      accept_language: acceptLanguage,
      geolocation: country ? {
        country,
        city,
        region,
      } : null,
      timestamp: new Date().toISOString(),
    };

    console.log("Client info captured:", { ip: clientIp, country });

    return new Response(
      JSON.stringify(clientInfo),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  } catch (error: any) {
    console.error("Error in get-client-info function:", error);
    return new Response(
      JSON.stringify({ error: error.message, ip_address: "unknown" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
