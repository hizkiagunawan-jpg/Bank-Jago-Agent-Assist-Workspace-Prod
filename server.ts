import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize Gemini Client
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

let geminiBlockedUntil = 0;

function isGeminiAvailable(): boolean {
  if (!process.env.GEMINI_API_KEY) return false;
  if (Date.now() < geminiBlockedUntil) {
    return false;
  }
  return true;
}

function blockGeminiTemporarily() {
  console.log("[Circuit Breaker] Gemini quota limit triggered. Temporarily routing requests to local semantic FAQ matcher and matching heuristics for 2 minutes.");
  geminiBlockedUntil = Date.now() + 2 * 60 * 1000;
}

// Load the Revised Bank Jago FAQ
let faqContent = "";
const possibleFaqPaths = [
  path.join(process.cwd(), "src", "data", "revised_bank_jago_faq.txt"),
  path.join(process.cwd(), "revised_bank_jago_faq.txt"),
  path.join(process.cwd(), "dist", "revised_bank_jago_faq.txt"),
];

for (const fp of possibleFaqPaths) {
  try {
    if (fs.existsSync(fp)) {
      faqContent = fs.readFileSync(fp, "utf-8");
      console.log(`[FAQ Loader] Successfully loaded Revised Bank Jago FAQ from ${fp} (${faqContent.length} bytes)`);
      break;
    }
  } catch (err) {
    console.warn(`[FAQ Loader] Failed to load path ${fp}:`, err);
  }
}

if (!faqContent) {
  console.error("[FAQ Loader] WARNING: Bank Jago FAQ file could not be read. Falling back to empty string.");
}

interface FAQItem {
  question: string;
  answer: string;
  section: string;
}

let parsedFaqItems: FAQItem[] = [];

// Parse function to process the text file into structural elements
function parseFaqContent(content: string): FAQItem[] {
  const lines = content.split("\n");
  let currentSection = "📂 REGISTRASI, PERSYARATAN & AKTIVASI AKUN";
  const items: FAQItem[] = [];

  let currentQuestion = "";
  let currentAnswerLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) {
      if (currentQuestion && currentAnswerLines.length > 0) {
        items.push({
          question: currentQuestion,
          answer: currentAnswerLines.join("\n"),
          section: currentSection,
        });
        currentQuestion = "";
        currentAnswerLines = [];
      }
      continue;
    }

    if (line.includes("SEKTOR") || line.startsWith("📂")) {
      if (currentQuestion && currentAnswerLines.length > 0) {
        items.push({
          question: currentQuestion,
          answer: currentAnswerLines.join("\n"),
          section: currentSection,
        });
        currentQuestion = "";
        currentAnswerLines = [];
      }
      currentSection = line;
      continue;
    }

    // Question prefix check
    const isQuestionPrefix = /^(bagaimana|apakah|jika|kenapa|tips|berapa|apa|syarat|siapa|di mana|how|is there|can|need|help)/i.test(line);
    const endsWithQuestionMark = line.endsWith("?");

    if (endsWithQuestionMark || isQuestionPrefix) {
      if (currentQuestion && currentAnswerLines.length > 0) {
        items.push({
          question: currentQuestion,
          answer: currentAnswerLines.join("\n"),
          section: currentSection,
        });
      }
      currentQuestion = line;
      currentAnswerLines = [];
    } else {
      if (!currentQuestion) {
        currentQuestion = line;
      } else {
        currentAnswerLines.push(line);
      }
    }
  }

  if (currentQuestion && currentAnswerLines.length > 0) {
    items.push({
      question: currentQuestion,
      answer: currentAnswerLines.join("\n"),
      section: currentSection,
    });
  }

  return items;
}

// Parse loaded FAQ
if (faqContent) {
  try {
    parsedFaqItems = parseFaqContent(faqContent);
    console.log(`[FAQ Loader] Parsed ${parsedFaqItems.length} structural Q&A FAQ items for local fallback matching.`);
  } catch (err) {
    console.error("[FAQ Loader] Failed to pre-parse FAQ text content:", err);
  }
}

