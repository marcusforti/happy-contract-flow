import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface GenerateEmailRequest {
  pdfText: string;
  contractTitle: string;
  senderName: string;
  signatoryName: string;
  expiresAt?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { pdfText, contractTitle, senderName, signatoryName, expiresAt }: GenerateEmailRequest = await req.json();

    if (!pdfText || !contractTitle || !senderName || !signatoryName) {
      throw new Error("Campos obrigatórios faltando");
    }

    console.log(`Generating email body for contract: ${contractTitle}, signatory: ${signatoryName}`);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY não configurada");
    }

    // Truncate PDF text to avoid token limits (max ~3000 chars for context)
    const truncatedPdfText = pdfText.length > 3000 ? pdfText.substring(0, 3000) + "..." : pdfText;

    const systemPrompt = `Você é um assistente jurídico da Regozoni Docs, plataforma oficial de assinatura eletrônica do Dr. Sidney Regozoni. 
Sua tarefa é criar um corpo de email profissional, formal e assertivo para solicitar assinatura de contrato.

Instruções RIGOROSAS:
1. Apresente a Regozoni Docs como plataforma oficial de assessoria jurídica
2. Mencione que atua em nome do cliente/remetente
3. Resuma brevemente o objeto/propósito do contrato baseado no conteúdo fornecido
4. Seja formal, acolhedor mas com presença e autoridade
5. Transmita profissionalismo e confiança
6. Máximo 150 palavras
7. NÃO inclua saudação inicial (será adicionada automaticamente)
8. NÃO inclua saudação final ou assinatura (será adicionada automaticamente)
9. NÃO inclua o link de assinatura (será adicionado pelo sistema)
10. Escreva em português brasileiro formal
11. O texto será inserido em um email HTML elegante, então foque apenas no corpo da mensagem`;

    const userPrompt = `Crie o corpo do email para solicitar assinatura do seguinte contrato:

**Plataforma:** Regozoni Docs (Dr. Sidney Regozoni)
**Cliente/Remetente:** ${senderName}
**Signatário:** ${signatoryName}
**Título do Contrato:** ${contractTitle}
${expiresAt ? `**Prazo para assinatura:** ${expiresAt}` : ""}

**Conteúdo do Contrato (resumo):**
${truncatedPdfText}

Gere um texto profissional e assertivo que transmita a autoridade da Regozoni Docs atuando em nome do cliente.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 500,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes para IA." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("Erro ao gerar corpo do email com IA");
    }

    const data = await response.json();
    const generatedBody = data.choices?.[0]?.message?.content?.trim();

    if (!generatedBody) {
      throw new Error("IA não retornou conteúdo válido");
    }

    console.log("Email body generated successfully");

    return new Response(JSON.stringify({ success: true, body: generatedBody }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: unknown) {
    console.error("Error generating email body:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
