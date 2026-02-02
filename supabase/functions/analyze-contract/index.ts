import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { pdfText } = await req.json();

    if (!pdfText || pdfText.trim().length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "Texto do PDF é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

const systemPrompt = `Você é um especialista jurídico altamente qualificado em análise de contratos brasileiros. Sua tarefa é analisar minuciosamente o texto do contrato e extrair TODAS as informações relevantes.

INSTRUÇÕES DETALHADAS:

1. TÍTULO DO CONTRATO:
   - Identifique o tipo exato do contrato (Prestação de Serviços, Locação, Compra e Venda, Trabalho, Sociedade, etc.)
   - Se houver um título explícito no documento, use-o
   - Caso contrário, crie um título apropriado baseado no conteúdo

2. DESCRIÇÃO:
   - Resuma o objeto principal do contrato
   - Mencione as partes envolvidas e suas funções
   - Inclua valores, prazos ou condições principais se identificados
   - Seja conciso mas informativo (3-4 frases)

3. SIGNATÁRIOS/PARTES:
   - Identifique TODAS as partes mencionadas no contrato
   - Procure por: CONTRATANTE, CONTRATADO, LOCADOR, LOCATÁRIO, VENDEDOR, COMPRADOR, CEDENTE, CESSIONÁRIO, OUTORGANTE, OUTORGADO, etc.
   - Extraia o nome completo de cada parte (pessoa física ou jurídica)
   - Se for pessoa jurídica, inclua também o representante legal se mencionado
   - Procure por testemunhas que também precisam assinar

4. FORMATO DE RESPOSTA (JSON estrito):
{
  "title": "Título completo e descritivo do contrato",
  "description": "Descrição detalhada do objeto, partes, valores e condições principais",
  "signatories": [
    { "name": "Nome completo do primeiro signatário", "email": "" },
    { "name": "Nome completo do segundo signatário", "email": "" }
  ]
}

REGRAS IMPORTANTES:
- Retorne APENAS o JSON válido, sem markdown, sem explicações adicionais
- Não invente informações - extraia apenas o que está no documento
- Se um nome não estiver claro, use a designação da parte (ex: "CONTRATANTE" ou "LOCADOR")
- Inclua todas as partes que precisam assinar o documento
- Emails ficam vazios pois geralmente não constam no corpo do contrato`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Analise este contrato e extraia as informações:\n\n${pdfText.substring(0, 15000)}` }
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: "Limite de requisições excedido, tente novamente mais tarde." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ success: false, error: "Créditos insuficientes. Adicione créditos na sua conta." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(
        JSON.stringify({ success: false, error: "Erro ao analisar contrato" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content || "";

    // Parse the JSON from the AI response
    let extracted;
    try {
      // Try to extract JSON from the response (it might be wrapped in markdown)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        extracted = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (parseError) {
      console.error("Failed to parse AI response:", content);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Não foi possível extrair informações do contrato" 
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, data: extracted }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error analyzing contract:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