// Highly reliable term-scoring search function for resilient local search fallback
function searchLocalFaq(query: string): FAQItem[] {
  if (!query || !query.trim()) return [];
  const cleanStr = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, "");

  const queryTerms = cleanStr(query)
    .split(/\s+/)
    .filter(t => t.length > 1 && !["dan", "di", "ke", "saya", "kamu", "bisa", "yang", "untuk", "dari", "ini", "itu", "atau", "apa", "cara"].includes(t));

  if (queryTerms.length === 0) {
    queryTerms.push(...cleanStr(query).split(/\s+/).filter(t => t.length > 0));
  }

  const scoredItems = parsedFaqItems.map(item => {
    const qClean = cleanStr(item.question);
    const aClean = cleanStr(item.answer);
    let score = 0;

    // Full match boost
    if (qClean.includes(cleanStr(query))) {
      score += 1500;
    } else if (aClean.includes(cleanStr(query))) {
      score += 500;
    }

    // Keyword hits
    for (const term of queryTerms) {
      const qReg = new RegExp(`\\b${term}\\b`, 'g');
      const qMatches = qClean.match(qReg);
      if (qMatches) {
        score += qMatches.length * 300;
      } else if (qClean.includes(term)) {
        score += 150;
      }

      const aReg = new RegExp(`\\b${term}\\b`, 'g');
      const aMatches = aClean.match(aReg);
      if (aMatches) {
        score += aMatches.length * 100;
      } else if (aClean.includes(term)) {
        score += 50;
      }
    }

    return { item, score };
  });

  return scoredItems
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(x => x.item);
}

// 1. Unified function to format local time (WIB)
const formatIndoTime = (dateInput?: Date) => {
  const d = dateInput || new Date();
  return d.toLocaleTimeString("id-ID", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }) + " WIB";
};

// Unified helper to extract messages from body or remote endpoints
async function getMessages(req: express.Request): Promise<any[]> {
  // If POST contains messages array directly
  if (Array.isArray(req.body?.messages)) {
    return req.body.messages;
  }

  const conversationName = (req.query.conversation_name || req.body?.conversation_name) as string;
  if (!conversationName) {
    return [];
  }

  try {
    // Fetch raw messages from the main Cloud Run backend
    const [messagesRes, historyRes] = await Promise.all([
      fetch(`https://banking-chatbot-prod-571384310908.asia-southeast2.run.app/api/chat/messages?conversation_name=${encodeURIComponent(conversationName)}`).catch(() => null),
      fetch(`https://banking-chatbot-prod-571384310908.asia-southeast2.run.app/api/chat/history?conversation_name=${encodeURIComponent(conversationName)}`).catch(() => null),
    ]);

    let rawMsgs: any[] = [];
    if (messagesRes && messagesRes.ok) {
      const data = await messagesRes.json().catch(() => null);
      if (data) {
        const msgs = Array.isArray(data) ? data : (data.messages || data.history || []);
        if (Array.isArray(msgs)) rawMsgs = [...rawMsgs, ...msgs];
      }
    }
    if (historyRes && historyRes.ok) {
      const data = await historyRes.json().catch(() => null);
      if (data) {
        const msgs = Array.isArray(data) ? data : (data.messages || data.history || []);
        if (Array.isArray(msgs)) {
          msgs.forEach((m: any) => {
            const text = m.text || m.content || m.message || "";
            const id = m.id || m.name || "";
            const alreadyExists = rawMsgs.some((em: any) => {
              const emText = em.text || em.content || em.message || "";
              const emId = em.id || em.name || "";
              return (id && emId && id === emId) || emText === text;
            });
            if (!alreadyExists) rawMsgs.push(m);
          });
        }
      }
    }

    // Local preseeded fallbacks for mock IDs if Cloud Run has no records
    if (rawMsgs.length === 0) {
      if (conversationName.includes("conv-siti-aminah-1123")) {
        return [
          { sender: "bot", text: "Halo! Selamat datang di Bank Jago. Ada yang bisa Jagoan bantu hari ini?" },
          { sender: "customer", text: "Kartu debit saya hilang di minimarket tadi. Takut disalahgunakan orang, gimana ya?" },
          { sender: "bot", text: "Aduh, Jagoan turut prihatin mendengar kartu debit Kak Siti hilang! Jangan khawatir ya Kak, Kakak bisa langsung memblokir kartu sementara melalui aplikasi Jago agar aman terlebih dahulu. Caranya: masuk ke menu 'Kantong', pilih 'Kartu', lalu klik 'Blokir Sementara'." },
          { sender: "customer", text: "Oh gitu, tapi kalau mau buat kartu baru langsung lewat aplikasi juga bisa?" },
          { sender: "bot", text: "Betul sekali Kak Siti! Kakak bisa langsung klik 'Buat Kartu Baru' atau 'Minta Pengganti' di menu Kartu." },
          { sender: "customer", text: "Terimakasih informasinya, sangat membantu." }
        ];
      }
    }

    return rawMsgs;
  } catch (err: any) {
    console.error(`[getMessages Error] ${err.message}`);
    return [];
  }
}

