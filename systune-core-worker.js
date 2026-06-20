/**
 * Cloud Edge Worker 1: systune-core-worker.js (The Client Security Shield)
 * Shares unified KV Namespace 'SYSTUNE_STORE'
 */

async function signPayload(payloadObj, env) {
  const payloadWithTimestamp = { ...payloadObj, timestamp: Math.floor(Date.now() / 1000) };
  
  const pem = env.SIGNING_PRIVATE_KEY || `-----BEGIN PRIVATE KEY-----
MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgjp7CQ4cmLlSwoCTu
2jym1F5Xkm/dDfkOIZeUxCccyvGhRANCAATAwrlXFcep+stKXY/xKENGDlOxBESw
AIYBKocEouZYW8n7mGDaUC6ChEBnQSrQqqeP2AK5f1t6FxMtMAJmiAYH
-----END PRIVATE KEY-----`;

  const pemHeader = "-----BEGIN PRIVATE KEY-----";
  const pemFooter = "-----END PRIVATE KEY-----";
  const pemContents = pem.substring(pem.indexOf(pemHeader) + pemHeader.length, pem.indexOf(pemFooter)).replace(/\s/g, "");
  const binaryDerString = atob(pemContents);
  const binaryDer = new Uint8Array(binaryDerString.length);
  for (let i = 0; i < binaryDerString.length; i++) {
    binaryDer[i] = binaryDerString.charCodeAt(i);
  }

  try {
    const privateKey = await crypto.subtle.importKey(
      "pkcs8",
      binaryDer.buffer,
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["sign"]
    );
    
    const payloadString = JSON.stringify(payloadWithTimestamp);
    const encoder = new TextEncoder();
    const data = encoder.encode(payloadString);
    const signatureBuffer = await crypto.subtle.sign(
      { name: "ECDSA", hash: { name: "SHA-256" } },
      privateKey,
      data
    );
    
    const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));
    // Base64 encode the payload string safely
    const payloadBase64 = btoa(unescape(encodeURIComponent(payloadString)));
    
    return {
      payload_b64: payloadBase64,
      signature: signatureBase64
    };
  } catch (err) {
    return { error: "Signature generation failed: " + err.message };
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    async function sendSignedResponse(dataObj, status = 200) {
      const signedEnvelope = await signPayload(dataObj, env);
      return new Response(JSON.stringify(signedEnvelope), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
        status: status
      });
    }

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // PATHROUTE 1: /api/client/sync - Localized geo-tracking & campaign delivery
    if (path === "/api/client/sync") {
      try {
        const key = (url.searchParams.get("key") || "").toLowerCase().trim();
        if (!key) {
          return sendSignedResponse({ error: "Missing key" }, 400);
        }

        let valueStr = await env.SYSTUNE_STORE.get(key);
        if (!valueStr) {
          return sendSignedResponse({ error: "License not found" }, 404);
        }

        let value = JSON.parse(valueStr);
        const cfData = request.cf || {};
        const geoCountry = cfData.country || "Unknown";
        const geoCity = cfData.city || "Unknown";
        
        const now = new Date();
        const lastSeenStr = value.last_seen_time || "";
        const lastSeen = lastSeenStr ? new Date(lastSeenStr) : new Date(0);
        const timeDiffMinutes = (now.getTime() - lastSeen.getTime()) / (1000 * 60);

        if (timeDiffMinutes >= 15 || !value.last_seen_time) {
          value.last_seen_geo = `${geoCity} (${geoCountry})`;
          value.last_seen_time = now.toISOString();
          await env.SYSTUNE_STORE.put(key, JSON.stringify(value));
        }

        // Pull active campaign notifications in rich Markdown format
        let campaignData = {};
        const campStr = await env.SYSTUNE_STORE.get("GLOBAL_CAMPAIGN");
        if (campStr) {
          const campObj = JSON.parse(campStr);
          if (campObj.regions && typeof campObj.regions === "object") {
            campaignData = campObj.regions[geoCountry] || campObj.regions["Global"] || {};
          }
        }

        return sendSignedResponse({
          status: "synchronized",
          tier: value.tier || "Free Account",
          tokens_left: value.tokens_left,
          campaign: campaignData,
          server_time: new Date().toISOString()
        }, 200);

      } catch (err) {
        return sendSignedResponse({ error: err.message }, 500);
      }
    }

    // PATHROUTE 2: /api/client/verify-hwid - HWID seat Cap validations
    if (path === "/api/client/verify-hwid" && request.method === "POST") {
      try {
        const data = await request.json();
        const { key, hwid } = data;
        if (!key || !hwid) {
          return sendSignedResponse({ error: "Missing key or hwid payload" }, 400);
        }

        const cleanKey = key.toLowerCase().trim();
        const cleanHwid = hwid.toLowerCase().trim();

        let valueStr = await env.SYSTUNE_STORE.get(cleanKey);
        if (!valueStr) {
          return sendSignedResponse({ error: "License not found" }, 404);
        }

        let value = JSON.parse(valueStr);
        let allowed_seats = parseInt(value.allowed_seats) || 1;
        if (!value.active_hwids) value.active_hwids = [];

        if (!value.active_hwids.includes(cleanHwid)) {
          if (value.active_hwids.length < allowed_seats) {
            value.active_hwids.push(cleanHwid);
            await env.SYSTUNE_STORE.put(cleanKey, JSON.stringify(value));
          } else {
            return sendSignedResponse({ error: "License seat limit reached", allowed: allowed_seats }, 403);
          }
        }

        return sendSignedResponse({ status: "verified", allowed: allowed_seats, active: value.active_hwids.length }, 200);

      } catch (err) {
        return sendSignedResponse({ error: err.message }, 500);
      }
    }

    // PATHROUTE 3: /api/client/config - Global Ecosystem State
    if (path === "/api/client/config" && request.method === "GET") {
      try {
        let sysCfg = { ecosystem_mode: "PREMIUM" };
        const cfgStr = await env.SYSTUNE_STORE.get("SYSTEM_CONFIG");
        if (cfgStr) {
          sysCfg = JSON.parse(cfgStr);
        }
        return sendSignedResponse({ ecosystem_mode: sysCfg.ecosystem_mode || "FREE" }, 200);
      } catch (err) {
        return sendSignedResponse({ ecosystem_mode: "FREE" }, 200);
      }
    }

    // BACKWARDS COMPATIBILITY ROUTE 1: /?key=... - Legacy client licensing requests
    if (path === "/" && url.searchParams.has("key")) {
      const key = url.searchParams.get("key").toLowerCase().trim();
      const clientHwid = url.searchParams.get("hwid");
      
      let sysCfg = { ecosystem_mode: "PREMIUM" };
      try {
        const cfgStr = await env.SYSTUNE_STORE.get("SYSTEM_CONFIG");
        if (cfgStr) sysCfg = JSON.parse(cfgStr);
      } catch (e) {}
      
      let valueStr = await env.SYSTUNE_STORE.get(key);
      let payloadToReturn = null;
      
      if (valueStr) {
        try {
          let value = JSON.parse(valueStr);
          let requiresKVUpdate = false;
          
          const now = new Date();
          const currentYearMonth = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
          
          const tierLower = (value.tier || "Free Account").toLowerCase().trim();
          const isFreeAccount = tierLower === "free" || tierLower === "free account" || tierLower === "unknown" || tierLower === "";
          
          if (isFreeAccount && value.last_sync_month !== currentYearMonth) {
            let globalQuotaStr = await env.SYSTUNE_STORE.get("GLOBAL_QUOTA");
            let globalQuota = 3;
            if (globalQuotaStr) {
              try { globalQuota = parseInt(JSON.parse(globalQuotaStr).free_fixes_per_month) || 3; } catch(e) {}
            }
            
            let userTokens = parseInt(value.tokens_left);
            if (isNaN(userTokens)) userTokens = 0;
            
            if (userTokens < globalQuota) {
              value.tokens_left = globalQuota;
            }
            
            value.last_sync_month = currentYearMonth;
            requiresKVUpdate = true;
          }

          const lastSeenStr = value.last_seen_time || "";
          const lastSeen = lastSeenStr ? new Date(lastSeenStr) : new Date(0);
          const timeDiffMinutes = (now.getTime() - lastSeen.getTime()) / (1000 * 60);

          if (timeDiffMinutes >= 15 || !value.last_seen_time) {
            const cfData = request.cf || {};
            const geoCountry = cfData.country || "Unknown";
            const geoCity = cfData.city || "Unknown";
            value.last_seen_geo = `${geoCity} (${geoCountry})`;
            value.last_seen_time = now.toISOString();
            requiresKVUpdate = true;
          }

          // Seat constraints check
          if (value.allowed_seats && value.allowed_seats > 1) {
            if (!clientHwid) {
              return sendSignedResponse({ error: "HWID signature missing for enterprise verification" }, 400);
            }
            if (!value.active_hwids) value.active_hwids = [];
            
            if (!value.active_hwids.includes(clientHwid)) {
              if (value.active_hwids.length < value.allowed_seats) {
                value.active_hwids.push(clientHwid);
                requiresKVUpdate = true;
              } else {
                return sendSignedResponse({ error: "License seat limit reached" }, 403);
              }
            }
          }
          
          if (requiresKVUpdate) {
            await env.SYSTUNE_STORE.put(key, JSON.stringify(value));
          }
          
          let campaignMerge = {};
          try {
            const campStr = await env.SYSTUNE_STORE.get("GLOBAL_CAMPAIGN");
            if (campStr) {
              const campData = JSON.parse(campStr);
              const userCountry = (request.cf && request.cf.country) || "Unknown";
              if (campData.regions && typeof campData.regions === "object") {
                campaignMerge = campData.regions[userCountry] || campData.regions["Global"] || {};
              } else {
                const targetRegion = campData.target_region || "Global";
                if (targetRegion === "Global" || targetRegion === userCountry) {
                  campaignMerge = campData;
                }
              }
            }
          } catch (e) {}

          const existingPayload = { ...value, ...campaignMerge };
          payloadToReturn = existingPayload;
          
        } catch (e) {
          // If JSON parse fails, attempt to recover by sending raw string
          try {
            payloadToReturn = JSON.parse(valueStr);
          } catch (err2) {
            payloadToReturn = { error: "Corrupted profile data" };
          }
        }
      } else {
        // Free User Auto-Registration
        const now = new Date();
        const currentYearMonth = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
        
        let globalQuotaStr = await env.SYSTUNE_STORE.get("GLOBAL_QUOTA");
        let globalQuota = 3;
        if (globalQuotaStr) {
          try { globalQuota = parseInt(JSON.parse(globalQuotaStr).free_fixes_per_month) || 3; } catch(e) {}
        }

        let freeProfile = {
          tier: "Free Account",
          tokens_left: globalQuota,
          first_seen: now.toISOString(),
          last_sync_month: currentYearMonth,
          os_platform: url.searchParams.get("os") || "Unknown",
          architecture: url.searchParams.get("arch") || "Unknown"
        };
        
        await env.SYSTUNE_STORE.put(key, JSON.stringify(freeProfile));
        
        let campaignData = {};
        try {
          const campaignStr = await env.SYSTUNE_STORE.get("GLOBAL_CAMPAIGN");
          if (campaignStr) {
            const rawCampaign = JSON.parse(campaignStr);
            const userCountry = (request.cf && request.cf.country) || "Unknown";
            if (rawCampaign.regions && typeof rawCampaign.regions === "object") {
              campaignData = rawCampaign.regions[userCountry] || rawCampaign.regions["Global"] || {};
            } else {
              const targetRegion = rawCampaign.target_region || "Global";
              if (targetRegion === "Global" || targetRegion === userCountry) {
                campaignData = rawCampaign;
              }
            }
          }
        } catch (e) {}

        const finalPayload = { ...freeProfile, ...campaignData };
        payloadToReturn = finalPayload;
      }
      
      // --- LAST MILLISECOND INTERCEPTOR ---
      if (sysCfg.ecosystem_mode === "FREE" && payloadToReturn) {
        if (payloadToReturn.email && payloadToReturn.email.trim() !== "") {
          payloadToReturn.tier = "Free Beta (Pro)";
          payloadToReturn.tokens_left = "Unlimited";
        } else {
          payloadToReturn.tier = "Free Beta Guest";
          payloadToReturn.tokens_left = 0;
          payloadToReturn.requires_registration = true;
        }
      }
      
      return sendSignedResponse(payloadToReturn, 200);
    }

    // BACKWARDS COMPATIBILITY ROUTE 2: /sync-decrement - Token decrementing
    if (request.method === "POST" && path.replace(/\/$/, "") === "/sync-decrement") {
      const key = (url.searchParams.get("key") || "").toLowerCase().trim();
      if (!key) {
        return sendSignedResponse({ error: "License signature missing" }, 404);
      }

      const valueStr = await env.SYSTUNE_STORE.get(key);
      if (!valueStr) {
        return sendSignedResponse({ error: "License signature missing or revoked" }, 404);
      }

      try {
        let value = JSON.parse(valueStr);
        
        if (value.tokens_left !== "Unlimited" && value.tokens_left !== "Lifetime") {
          let currentTokens = parseInt(value.tokens_left);
          if (isNaN(currentTokens)) currentTokens = 0;

          const deductionAmount = parseInt(url.searchParams.get("amount")) || 1;
          value.tokens_left = Math.max(0, currentTokens - deductionAmount);
        }

        await env.SYSTUNE_STORE.put(key, JSON.stringify(value));

        return sendSignedResponse({
          status: "synchronized",
          tokens_remaining: value.tokens_left,
          tier: value.tier || "Unknown"
        }, 200);

      } catch (err) {
        return sendSignedResponse({ error: "Gateway fault during decrement" }, 500);
      }
    }

    // Gift key redemption compatibility pathway
    if (path === "/api/redeem-gift" && request.method === "POST") {
      try {
        const data = await request.json();
        const { hwid, gift_code } = data;
        
        if (!hwid || !gift_code) {
          return sendSignedResponse({ error: "Missing payloads" }, 400);
        }
        
        const cleanHwid = hwid.toLowerCase().trim();
        const cleanGift = gift_code.trim().toUpperCase();
        
        const giftPayloadStr = await env.SYSTUNE_STORE.get(`gift:${cleanGift}`);
        if (!giftPayloadStr) {
          return sendSignedResponse({ error: "Invalid or expired gift code." }, 404);
        }
        
        const giftPayload = JSON.parse(giftPayloadStr);
        if (giftPayload.spent) {
          return sendSignedResponse({ error: "Gift code has already been redeemed." }, 403);
        }
        
        const userStr = await env.SYSTUNE_STORE.get(cleanHwid);
        if (!userStr) {
          return sendSignedResponse({ error: "User HWID profile not found." }, 404);
        }
        
        let user = JSON.parse(userStr);
        let currentTokens = parseInt(user.tokens_left) || 0;
        const giftAmount = parseInt(giftPayload.tokens || 50);
        user.tokens_left = currentTokens + giftAmount;
        
        giftPayload.spent = true;
        giftPayload.redeemed_by = cleanHwid;
        giftPayload.redeem_date = new Date().toISOString();
        
        await env.SYSTUNE_STORE.put(`gift:${cleanGift}`, JSON.stringify(giftPayload));
        await env.SYSTUNE_STORE.put(cleanHwid, JSON.stringify(user));
        
        return sendSignedResponse({ 
          status: "synchronized", 
          tokens_remaining: user.tokens_left, 
          tier: user.tier || "Gifted" 
        }, 200);
        
      } catch (err) {
        return sendSignedResponse({ error: "Gateway Error: " + err.message }, 500);
      }
    }

    return sendSignedResponse({ message: "SysTune Client Shield edge node V90.0 active (ECDSA Secured)" }, 200);
  }
};
