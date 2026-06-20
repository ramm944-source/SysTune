/**
 * Cloud Edge Worker 2: systune-admin-worker.js (The Operations Dashboard CRM)
 * Shares unified KV Namespace 'SYSTUNE_STORE'
 * Authenticated via JWT Gatekeeper.
 */

// --- Lightweight JWT & Crypto Utilities ---
function base64urlEncode(str) {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) { str += '='; }
  return atob(str);
}

async function signJWT(payload, secret) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = base64urlEncode(JSON.stringify(header));
  const encodedPayload = base64urlEncode(JSON.stringify(payload));
  const data = new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`);

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, data);
  const encodedSignature = base64urlEncode(String.fromCharCode(...new Uint8Array(signature)));
  return `${encodedHeader}.${encodedPayload}.${encodedSignature}`;
}

async function verifyJWT(token, secret) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const [encodedHeader, encodedPayload, encodedSignature] = parts;
    const data = new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`);
    
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const signatureBytes = Uint8Array.from(atob(encodedSignature.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
    const isValid = await crypto.subtle.verify('HMAC', key, signatureBytes, data);
    
    if (!isValid) return null;
    const payload = JSON.parse(base64urlDecode(encodedPayload));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch (err) {
    return null;
  }
}

async function hashPassword(password) {
  const data = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    
    const allowedOrigins = [
      "https://admin.systune.com", 
      "https://admin.systunes.com",
      "https://systune-dashboard.vercel.app",
      "http://localhost:3000"
    ];
    const incomingOrigin = request.headers.get("Origin") || "";
    const corsOrigin = allowedOrigins.includes(incomingOrigin) ? incomingOrigin : "null";

    const corsHeaders = {
      "Access-Control-Allow-Origin": corsOrigin,
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Credentials": "true"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    const JWT_SECRET = env.ADMIN_SECRET_KEY;
    if (!JWT_SECRET) {
      return new Response(JSON.stringify({ error: "Server Configuration Error: ADMIN_SECRET_KEY is missing." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // PATHROUTE: /api/admin/logout - Revoke JWT and Clear Cookie
    if (path === "/api/admin/logout" && request.method === "POST") {
      try {
        let token = null;
        const cookieHeader = request.headers.get("Cookie") || "";
        const cookieMatch = cookieHeader.match(/(?:^|; )__Secure-AdminToken=([^;]+)/);
        if (cookieMatch) {
          token = cookieMatch[1];
        }
        if (!token) {
          const authHeader = request.headers.get("Authorization") || "";
          const authMatch = authHeader.match(/^Bearer (.+)$/);
          if (authMatch) {
            token = authMatch[1];
          }
        }

        const cookieDeleteHeader = `__Secure-AdminToken=; HttpOnly; Secure; SameSite=Strict; Path=/api/admin; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;

        if (token) {
          const decoded = await verifyJWT(token, JWT_SECRET);
          if (decoded && decoded.exp) {
            const ttl = decoded.exp - Math.floor(Date.now() / 1000);
            if (ttl > 0) {
              await env.SYSTUNE_STORE.put("BLACKLIST_TOKEN_" + token, "revoked", { expiration: decoded.exp });
            }
          }
        }

        return new Response(JSON.stringify({ status: "success" }), {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
            "Set-Cookie": cookieDeleteHeader
          }
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: "Logout failed: " + err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // PATHROUTE: /api/admin/auth - Issue JWT
    if (path === "/api/admin/auth" && request.method === "POST") {
      try {
        const expectedHash = env.ADMIN_PASSWORD_HASH;
        if (!expectedHash) {
          return new Response(JSON.stringify({ error: "Server Configuration Error: ADMIN_PASSWORD_HASH is missing." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        const { password } = await request.json();
        if (!password) {
          return new Response(JSON.stringify({ error: "Missing password" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        
        const providedHash = await hashPassword(password);

        if (providedHash !== expectedHash) {
          return new Response(JSON.stringify({ error: "Invalid credentials" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        const token = await signJWT({ role: "admin", exp: Math.floor(Date.now() / 1000) + (24 * 3600) }, JWT_SECRET);
        return new Response(JSON.stringify({ status: "success" }), { 
          status: 200, 
          headers: { 
            ...corsHeaders, 
            "Content-Type": "application/json",
            "Set-Cookie": `__Secure-AdminToken=${token}; HttpOnly; Secure; SameSite=Strict; Path=/api/admin; Max-Age=86400`
          } 
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: "Auth error: " + err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // PATHROUTE: /api/client/keys - OTA Key Manifest
    if (path === "/api/client/keys" && request.method === "GET") {
      try {
        const manifestStr = await env.SYSTUNE_STORE.get("KEY_MANIFEST");
        if (!manifestStr) {
          return new Response(JSON.stringify({ error: "Manifest not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        return new Response(manifestStr, { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // --- JWT VERIFICATION MIDDLEWARE ---
    if (path.startsWith("/api/admin/") && path !== "/api/admin/auth" && path !== "/api/admin/logout") {
      let token = null;
      
      // Try from Cookie
      const cookieHeader = request.headers.get("Cookie") || "";
      const cookieMatch = cookieHeader.match(/(?:^|; )__Secure-AdminToken=([^;]+)/);
      if (cookieMatch) {
        token = cookieMatch[1];
      }
      
      // Try from Authorization Header
      if (!token) {
        const authHeader = request.headers.get("Authorization") || "";
        const authMatch = authHeader.match(/^Bearer (.+)$/);
        if (authMatch) {
          token = authMatch[1];
        }
      }
      
      if (!token) {
        return new Response(JSON.stringify({ error: "Unauthorized. Missing JWT Token." }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Check KV Token Blacklist (Revocation Check)
      const isBlacklisted = await env.SYSTUNE_STORE.get("BLACKLIST_TOKEN_" + token);
      if (isBlacklisted) {
        return new Response(JSON.stringify({ error: "Unauthorized. Token has been revoked." }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const decodedPayload = await verifyJWT(token, JWT_SECRET);
      if (!decodedPayload || decodedPayload.role !== "admin") {
        return new Response(JSON.stringify({ error: "Unauthorized. Invalid or expired JWT." }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }
    // --- END MIDDLEWARE ---

    // PATHROUTE 1: /api/admin/bulk-clients - Serving centralized index key
    if (path === "/api/admin/bulk-clients" && request.method === "GET") {
      try {
        const indexStr = await env.SYSTUNE_STORE.get("systune_clients_index");
        let clients = [];
        if (indexStr) {
          try { clients = JSON.parse(indexStr); } catch (e) {}
        }
        if (!Array.isArray(clients)) {
          clients = [];
        }
        return new Response(JSON.stringify({ status: "ok", clients: clients, total: clients.length }), {
          headers: { "Content-Type": "application/json", ...corsHeaders }, status: 200
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: "CRM bulk client retrieval error: " + err.message }), {
          status: 500, headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
    }

    // PATHROUTE 2: /api/admin/push-ad-campaign
    if (path === "/api/admin/push-ad-campaign" && request.method === "POST") {
      try {
        const payload = await request.json();
        const { target_region, ad_text, show_ad, expiry_hours } = payload;
        
        if (!target_region || !ad_text) {
          return new Response(JSON.stringify({ error: "Missing campaign requirements" }), {
            status: 400, headers: { "Content-Type": "application/json", ...corsHeaders }
          });
        }

        let existingCampaign = { regions: {} };
        const campStr = await env.SYSTUNE_STORE.get("GLOBAL_CAMPAIGN");
        if (campStr) {
          try {
            existingCampaign = JSON.parse(campStr);
            if (!existingCampaign.regions) existingCampaign.regions = {};
          } catch(e) {}
        }

        const now = new Date();
        const expiryDate = new Date(now.getTime() + (expiry_hours || 48) * 60 * 60 * 1000);

        existingCampaign.regions[target_region] = {
          show_ad: show_ad || false,
          ad_text: ad_text,
          updated_at: now.toISOString(),
          expires_at: expiryDate.toISOString()
        };

        await env.SYSTUNE_STORE.put("GLOBAL_CAMPAIGN", JSON.stringify(existingCampaign));

        return new Response(JSON.stringify({ status: "success", campaign: existingCampaign.regions[target_region] }), {
          headers: { "Content-Type": "application/json", ...corsHeaders }, status: 200
        });

      } catch (err) {
        return new Response(JSON.stringify({ error: "Ad Campaign configuration failed: " + err.message }), {
          status: 500, headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
    }

    // PATHROUTE 3: /api/admin/pricing-crud
    if (path === "/api/admin/pricing-crud") {
      try {
        if (request.method === "GET") {
          const pricingStr = await env.SYSTUNE_STORE.get("PRICING_CATALOG");
          let pricing = [
            { "id": "starter", "name": "Starter Pack", "price": 399, "tokens": 100, "max_seats": 1, "features": "100 Fixes, Basic Tweaks" },
            { "id": "annual", "name": "Annual Pass", "price": 799, "tokens": 1200, "max_seats": 1, "features": "1200 Fixes, Sentinel Eng" },
            { "id": "enterprise", "name": "Enterprise Grid", "price": 1499, "tokens": 3600, "max_seats": 3, "features": "3600 Fixes, Multi-Seat" }
          ];
          if (pricingStr) {
            try { pricing = JSON.parse(pricingStr); } catch (e) {}
          }
          return new Response(JSON.stringify(pricing), {
            headers: { "Content-Type": "application/json", ...corsHeaders }, status: 200
          });
        }

        if (request.method === "PUT" || request.method === "POST") {
          const pricingArray = await request.json();
          if (!Array.isArray(pricingArray)) {
            return new Response(JSON.stringify({ error: "Pricing updates must be a JSON array" }), {
              status: 400, headers: { "Content-Type": "application/json", ...corsHeaders }
            });
          }

          await env.SYSTUNE_STORE.put("PRICING_CATALOG", JSON.stringify(pricingArray));
          return new Response(JSON.stringify({ status: "success", count: pricingArray.length }), {
            headers: { "Content-Type": "application/json", ...corsHeaders }, status: 200
          });
        }
      } catch (err) {
        return new Response(JSON.stringify({ error: "Pricing update logic failed: " + err.message }), {
          status: 500, headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
    }

    // PATHROUTE 4: /api/admin/generate-blog
    if (path === "/api/admin/generate-blog" && request.method === "POST") {
      try {
        const payload = await request.json();
        const { industry, symptom, os, keyword } = payload;
        
        if (!industry || !symptom || !os || !keyword) {
           return new Response(JSON.stringify({ error: "Missing required GEO parameters" }), { 
             status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } 
           });
        }

        const geminiApiKey = env.GEMINI_API_KEY;
        if (!geminiApiKey) {
           return new Response(JSON.stringify({ error: "GEMINI_API_KEY not configured" }), { 
             status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } 
           });
        }

        const promptText = `
You are an elite Senior Windows Kernel-Level Systems Engineer, Operating Systems Performance Architect, and advanced GEO (Generative Engine Optimization) Specialist.
Write a concise, high-density, and highly authoritative technical article on the topic: '${keyword}'.
Target Matrix:
- Industry: ${industry}
- Symptom: ${symptom}
- OS: ${os}

Return your entire response as a STRICTLY VALID JSON object matching this schema exactly:
{
  "seo_title": "Catchy H1 Title",
  "cover_image_keyword": "A single specific keyword for image search",
  "tldr_box": "A 40-word direct answer summarizing the solution",
  "content_markdown": "The main article in rich Markdown.",
  "new_suggested_keywords": ["long-tail 1", "long-tail 2", "long-tail 3"]
}
`;
        
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`;
        const geminiResponse = await fetch(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: promptText }] }]
          })
        });
        
        if (!geminiResponse.ok) {
           const errText = await geminiResponse.text();
           throw new Error("Gemini API Error: " + errText);
        }
        
        const geminiData = await geminiResponse.json();
        let generatedText = geminiData.candidates[0].content.parts[0].text;
        generatedText = generatedText.replace(/```json/g, "").replace(/```/g, "").trim();
        const generatedJson = JSON.parse(generatedText);

        const draftId = `BLOG_DRAFT_${Date.now()}`;
        
        // KV Eventual Consistency Handling
        // Write to KV in the background using ctx.waitUntil so the edge worker responds immediately
        ctx.waitUntil(env.SYSTUNE_STORE.put(draftId, JSON.stringify(generatedJson)));
        
        // Instantly return the JSON payload to the Headless Web Portal
        return new Response(JSON.stringify({ 
          status: "success", 
          draft_id: draftId, 
          data: generatedJson 
        }), {
          status: 200, headers: { "Content-Type": "application/json", ...corsHeaders }
        });
        
      } catch (err) {
        return new Response(JSON.stringify({ error: "Blog generation failed: " + err.message }), { 
          status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } 
        });
      }
    }

    // PATHROUTE 4.1: /api/admin/generate-text
    if (path === "/api/admin/generate-text" && request.method === "POST") {
      try {
        let geminiApiKey = env.GEMINI_API_KEY;
        let geminiModel = env.GEMINI_MODEL || "gemini-2.5-pro";
        if (!geminiApiKey) {
          const configStr = await env.SYSTUNE_STORE.get("SYSTEM_CONFIG");
          if (configStr) {
            try {
              const cfg = JSON.parse(configStr);
              geminiApiKey = cfg.gemini_api_key || cfg.gemini_key;
              geminiModel = "gemini-2.5-pro";
            } catch (e) {}
          }
        }
        if (!geminiApiKey) {
          return new Response(JSON.stringify({ error: "GEMINI_API_KEY not configured" }), { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } });
        }
        
        const { keyword } = await request.json();
        
        const promptText = `You are an elite Senior Windows Kernel-Level Systems Engineer, Operating Systems Performance Architect, and advanced GEO (Generative Engine Optimization) Specialist for SysTune Enterprise.
Your task is to write a highly technical, dense, and authoritative deep-dive article about the keyword: '${keyword}'.
STRICT LENGTH LIMIT: The total output MUST NOT exceed 1,500 words. Be highly concise, punchy, and eliminate all unnecessary verbosity to prevent token truncation.

To guarantee a perfect 10/10 rating, eliminate hallucinations, and maintain absolute layout integrity, you MUST strictly execute every payload under this mastered architectural framework:

1. TECHNICAL DEPTH & MODERN PIPELINE CONSTRAINTS
- Never output superficial descriptions, generic software guides, or conversational AI fluff. 
- Dive directly into low-level operating system mechanics.
- MODERN NETWORKING MANDATE: Replace all references to legacy "ctcp" token text with the high-performance "CUBIC" network provider standard.

2. GENERATIVE ENGINE OPTIMIZATION (GEO) & AEO LAYOUT
- Direct Answer Snippet (AEO Box): Immediately after the short introduction, inject a clean blockquote using standard Markdown Blockquote syntax (> ) targeting a high-intent user query. The blockquote MUST contain a bold title on the first line (e.g. > **What is ...**), followed by a precise 2-3 sentence technical explanation, followed by exactly 3 bold bullet points mapping the core programmatic performance functions.
- Structured Comparison Matrices: Include at least one beautifully structured Markdown table mapping system components, registry paths, default OS values, optimized states, and recommended execution frequencies.
- Complete Anti-Fluff Policy: Start immediately with a powerful, technical hook line.

3. IRONCLAD DEFENSIVE GUARDRAILS & SAFE REGISTRY INITIALIZATION
- Strict Factuality Anchor: Never guess Registry paths.
- SAFE REGISTRY PROVISIONING: Inject Test-Path and New-Item -Force checks.
- Failsafe Execution Guard: Wrap PowerShell in try/catch blocks.

4. SEAMLESS COMMERCIAL CONTEXT & CONSOLIDATED CTA RULE
- ABSOLUTE CTA BAN IN BODY: Do not manually append raw markdown download links.
- MANDATORY REFERENCE LINKS: You MUST include exactly 2 highly relevant external Markdown links to official Microsoft MSDN (learn.microsoft.com) or Intel/Hardware documentation within the body text to back up the technical claims.

5. JSON PAYLOAD SCHEMA & RETURN FORMAT
Return your entire response as a STRICTLY VALID JSON object matching this schema exactly:
{
  "seo_title": "Catchy H1 Title.",
  "cover_image_keyword": "Generate an image_keyword that visually represents the technical solution discussed in this specific article. Never output generic 'logo' or 'loading' concepts.",
  "tldr_box": "A 40-word direct answer summarizing the solution for AI Answer Engines (AEO).",
  "content_markdown": "The main article in rich Markdown. MUST include H2/H3 tags, comparison Tables. You are explicitly allowed to inject exactly 1 inline image using the format ![inline image description](/blog/api/cover-image/{slug}_inline_0.jpg)",
  "faq_schema": [{"question": "...", "answer": "..."}],
  "new_suggested_keywords": ["long-tail keyword 1", "long-tail keyword 2", "long-tail keyword 3"]
}`;

        const geminiPayload = {
          contents: [{ parts: [{ text: promptText }] }],
          generationConfig: {
            temperature: 0.25,
            topK: 32,
            maxOutputTokens: 65536,
            responseMimeType: "application/json",
            responseSchema: {
              type: "OBJECT",
              properties: {
                seo_title: { type: "STRING" },
                cover_image_keyword: { type: "STRING" },
                tldr_box: { type: "STRING" },
                content_markdown: { type: "STRING" },
                faq_schema: {
                  type: "ARRAY",
                  items: {
                    type: "OBJECT",
                    properties: {
                      question: { type: "STRING" },
                      answer: { type: "STRING" }
                    }
                  }
                },
                new_suggested_keywords: {
                  type: "ARRAY",
                  items: { type: "STRING" }
                }
              },
              required: ["seo_title", "cover_image_keyword", "tldr_box", "content_markdown", "faq_schema", "new_suggested_keywords"]
            }
          },
          safetySettings: [
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" }
          ]
        };

        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${geminiApiKey}`;
        const geminiResponse = await fetch(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(geminiPayload)
        });
        
        if (!geminiResponse.ok) {
           const errText = await geminiResponse.text();
           throw new Error("Gemini API Error: " + errText);
        }
        
        const geminiData = await geminiResponse.json();
        let generatedText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "";
        generatedText = generatedText.replace(/^\s*```json/g, "").replace(/```\s*$/g, "").trim();
        
        let markdownData = {
          seo_title: "Generated Article",
          cover_image_keyword: "Abstract technology background",
          tldr_box: "",
          content_markdown: "",
          faq_schema: [],
          new_suggested_keywords: []
        };
        try {
            markdownData = JSON.parse(generatedText);
        } catch(e) {}
        
        const slug = markdownData.seo_title ? markdownData.seo_title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') : `article-${Date.now()}`;
        if (markdownData.content_markdown) {
            markdownData.content_markdown = markdownData.content_markdown.replace(/\{slug\}/g, slug);
        }
        
        // Ensure meta properties fallback safely (STRICT SCHEMA ENFORCEMENT)
        const safeCoverKeyword = markdownData.cover_image_keyword || "Abstract technology background";
        let inlinePrompt = `Technical blueprint infographic, data visualization, highly detailed UI, ${safeCoverKeyword}`;
        
        if (markdownData.content_markdown) {
            const imgRegex = /!\[([^\]]*)\]\([^)]+\)/;
            const match = imgRegex.exec(markdownData.content_markdown);
            if (match && match[1].trim() !== "") {
              inlinePrompt = match[1].trim() + `, professional cinematic UI blueprint`;
            }
        }

        const draftId = `BLOG_DRAFT_${Date.now()}`;
        
        // Write to KV in the background
        ctx.waitUntil(env.SYSTUNE_STORE.put(draftId, JSON.stringify(markdownData)));
        
        // Strict Payload Contract: Return exact schema requested by BlogManager.tsx
        return new Response(JSON.stringify({ 
          status: "success", 
          draft_id: draftId, 
          slug: slug,
          meta: {
            slug: slug,
            cover_image_keyword: safeCoverKeyword,
            inline_prompt: inlinePrompt
          },
          data: markdownData 
        }), {
          status: 200, headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: "Blog generation failed: " + err.message }), { 
          status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } 
        });
      }
    }

    // PATHROUTE 4.2: /api/admin/generate-media
    if (path === "/api/admin/generate-media" && request.method === "POST") {
      try {
        let geminiApiKey = env.GEMINI_API_KEY;
        if (!geminiApiKey) {
          const configStr = await env.SYSTUNE_STORE.get("SYSTEM_CONFIG");
          if (configStr) {
            try { geminiApiKey = JSON.parse(configStr).gemini_api_key || JSON.parse(configStr).gemini_key; } catch (e) {}
          }
        }
        if (!geminiApiKey) {
          return new Response(JSON.stringify({ error: "GEMINI_API_KEY not configured" }), { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } });
        }
        
        const payload = await request.json();
        const { slug, cover_image_keyword, inline_prompt } = payload;
        
        const modelName = 'imagen-4.0-ultra-generate-001';
        const imagenUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:predict?key=${geminiApiKey}`;
        
        const generateSingleImagen = async (prompt) => {
            const res = await fetch(imagenUrl, {
               method: 'POST',
               headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({
                  instances: [{ prompt: prompt }],
                  parameters: { sampleCount: 1, aspectRatio: "16:9", outputMimeType: "image/jpeg" }
               })
            });
            const data = await res.json();
            return data.predictions?.[0]?.bytesBase64Encoded || null;
        };
        
        const [coverImageB64, inlineImageB64] = await Promise.all([
           generateSingleImagen(`High quality cinematic 8k render, professional, ${cover_image_keyword}, highly technical, specific system component`).catch((e) => null),
           generateSingleImagen(inline_prompt).catch((e) => null)
        ]);
        
        const promises = [];
        const decodeAndSave = async (b64, keyName) => {
          if (!b64) return;
          try {
            let standardB64 = b64.replace(/-/g, '+').replace(/_/g, '/');
            const pad = standardB64.length % 4;
            if (pad) standardB64 += '='.repeat(4 - pad);
            const binaryString = atob(standardB64);
            const len = binaryString.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
            await env.SYSTUNE_STORE.put(keyName, bytes.buffer, { metadata: { type: 'image/jpeg' } });
          } catch(e) { console.error('Failed to decode image', e); }
        };

        if (coverImageB64) promises.push(decodeAndSave(coverImageB64, `COVER_IMG_${slug}`));
        if (inlineImageB64) promises.push(decodeAndSave(inlineImageB64, `COVER_IMG_${slug}_inline_0`));
        
        await Promise.all(promises);
        
        return new Response(JSON.stringify({ 
           status: "success", 
           media_status: {
              cover: coverImageB64 ? "success" : "failed",
              inline: inlineImageB64 ? "success" : "failed"
           }
        }), { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });
      } catch (err) {
        return new Response(JSON.stringify({ error: "Media generation failed: " + err.message }), { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } });
      }
    }

    // PATHROUTE 4.3: /api/admin/save-draft
    if (path === "/api/admin/save-draft" && request.method === "POST") {
      try {
        const payload = await request.json();
        const { draft_id, data } = payload;
        
        if (!draft_id || !data) {
          return new Response(JSON.stringify({ error: "Invalid payload" }), { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } });
        }
        
        const slug = data.seo_title ? data.seo_title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') : `article-${Date.now()}`;
        
        const finalArticle = {
            title: data.seo_title,
            body: data.content_markdown,
            title_bn: data.seo_title,
            body_bn: data.content_markdown,
            rich_content: JSON.stringify(data),
            generated_at: new Date().toISOString(),
            publish_at: new Date().toISOString(),
            status: "Draft",
            slug: slug
        };
        
        await env.SYSTUNE_STORE.put(`ARTICLE_${slug}`, JSON.stringify(finalArticle));
        await env.SYSTUNE_STORE.delete(draft_id);
        
        return new Response(JSON.stringify({ status: "success", slug: slug }), { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });
      } catch (err) {
        return new Response(JSON.stringify({ error: "Draft save failed: " + err.message }), { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } });
      }
    }

    // PATHROUTE 4.4: /api/admin/blog-manager/article - Atomic Single-Key CRUD
    if (path.startsWith("/api/admin/blog-manager/article")) {
      try {
        const slug = path.replace("/api/admin/blog-manager/article/", "").trim();
        if (!slug || slug === "/api/admin/blog-manager/article") {
          return new Response(JSON.stringify({ error: "Missing article slug" }), { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } });
        }

        if (request.method === "POST" || request.method === "PUT") {
          const article = await request.json();
          await env.SYSTUNE_STORE.put(`ARTICLE_${slug}`, JSON.stringify(article));
          return new Response(JSON.stringify({ status: "success", slug }), { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });
        }

        if (request.method === "DELETE") {
          await env.SYSTUNE_STORE.delete(`ARTICLE_${slug}`);
          // Clean up cover and inline images associated with the slug to avoid orphan data in KV
          await env.SYSTUNE_STORE.delete(`COVER_IMG_${slug}`);
          await env.SYSTUNE_STORE.delete(`COVER_IMG_${slug}_inline_0`);
          return new Response(JSON.stringify({ status: "success", slug }), { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });
        }

        return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { "Content-Type": "application/json", ...corsHeaders } });
      } catch (err) {
        return new Response(JSON.stringify({ error: "Atomic article CRUD error: " + err.message }), { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } });
      }
    }

    // PATHROUTE 4.5: /api/admin/blog-manager
    if (path === "/api/admin/blog-manager") {
      try {
        if (request.method === "GET") {
          const kwBankStr = await env.SYSTUNE_STORE.get("SEO_KEYWORDS") || "";
          
          const listResult = await env.SYSTUNE_STORE.list({ prefix: "ARTICLE_" });
          const articles = [];
          
          for (const key of listResult.keys) {
            const artStr = await env.SYSTUNE_STORE.get(key.name);
            if (artStr) {
              try { articles.push(JSON.parse(artStr)); } catch(e) {}
            }
          }
          
          articles.sort((a, b) => new Date(b.generated_at).getTime() - new Date(a.generated_at).getTime());
          
          return new Response(JSON.stringify({
            status: "success",
            data: {
              kwBank: kwBankStr,
              articles: articles
            }
          }), { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });
        }
        
        if (request.method === "POST") {
          const payload = await request.json();
          if (payload.action === "update_kw") {
            await env.SYSTUNE_STORE.put("SEO_KEYWORDS", payload.kwBank || "");
            return new Response(JSON.stringify({ status: "success" }), { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });
          }
          return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } });
        }
      } catch (err) {
        return new Response(JSON.stringify({ error: "Blog Manager Error: " + err.message }), { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } });
      }
    }

    return new Response(JSON.stringify({ message: "SysTune Admin CRM edge node V90.0 active (JWT Secured)" }), {
      headers: { "Content-Type": "application/json", ...corsHeaders }, status: 200
    });
  }
};