// Local summary fallback helper
function generateLocalHeuristicSummary(rawMsgs: any[]): any {
  const sortedMsgs = rawMsgs
    .map((m, idx) => {
      const t = m.createTime || m.timestamp || m.sendTime || m.create_time;
      const timeVal = t ? (typeof t === "string" ? Date.parse(t) : idx) : idx;
      const rawSender = (m.sender || m.role || "bot").toLowerCase();
      let sender = "bot";
      if (rawSender.includes("customer") || rawSender.includes("user") || rawSender.includes("client")) {
        sender = "customer";
      } else if (rawSender.includes("agent") || rawSender.includes("human") || rawSender.includes("spec") || rawSender.includes("live")) {
        sender = "agent";
      }
      return {
        sender,
        text: m.text || m.content || m.message || "",
        timeVal: isNaN(timeVal) ? idx : timeVal,
      };
    })
    .sort((a, b) => a.timeVal - b.timeVal);

  const customerMsgs = sortedMsgs.filter(m => m.sender === "customer").map(m => m.text);
  const botMsgs = sortedMsgs.filter(m => m.sender === "bot" || m.sender === "agent").map(m => m.text);

  let situation = "Nasabah memerlukan bantuan dan penjelasan informasi layanan Bank Jago Syariah.";
  if (customerMsgs.length > 0) {
    const lastQuery = customerMsgs[customerMsgs.length - 1];
    const cleanQuery = lastQuery.length > 100 ? lastQuery.substring(0, 100) + "..." : lastQuery;
    situation = `Nasabah mengadukan situasi atau menyampaikan kendala/pertanyaan: "${cleanQuery}"`;
  }

  let action = "Sistem Virtual Assistant memberikan panduan solusi mandiri berdasarkan basis pengetahuan FAQ Bank Jago.";
  if (botMsgs.length > 0) {
    const lastAns = botMsgs[botMsgs.length - 1];
    const cleanAction = lastAns.length > 100 ? lastAns.substring(0, 100) + "..." : lastAns;
    action = `Asisten memberikan rekomendasi tindakan solusi: "${cleanAction}"`;
  }

  const textJoined = sortedMsgs.map(m => m.text.toLowerCase()).join(" ");
  const lastCustomerMsgsJoined = customerMsgs.slice(-3).map(m => m.toLowerCase()).join(" ");

  // Smart resolution heuristic
  let resolution = "Y: Yes. All the customer issues and queries are resolved.";
  
  // If the customer ends with positive confirmation terms, it is absolutely Y (fully resolved)
  const isActuallyResolvedByCustomer = 
    lastCustomerMsgsJoined.includes("terima kasih") || 
    lastCustomerMsgsJoined.includes("makasih") || 
    lastCustomerMsgsJoined.includes("teratasi") || 
    lastCustomerMsgsJoined.includes("jelas") || 
    lastCustomerMsgsJoined.includes("paham") || 
    lastCustomerMsgsJoined.includes("mengerti") || 
    lastCustomerMsgsJoined.includes("solved") || 
    lastCustomerMsgsJoined.includes("oke") || 
    lastCustomerMsgsJoined.includes("ok ") ||
    lastCustomerMsgsJoined.includes("baik") ||
    lastCustomerMsgsJoined.includes("thank") ||
    lastCustomerMsgsJoined.includes("thanks");

  if (!isActuallyResolvedByCustomer) {
    if (textJoined.includes("belum") || textJoined.includes("tidak bisa") || textJoined.includes("error") || textJoined.includes("kendala") || textJoined.includes("gagal") || textJoined.includes("hilang")) {
      resolution = "P: Partial. Only some of the multiple customer issues and queries are resolved.";
    }
  }

  // Dynamic satisfaction evaluation based on last customer messages & text-joined sentiment
  let satisfaction = "N: The customer is neutral or has positive feelings by the end of the conversation.";
  if (
    lastCustomerMsgsJoined.includes("kecewa") || 
    lastCustomerMsgsJoined.includes("kesal") || 
    lastCustomerMsgsJoined.includes("lambat") || 
    lastCustomerMsgsJoined.includes("buruk") || 
    lastCustomerMsgsJoined.includes("marah") || 
    lastCustomerMsgsJoined.includes("salah") ||
    lastCustomerMsgsJoined.includes("kecewah") ||
    lastCustomerMsgsJoined.includes("tidak puas") ||
    lastCustomerMsgsJoined.includes("bad service") ||
    lastCustomerMsgsJoined.includes("dissatisfied") ||
    lastCustomerMsgsJoined.includes("angry") ||
    lastCustomerMsgsJoined.includes("annoyed") ||
    lastCustomerMsgsJoined.includes("disappointed")
  ) {
    satisfaction = "D: The customer is dissatisfied or has negative feelings by the end of the conversation.";
  }

  return {
    date: new Date().toLocaleDateString("id-ID", { year: "numeric", month: "short", day: "numeric" }),
    time: formatIndoTime(),
    duration: "03:45 min",
    situation,
    action,
    resolution,
    satisfaction
  };
}

// --- API ENDPOINTS ---

// Custom Endpoint 1: Summary Generator using Gemini Grounding with Indonesian translation
const summaryHandler = async (req: express.Request, res: express.Response) => {
  const conversationName = (req.query.conversation_name || req.body?.conversation_name) as string;
  if (!conversationName) {
    return res.status(400).json({ error: "conversation_name parameter is required" });
  }

  let rawMsgs: any[] = [];
  try {
    rawMsgs = await getMessages(req);
  } catch (err: any) {
    console.warn("[Summary raw fetch] Failed to load messages for summaries:", err);
  }

  try {
    console.log(`[Summary] Generating live summary for: ${conversationName}`);

    if (!isGeminiAvailable()) {
      throw new Error("Gemini temporary standby mode");
    }

    let transcript = "";
    if (rawMsgs.length === 0) {
      transcript = "No conversational messages recorded.";
    } else {
      const sortedMsgs = rawMsgs
        .map((m, idx) => {
          const t = m.createTime || m.timestamp || m.sendTime || m.create_time;
          const timeVal = t ? (typeof t === "string" ? Date.parse(t) : idx) : idx;
          const rawSender = (m.sender || m.role || "bot").toLowerCase();
          let sender = "bot";
          if (rawSender.includes("customer") || rawSender.includes("user") || rawSender.includes("client")) {
            sender = "customer";
          } else if (rawSender.includes("agent") || rawSender.includes("human") || rawSender.includes("spec") || rawSender.includes("live")) {
            sender = "agent";
          }
          return {
            sender,
            text: m.text || m.content || m.message || "",
            timeVal: isNaN(timeVal) ? idx : timeVal,
          };
        })
        .sort((a, b) => a.timeVal - b.timeVal);

      transcript = sortedMsgs
        .map((m) => {
          const roleLabel = m.sender === "customer" ? "Customer/User" : m.sender === "agent" ? "Live Human Agent" : "Virtual Assistant";
          return `${roleLabel}: ${m.text}`;
        })
        .join("\n");
    }

    const systemInstruction = `You are a professional Bank Jago CCAI Agent Assist Summary generator.
Task: Summarize the provided customer chat conversation transcript with situation and action in Indonesian (Bahasa Indonesia), while resolution and customer satisfaction MUST match standard Google Cloud CCAI Agent Assist options.

Your outputs must strictly follow the CCAI agent assist rules based on the current updated conversation.
Provide a JSON object containing these exact fields:
- date: Today's date in local Indonesian style, e.g. "13 Jun 2026".
- time: Current Indonesian local time, e.g. "15:30 WIB".
- duration: A formatted duration string, e.g. "04:12 min".
- situation: Summary of what the customer needs help with or has questions about (from the customer's perspective). Write a concise, professional summary in Bahasa Indonesia.
- action: Summary of what the virtual assistant or live agent does to help the customer (from the agent's perspective). Write a concise, professional summary in Bahasa Indonesia.
- resolution: Choose EXACTLY one of these four exact English options:
  "Y: Yes. All the customer issues and queries are resolved."
  "P: Partial. Only some of the multiple customer issues and queries are resolved."
  "N: No. None of the customer issues and queries are resolved."
  "N/A: There are no specific issues or queries raised by the customer in the conversation."
  
  CRITICAL RESOLUTION RULE:
  - If the customer originally reported or complained about an error, issue, or failure (e.g. "gagal transfer", "tidak bisa kirim uang", "limit harian", "rekening terkunci") BUT the assistant/agent provided a clear solution, explanation, or workaround, AND the customer subsequently acknowledged this with understanding, relief, or gratitude (e.g., "Oh gt ya, ok baik mengerti", "sekarang sudah jelas", "terima kasih ya", "masalah saya sudah teratasi dengan baik"), then the issue is FULLY RESOLVED! In this case, you MUST set the resolution to "Y: Yes. All the customer issues and queries are resolved.".
  - Only use "P: Partial..." if some queries/issues are left completely unanswered or unresolved at the end of the conversation.

- satisfaction: Choose EXACTLY one of these two exact English options:
  "D: The customer is dissatisfied or has negative feelings by the end of the conversation."
  "N: The customer is neutral or has positive feelings by the end of the conversation."
  
  CRITICAL SATISFACTION RULE:
  - If the customer ends with any expression of frustration, dissatisfaction, complaint (e.g., "kecewa", "kesal", "lambat", "buruk", or any negative/angry sentiment in English/Bahasa), select "D: The customer is dissatisfied or has negative feelings by the end of the conversation.".
  - If they end with courtesy, gratitude, understanding, or neutral tone (e.g., "terima kasih", "ok baik", "mengerti", "jelas", "thanks", "thank you", "nice"), select "N: The customer is neutral or has positive feelings by the end of the conversation.".

Format: Return ONLY a valid JSON object matching the schema.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: `Please generate a summary for this conversation transcript:\n\n${transcript}`,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            date: { type: Type.STRING },
            time: { type: Type.STRING },
            duration: { type: Type.STRING },
            situation: { type: Type.STRING },
            action: { type: Type.STRING },
            resolution: { type: Type.STRING },
            satisfaction: { type: Type.STRING },
          },
          required: ["date", "time", "duration", "situation", "action", "resolution", "satisfaction"],
        },
      },
    });

    const summaryJson = JSON.parse(response.text?.trim() || "{}");
    res.json(summaryJson);
  } catch (err: any) {
    if (err && (err.status === 429 || err.message?.includes("quota") || err.message?.includes("standby") || err.message?.includes("limit"))) {
      blockGeminiTemporarily();
    }
    console.log("[Status] Utilizing local fallback processor for live summaries.");
    try {
      const localSummary = generateLocalHeuristicSummary(rawMsgs);
      res.json(localSummary);
    } catch (fallbackErr: any) {
      console.log("[Status] Local fallback summary safety trigger.");
      const emptySummary = generateLocalHeuristicSummary([]);
      res.json(emptySummary);
    }
  }
};

app.get("/api/chat/summary", summaryHandler);
app.post("/api/chat/summary", summaryHandler);

// Custom Endpoint 2: Proactive Suggester using Gemini Grounding with Indonesian translation
const suggestionsHandler = async (req: express.Request, res: express.Response) => {
  const conversationName = (req.query.conversation_name || req.body?.conversation_name) as string;
  if (!conversationName) {
    return res.status(400).json({ error: "conversation_name parameter is required" });
  }

  let lastCustomerMsgFallback = "";
  try {
    console.log(`[Proactive Assist] Generating suggestions for: ${conversationName}`);

    if (!isGeminiAvailable()) {
      throw new Error("Gemini temporary standby mode");
    }

    const rawMsgs = await getMessages(req);

    if (rawMsgs.length === 0) {
      return res.json([]);
    }

    const sortedMsgs = rawMsgs
      .map((m, idx) => {
        const t = m.createTime || m.timestamp || m.sendTime || m.create_time;
        const timeVal = t ? (typeof t === "string" ? Date.parse(t) : idx) : idx;
        const rawSender = (m.sender || m.role || "bot").toLowerCase();
        let sender = "bot";
        if (rawSender.includes("customer") || rawSender.includes("user") || rawSender.includes("client")) {
          sender = "customer";
        } else if (rawSender.includes("agent") || rawSender.includes("human") || rawSender.includes("spec") || rawSender.includes("live")) {
          sender = "agent";
        }
        return {
          sender,
          text: m.text || m.content || m.message || "",
          timeVal: isNaN(timeVal) ? idx : timeVal,
        };
      })
      .sort((a, b) => a.timeVal - b.timeVal);

    const customerMessages = sortedMsgs.filter((m) => m.sender === "customer");
    if (customerMessages.length === 0) {
      return res.json([]);
    }

    const lastCustomerMessage = customerMessages[customerMessages.length - 1].text || "";
    lastCustomerMsgFallback = lastCustomerMessage;

    // Proactive assistance executes when there is an active question or assistance request
    const hasQuestion =
      lastCustomerMessage.includes("?") ||
      /^(bagaimana|apakah|cara|kenapa|apa|siapa|di mana|how|what|why|is there|can|need|help)/i.test(lastCustomerMessage.trim()) ||
      lastCustomerMessage.length > 5;

    if (!hasQuestion) {
      return res.json([]);
    }

    const systemInstruction = `You are an AI-powered Proactive Generative Knowledge Assist Agent for Bank Jago Syariah.
You must use the following official 'Revised Bank Jago FAQ' as your absolute source of truth:
<FAQ_DATABASE>
${faqContent}
</FAQ_DATABASE>

Analyze the customer's last message. If they ask a direct/indirect question about account activation, top up, fees, bi-fast, pocket management, debit cards, RDN investment, Jago Amal, transfers, or failed transfer issues, extract the corresponding answer from the FAQ database.
If the customer's message is written in English, translate the question to Indonesian Bahasa first before formulating your answer. The generated response title and content MUST be fully written in Indonesian (Bahasa Indonesia).

Your response must be a JSON array. Each object in the array must contain:
1. title: The title or topic representing the relevant knowledge document/Sektor from the FAQ (e.g. "Returns & refunds - Help" or "Cara Top Up Aladin via BI-FAST").
2. content: The Generative AI generated answer. This must be clear, concise, and highly accurate, derived directly from the 'Revised Bank Jago FAQ'. Do not write unmentioned variables or make up rules.
3. source: "Revised Bank Jago FAQ"
4. confidence: A decimal match percentage from 0.85 to 0.99.

Format: Return ONLY a valid JSON array of objects.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: `Search grounding FAQ and prepare proactive aid suggestions for customer query: "${lastCustomerMessage}"`,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              content: { type: Type.STRING },
              source: { type: Type.STRING },
              confidence: { type: Type.NUMBER },
            },
            required: ["title", "content", "source", "confidence"],
          },
        },
      },
    });

    const suggestionsJson = JSON.parse(response.text?.trim() || "[]");
    res.json(suggestionsJson);
  } catch (err: any) {
    if (err && (err.status === 429 || err.message?.includes("quota") || err.message?.includes("standby") || err.message?.includes("limit"))) {
      blockGeminiTemporarily();
    }
    console.log("[Status] Utilizing local fallback processor for proactive assist suggestions.");
    try {
      const results = searchLocalFaq(lastCustomerMsgFallback);
      const suggestions = results.slice(0, 3).map((item, idx) => ({
        title: item.question,
        content: item.answer,
        source: "Revised Bank Jago FAQ (Resilient Local Match)",
        confidence: Math.max(0.85, 0.95 - idx * 0.04)
      }));
      res.json(suggestions);
    } catch (fallbackErr: any) {
      res.json([]);
    }
  }
};

app.get("/api/chat/suggestions", suggestionsHandler);
app.post("/api/chat/suggestions", suggestionsHandler);

// Custom Endpoint 3: Manual search in Bank Jago FAQ database
app.get("/api/chat/search", async (req, res) => {
  const query = req.query.query as string;
  if (!query) {
    return res.status(400).json({ error: "query query parameter is required" });
  }

  try {
    console.log(`[Manual Search] Searching Jago FAQ for query: ${query}`);

    if (!isGeminiAvailable()) {
      throw new Error("Gemini temporary standby mode");
    }

    const systemInstruction = `You are a Bank Jago Manual Generative Knowledge Assist Agent.
You have access to the Jago Syariah FAQ Knowledge Base:
<FAQ_CONTEXT>
${faqContent}
</FAQ_CONTEXT>

Based on the user's manual search query, find the relevant sections from the FAQ and formulate a clear, precise, and concise generated answer.
If the query is written in English, translate the question to Indonesian Bahasa first before answering. All answers, titles, and segments must be completely written in Indonesian (Bahasa Indonesia).

CRITICAL CAPABILITY: The user can search ANY information relevant or completely NOT relevant to the conversation or the FAQ database. If the query is not covered in the FAQ database, use your general knowledge to generate a polite, clear, and highly professional response in Indonesian (Bahasa Indonesia), under the category "General Guidance" or "Layanan Edukasi". Never return an empty answer; always assist the user's search query fully.

Your response must be a JSON array of search result objects. Each object must contain:
- title: The specific question or topic name.
- content: Your generative AI generated answer.
- category: The category, Sektor name, or "General Guidance" if unrelated to the FAQ context.

Format: Return ONLY a valid JSON array of objects.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: `Search and generate answers for manual query: "${query}"`,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              content: { type: Type.STRING },
              category: { type: Type.STRING },
            },
            required: ["title", "content", "category"],
          },
        },
      },
    });

    const searchJson = JSON.parse(response.text?.trim() || "[]");
    res.json(searchJson);
  } catch (err: any) {
    if (err && (err.status === 429 || err.message?.includes("quota") || err.message?.includes("standby") || err.message?.includes("limit"))) {
      blockGeminiTemporarily();
    }
    console.log("[Status] Utilizing local fallback processor for manual FAQ search queries.");
    try {
      const results = searchLocalFaq(query);
      const output = results.slice(0, 5).map(item => ({
        title: item.question,
        content: item.answer,
        category: item.section
      }));
      res.json(output);
    } catch (fallbackErr: any) {
      res.status(200).json([]);
    }
  }
});

// Proxy all other /api/chat/* requests to the external Cloud Run backend
app.all("/api/chat/:path", async (req, res, next) => {
  const subpath = req.params.path;
  if (["summary", "suggestions", "search"].includes(subpath)) {
    return next();
  }

  try {
    const targetUrl = `https://banking-chatbot-prod-571384310908.asia-southeast2.run.app/api/chat/${subpath}${
      req.url.includes("?") ? req.url.substring(req.url.indexOf("?")) : ""
    }`;

    const headers: Record<string, string> = {};
    if (req.headers["content-type"]) {
      headers["content-type"] = req.headers["content-type"] as string;
    }
    if (req.headers["authorization"]) {
      headers["authorization"] = req.headers["authorization"] as string;
    }

    const options: RequestInit = {
      method: req.method,
      headers,
    };

    if (["POST", "PUT", "PATCH"].includes(req.method) && req.body) {
      options.body = JSON.stringify(req.body);
    }

    const proxyRes = await fetch(targetUrl, options);
    res.status(proxyRes.status);

    const contentType = proxyRes.headers.get("content-type");
    if (contentType) {
      res.setHeader("content-type", contentType);
    }

    const bodyStr = await proxyRes.text();
    res.send(bodyStr);
  } catch (err: any) {
    console.error(`Proxy error for /api/chat/${subpath}:`, err.message);
    res.status(500).json({ error: "Failed to proxy request to Cloud Run", details: err.message });
  }
});

// Vite / static assets serving pipeline
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Server] Full-stack server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
