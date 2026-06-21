import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  ArrowRight, 
  User, 
  Bot, 
  Bell, 
  Sparkles, 
  Phone, 
  Mail, 
  Layers, 
  Wifi, 
  AlertCircle, 
  ThumbsUp, 
  CheckCircle, 
  Clock, 
  Settings, 
  X, 
  Radio,
  FileText,
  HelpCircle,
  Play,
  RotateCcw,
  Check,
  Shield,
  ExternalLink,
  Copy,
  Pencil,
  ChevronUp,
  ChevronDown,
  Lock,
  MessageSquare
} from 'lucide-react';
import { INITIAL_CONVERSATIONS, JAGO_KNOWLEDGE_BASE } from './data/mockConversations';
import { Conversation, Message, KnowledgeSuggestion, ConversationSummary } from './types';

export default function App() {
  const BACKEND_URL = "";
  const googleModuleRef = useRef<HTMLDivElement>(null);
  const processedConvIdsRef = useRef<Set<string>>(new Set());

  // 1. Add a loading state for the Google SDK assets
  const [isSdkReady, setIsSdkReady] = useState<boolean>(false);

  useEffect(() => {
    // Prevent duplicate script mounts if the component re-renders
    if ('UiModulesConnector' in window) {
      setIsSdkReady(true);
      return;
    }

    // Load common.js (Provides UiModulesConnector)
    const scriptCommon = document.createElement('script');
    scriptCommon.src = "https://www.gstatic.com/agent-assist-ui-modules/v2.7/common.js";
    scriptCommon.async = true;

    // Load container.js (Provides agent-assist-ui-modules-v2)
    const scriptContainer = document.createElement('script');
    scriptContainer.src = "https://www.gstatic.com/agent-assist-ui-modules/v2.7/container.js";
    scriptContainer.async = true;

    scriptCommon.onload = () => {
      document.body.appendChild(scriptContainer);
    };

    scriptContainer.onload = () => {
      console.log("🚀 Google Agent Assist SDK assets compiled completely.");
      setIsSdkReady(true);
    };

    document.body.appendChild(scriptCommon);
  }, []);

  const getInitials = (name: string) => {
    if (!name) return "";
    return name
      .trim()
      .split(/\s+/)
      .map(word => word[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  };

  const formatIndoTime = (dateInput?: Date) => {
    const d = dateInput || new Date();
    return d.toLocaleTimeString('id-ID', {
      timeZone: 'Asia/Jakarta',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }) + " WIB";
  };

  // Conversations and active states
  const [conversations, setConversations] = useState<Conversation[]>(INITIAL_CONVERSATIONS);
  const latestConvsRef = useRef<Conversation[]>(conversations);
  useEffect(() => {
    latestConvsRef.current = conversations;
  }, [conversations]);

  const [selectedConvId, setSelectedConvId] = useState<string>(INITIAL_CONVERSATIONS[0].id);
  
  // Custom manual Input string
  const [customConvPath, setCustomConvPath] = useState<string>("");

  // Connection states (for real Cloud Run integration)
  const [isProvisioning, setIsProvisioning] = useState<boolean>(false);
  const [connectionDetails, setConnectionDetails] = useState<{
    linkedThreadId?: string;
    participantHandle?: string;
    token?: string;
    isReal?: boolean;
  } | null>(null);
  
  // Alerts / Handoff Notifications
  const [notifications, setNotifications] = useState<{
    id: string;
    customerName: string;
    message: string;
    timestamp: string;
    conversationId: string;
    type: 'escalation' | 'system';
  }[]>([]);
  
  // Manual Knowledge Search states
  const [knowledgeSearchQuery, setKnowledgeSearchQuery] = useState<string>("");
  const [searchResult, setSearchResult] = useState<{
    title: string;
    content: string;
    category: string;
  }[]>([]);

  // Agent Assist Generative Summary loading states
  const [isGeneratingSummary, setIsGeneratingSummary] = useState<boolean>(false);
  const [generationSteps, setGenerationSteps] = useState<string>("");
  const [generatedSummary, setGeneratedSummary] = useState<ConversationSummary | null>(null);

  // Proactive suggestions for active convo
  const [proactiveSuggestions, setProactiveSuggestions] = useState<KnowledgeSuggestion[]>(INITIAL_CONVERSATIONS[0].knowledgeSuggestions);

  // Collapsible and copied design states for modern workspace cards
  const [isSummaryExpanded, setIsSummaryExpanded] = useState<boolean>(true);
  const [isKnowledgeExpanded, setIsKnowledgeExpanded] = useState<boolean>(true);
  const [isSummaryCopied, setIsSummaryCopied] = useState<boolean>(false);
  const [isKnowledgeCopied, setIsKnowledgeCopied] = useState<boolean>(false);
  const [isSearchVisible, setIsSearchVisible] = useState<boolean>(false);

  // Internal agent chat response input (monitoring simulation)
  const [internalNote, setInternalNote] = useState<string>("");
  const [isCreatingSession, setIsCreatingSession] = useState<boolean>(false);

  const activeConversation = conversations.find(c => c.id === selectedConvId) || conversations[0];

  const messagesContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [selectedConvId, activeConversation?.messages?.length]);

  // Helper to trigger realistic Web Audio API audio chimes for handoffs
  const playNotificationChime = () => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const playTone = (freq: number, start: number, duration: number, type: OscillatorType = 'sine') => {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        
        osc.type = type;
        osc.frequency.setValueAtTime(freq, start);
        
        gain.gain.setValueAtTime(0.15, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + duration - 0.05);
        
        osc.connect(gain);
        gain.connect(audioContext.destination);
        
        osc.start(start);
        osc.stop(start + duration);
      };
      
      const now = audioContext.currentTime;
      // High-end Bank Jago alert chime
      playTone(587.33, now, 0.12, 'sine'); // D5
      playTone(783.99, now + 0.10, 0.35, 'sine'); // G5
    } catch (err) {
      console.warn("Audio context bypass/interaction needed before sound playing:", err);
    }
  };

  const handleCopySummary = () => {
    if (!generatedSummary) return;
    const textToCopy = `Summary of Chat with ${activeConversation.customerName}:
Date: ${generatedSummary.date}
Time: ${generatedSummary.time}
Duration: ${generatedSummary.duration}
Situation: ${generatedSummary.situation}
Action: ${generatedSummary.action}
Resolution: ${generatedSummary.resolution}
Satisfaction: ${generatedSummary.satisfaction}`;
    navigator.clipboard.writeText(textToCopy);
    setIsSummaryCopied(true);
    setTimeout(() => setIsSummaryCopied(false), 2000);
  };

  const handleCopyKnowledge = () => {
    const listToUse = searchResult.length > 0 ? searchResult : proactiveSuggestions;
    if (listToUse.length === 0) return;
    const textToCopy = listToUse.map(item => `[${item.title}]
${item.content}`).join('\n\n');
    navigator.clipboard.writeText(textToCopy);
    setIsKnowledgeCopied(true);
    setTimeout(() => setIsKnowledgeCopied(false), 2000);
  };

  // 1. Initialise the pre-seeded target input and sync summary/suggestions dynamically
  useEffect(() => {
    if (activeConversation) {
      setCustomConvPath(activeConversation.id);
      setSearchResult([]);
      setKnowledgeSearchQuery("");
      setGeneratedSummary(activeConversation.summary);
      setProactiveSuggestions(activeConversation.knowledgeSuggestions);
    }
  }, [selectedConvId, activeConversation?.id, activeConversation?.summary, activeConversation?.knowledgeSuggestions]);

  // 1b. Sync connectionDetails and auto-trigger agent subscription when conversation is selected/changed or transitions status
  useEffect(() => {
    if (!activeConversation) return;

    if (activeConversation.status === 'monitoring' || activeConversation.status === 'escalated' || activeConversation.status === 'resolved') {
      setConnectionDetails(null);
    } else if (activeConversation.status === 'active') {
      // If we are active, we automatically connect/subscribe the agent session
      if (!connectionDetails || connectionDetails.linkedThreadId !== activeConversation.id) {
        handleConnectAgentSession(activeConversation.id);
      }
    }
  }, [activeConversation?.id, activeConversation?.status]);

  // ─── REFACTORED SYNCHRONIZED GOOGLE COMPONENT LIFECYCLE INITIALIZER ───
  useEffect(() => {
    // Ensure both the SDK assets are compiled and connection states are live
    if (!isSdkReady || !connectionDetails?.token || !connectionDetails?.linkedThreadId) {
      return;
    }

    // Fallback protection: check if our HTML container target layout reference anchor node is available in the DOM
    const targetContainer = googleModuleRef.current || document.getElementById("google-shadow-root-container");
    if (!targetContainer) {
      console.warn("⏳ Retrying DOM layout query... Container anchor viewport node not mounted yet.");
      return;
    }

    // Clear previous allocations to prevent frame duplication memory leaking
    targetContainer.innerHTML = "";

    try {
      // @ts-ignore - Exposed globally via gstatic script inject assets tags
      const UiModulesConnectorClass = (window as any).UiModulesConnector;
      if (UiModulesConnectorClass) {
        const connector = new UiModulesConnectorClass();

        // Fire pristine authorization token credentials straight to the platform gateway proxy
        connector.init({
          channel: 'chat',
          agentDesktop: 'Custom',
          conversationProfileName: 'projects/ph-poc-465208/locations/asia-southeast2/conversationProfiles/EbvvyRk-T8Sboc0LW-Skrg',
          apiConfig: {
            authToken: connectionDetails.token,
            customApiEndpoint: BACKEND_URL,
          }
        });
        console.log("🟢 [CCAI Handshake] Google UI Module Connector initialized completely.");
      }

      // Instantiating the official UI container module node mapping path properties
      const containerElement = document.createElement('agent-assist-ui-modules-v2');
      
      // Bind target conversation path parameter explicitly
      containerElement.setAttribute('conversation-id', connectionDetails.linkedThreadId);
      
      // 🛠️ CRITICAL BLANK VIEWPORT REPAIR PATHWAYS:
      // Force direct client rendering overrides instead of waiting for remote console profile layouts
      containerElement.setAttribute('use-configured-features', 'false'); 
      containerElement.setAttribute('show-transcript', 'true');
      containerElement.setAttribute('show-summary', 'true');
      containerElement.setAttribute('show-knowledge-assist', 'true');

      // Mount to live view port
      targetContainer.appendChild(containerElement);
      console.log(`🚀 [Viewport Sync Active] Mapped real-time text stream for thread resource: ${connectionDetails.linkedThreadId}`);

    } catch (error) {
      console.error("❌ Google UI Module mount initialization crashed: ", error);
    }
  }, [connectionDetails, isSdkReady, activeConversation?.id]); // 👈 Added activeConversation sync tracking anchor dependencies!

  const generateDynamicSummaryOfMessages = (customerName: string, messages: Message[], status: string) => {
    const customerMsgs = messages.filter(m => m.sender === 'customer');
    const systemMsgs = messages.filter(m => m.sender === 'bot' || m.sender === 'agent');

    // Extract situation (what happened in conversation, details reported by customer)
    let situationText = "Nasabah meminta penjelasan atau bantuan mengenai layanan Bank Jago.";
    if (customerMsgs.length > 0) {
      const msgsDesc = customerMsgs.map(m => m.text).join(", ");
      const latestText = customerMsgs[customerMsgs.length - 1].text;
      const lowerJoin = msgsDesc.toLowerCase();
      
      if (lowerJoin.includes("transfer") && (lowerJoin.includes("bermasalah") || lowerJoin.includes("gagal") || lowerJoin.includes("tidak bisa") || lowerJoin.includes("belum"))) {
        situationText = `Nasabah mengadukan kegagalan transfer uang antarbank ke bank lain (${latestText}).`;
      } else if (lowerJoin.includes("hilang") || lowerJoin.includes("blokir") || lowerJoin.includes("kartu")) {
        situationText = `Nasabah mengadukan situasi kehilangan kartu debit fisik Visa Jago dan khawatir akan penyalahgunaan dana.`;
      } else if (lowerJoin.includes("bunga") || lowerJoin.includes("kantong") || lowerJoin.includes("tabungan") || lowerJoin.includes("terkunci")) {
        situationText = `Nasabah mengajukan pertanyaan perihal perbedaan suku bunga Kantong Tabungan & Kantong Terkunci.`;
      } else {
        situationText = `Nasabah menyampaikan pertanyaan/kendala: "${latestText}".`;
      }
    }

    // Extract action (what to do to solve the issue from assistant perspective)
    let actionText = "Asisten menginstruksikan verifikasi status KYC / aktivasi akun serta kelayakan kecukupan saldo sebelum melakukan transaksi ulang.";
    const textJoinedLower = messages.map(m => (m.text || "").toLowerCase()).join(" ");
    
    if (textJoinedLower.includes("transfer") || textJoinedLower.includes("kirim")) {
      actionText = "Asisten menjelaskan panduan transfer antarbank via menu Kirim & Bayar serta merekomendasikan verifikasi status limit harian keamanan dan kelayakan bank tujuan.";
    } else if (textJoinedLower.includes("hilang") || textJoinedLower.includes("blokir") || textJoinedLower.includes("kartu")) {
      actionText = "Asisten memandu cara blokir sementara kartu langsung di menu Kantong -> Kartu, dan menginstruksikan pengajuan pembuatan kartu debit pengganti.";
    } else if (textJoinedLower.includes("bunga") || textJoinedLower.includes("kantong") || textJoinedLower.includes("terkunci")) {
      actionText = "Asisten memaparkan keuntungan bunga Kantong Terkunci (hingga 5.0% p.a.) serta merinci regulasi pembatalan penguncian sebelum waktu jatuh tempo.";
    }

    // Extract resolution aligning exactly with Google Cloud CCAI Agent Assist standard options
    const lastThreeCustomerMsgs = customerMsgs.slice(-3).map(m => m.text.toLowerCase()).join(" ");
    
    let resolutionText = "Y: Yes. All the customer issues and queries are resolved.";

    // If customer says ok, terima kasih, jelas, paham, mengerti, solved etc., then they are satisfied with explanation and it is Y: Yes
    const isConfirmedResolved = 
      lastThreeCustomerMsgs.includes("terima kasih") || 
      lastThreeCustomerMsgs.includes("makasih") || 
      lastThreeCustomerMsgs.includes("teratasi") || 
      lastThreeCustomerMsgs.includes("jelas") || 
      lastThreeCustomerMsgs.includes("paham") || 
      lastThreeCustomerMsgs.includes("mengerti") || 
      lastThreeCustomerMsgs.includes("solved") || 
      lastThreeCustomerMsgs.includes("oke") || 
      lastThreeCustomerMsgs.includes("ok ") ||
      lastThreeCustomerMsgs.includes("baik") ||
      lastThreeCustomerMsgs.includes("thank") ||
      lastThreeCustomerMsgs.includes("thanks");

    if (!isConfirmedResolved) {
      if (textJoinedLower.includes("belum") || textJoinedLower.includes("tidak bisa") || textJoinedLower.includes("error") || textJoinedLower.includes("kendala") || textJoinedLower.includes("gagal") || textJoinedLower.includes("hilang")) {
        resolutionText = "P: Partial. Only some of the multiple customer issues and queries are resolved.";
      }
    }
    if (status === 'resolved' && !textJoinedLower.includes("gagal") && !textJoinedLower.includes("error")) {
      resolutionText = "Y: Yes. All the customer issues and queries are resolved.";
    }

    // Customer satisfaction aligning exactly with Google Cloud CCAI Agent Assist standard options
    let satisfactionText = "N: The customer is neutral or has positive feelings by the end of the conversation.";
    if (
      lastThreeCustomerMsgs.includes("kecewa") || 
      lastThreeCustomerMsgs.includes("kesal") || 
      lastThreeCustomerMsgs.includes("lambat") || 
      lastThreeCustomerMsgs.includes("buruk") ||
      lastThreeCustomerMsgs.includes("marah") ||
      lastThreeCustomerMsgs.includes("salah") ||
      lastThreeCustomerMsgs.includes("kecewah") ||
      lastThreeCustomerMsgs.includes("tidak puas") ||
      lastThreeCustomerMsgs.includes("bad service") ||
      lastThreeCustomerMsgs.includes("dissatisfied") ||
      lastThreeCustomerMsgs.includes("angry") ||
      lastThreeCustomerMsgs.includes("annoyed") ||
      lastThreeCustomerMsgs.includes("disappointed")
    ) {
      satisfactionText = "D: The customer is dissatisfied or has negative feelings by the end of the conversation.";
    }

    return {
      date: new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric' }),
      time: formatIndoTime(),
      duration: "03:12 min",
      situation: situationText,
      action: actionText,
      resolution: resolutionText,
      satisfaction: satisfactionText
    };
  };

  // Unified parser/sorter ensuring correct chronological sequencing (oldest message first)
  const parseAndSortMessages = (rawMsgs: any[]): Message[] => {
    if (!Array.isArray(rawMsgs) || rawMsgs.length === 0) return [];

    const getParsedTime = (m: any): number => {
      const t = m.createTime || m.timestamp || m.sendTime || m.create_time;
      if (!t) return 0;
      if (typeof t === 'string') {
        const parsed = Date.parse(t);
        return isNaN(parsed) ? 0 : parsed;
      }
      if (typeof t === 'object' && t !== null) {
        if (typeof t.seconds === 'number') {
          return t.seconds * 1000 + (t.nanoseconds || t.nanos || 0) / 1000000;
        }
      }
      return 0;
    };

    const mapSender = (m: any): 'customer' | 'agent' | 'bot' => {
      const sVal = (m.sender || m.role || m.author || m.speaker || '').toLowerCase().trim();
      if (sVal === 'customer' || sVal === 'agent' || sVal === 'bot') {
        return sVal;
      } else if (sVal.includes('customer') || sVal.includes('user') || sVal === 'client') {
        return 'customer';
      } else if (sVal.includes('agent') || sVal.includes('human')) {
        return 'agent';
      } else {
        return 'bot';
      }
    };

    const parsed: (Message & { rawTimeVal: number; originalIdx: number })[] = rawMsgs.map((m: any, idx: number) => {
      const timeVal = getParsedTime(m);
      return {
        id: m.id || m.name || `msg_polled_${idx}_${Date.now()}`,
        sender: mapSender(m),
        text: m.text || m.content || m.message || '',
        timestamp: m.timestamp || m.createTime || formatIndoTime(timeVal > 0 ? new Date(timeVal) : undefined),
        rawTimeVal: timeVal,
        originalIdx: idx
      };
    }).filter((m: Message) => {
      const textLower = m.text.trim().toLowerCase().replace(/[.,!]/g, '');
      return textLower !== 'hi' && textLower !== 'hello' && textLower !== 'halo';
    });

    let firstValidTime = 0;
    let lastValidTime = 0;

    for (let i = 0; i < parsed.length; i++) {
      if (parsed[i].rawTimeVal > 0) {
        firstValidTime = parsed[i].rawTimeVal;
        break;
      }
    }
    for (let i = parsed.length - 1; i >= 0; i--) {
      if (parsed[i].rawTimeVal > 0) {
        lastValidTime = parsed[i].rawTimeVal;
        break;
      }
    }

    let oriented: any[] = [...parsed];
    // ONLY reverse if we can deterministically confirm it's newest-to-oldest (firstValidTime > lastValidTime > 0)
    if (firstValidTime > lastValidTime && lastValidTime > 0) {
      oriented.reverse();
    }

    // Assign a monotonic sort index to handle missing timestamps
    let maxValidTime = 0;
    for (const p of oriented) {
      if (p.rawTimeVal > maxValidTime) {
        maxValidTime = p.rawTimeVal;
      }
    }
    if (maxValidTime === 0) {
      maxValidTime = Date.now();
    }

    const withSortKeys = oriented.map((item, idx) => {
      return {
        ...item,
        sortTimeVal: item.rawTimeVal > 0 ? item.rawTimeVal : (maxValidTime + (idx + 1) * 1000)
      };
    });

    // Sort cleanly newest at the bottom
    withSortKeys.sort((a, b) => a.sortTimeVal - b.sortTimeVal);

    return withSortKeys.map(m => ({
      id: m.id,
      sender: m.sender,
      text: m.text,
      timestamp: m.timestamp
    }));
  };

  // Helper to fetch from both messages and history endpoints concurrently for maximum data coverage
  const fetchConversationMessagesAndHistory = async (convPath: string): Promise<any[]> => {
    try {
      const [messagesRes, historyRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/chat/messages?conversation_name=${encodeURIComponent(convPath)}`).catch(() => null),
        fetch(`${BACKEND_URL}/api/chat/history?conversation_name=${encodeURIComponent(convPath)}`).catch(() => null)
      ]);

      let rawMsgs: any[] = [];

      if (messagesRes && messagesRes.ok) {
        const data = await messagesRes.json().catch(() => null);
        if (data) {
          const msgs = Array.isArray(data) ? data : (data.messages || data.history || []);
          if (Array.isArray(msgs)) {
            rawMsgs = [...rawMsgs, ...msgs];
          }
        }
      }

      if (historyRes && historyRes.ok) {
        const data = await historyRes.json().catch(() => null);
        if (data) {
          const msgs = Array.isArray(data) ? data : (data.messages || data.history || []);
          if (Array.isArray(msgs)) {
            msgs.forEach((m: any) => {
              const text = m.text || m.content || m.message || '';
              const id = m.id || m.name || '';
              const alreadyExists = rawMsgs.some((em: any) => {
                const emText = em.text || em.content || em.message || '';
                const emId = em.id || em.name || '';
                return (id && emId && id === emId) || emText === text;
              });
              if (!alreadyExists) {
                rawMsgs.push(m);
              }
            });
          }
        }
      }

      return rawMsgs;
    } catch (err) {
      console.warn("Error in fetchConversationMessagesAndHistory:", err);
      return [];
    }
  };

  // ─── UPGRADED TRANCRIPT MESSAGES POLLING LOOP WITH EXPLICIT CHRONOLOGICAL SORT ───
  useEffect(() => {
    let isMounted = true;
    const fetchInterval = setInterval(async () => {
      const currentConvs = latestConvsRef.current;
      
      // Allow active rooms to continue fetching updates in real-time
      const realConvs = currentConvs.filter(c => 
        c.id.startsWith("projects/") && c.status !== 'resolved'
      );
      if (realConvs.length === 0) return;

      for (const conv of realConvs) {
        try {
          const rawMsgs = await fetchConversationMessagesAndHistory(conv.id);
          if (isMounted && Array.isArray(rawMsgs) && rawMsgs.length > 0) {
            const parsedMsgs = parseAndSortMessages(rawMsgs);

            setConversations(prev => prev.map(c => {
              if (c.id === conv.id) {
                if (c.status === 'resolved') return c;
                
                // Keep local agent messages that are not yet returned by the backend
                const localAgentMsgs = c.messages.filter(m => m.sender === 'agent');
                const missingAgentMsgs = localAgentMsgs.filter(localMsg => {
                  return !parsedMsgs.some(parsedMsg => 
                    parsedMsg.id === localMsg.id || 
                    parsedMsg.text.trim().toLowerCase() === localMsg.text.trim().toLowerCase()
                  );
                });

                let mergedMsgs = [...parsedMsgs];
                if (missingAgentMsgs.length > 0) {
                  mergedMsgs = [...mergedMsgs, ...missingAgentMsgs];
                }

                const currentTextConcat = c.messages.map(m => m.text).join('|');
                const newTextConcat = mergedMsgs.map(m => m.text).join('|');

                const messagesTextLower = mergedMsgs.map((m: any) => String(m.text || '').toLowerCase()).join(" ");
                const hasHandoffKeyword = 
                  messagesTextLower.includes("hubungkan ke") || 
                  messagesTextLower.includes("menghubungkan ke") || 
                  messagesTextLower.includes("tim spesialis") ||
                  messagesTextLower.includes("spesialis transfer") ||
                  messagesTextLower.includes("spesialis bank jago") ||
                  messagesTextLower.includes("live agent") ||
                  messagesTextLower.includes("eskalasi") ||
                  messagesTextLower.includes("transfer ke agen") ||
                  (messagesTextLower.includes("hubung") && messagesTextLower.includes("spesialis")) ||
                  messagesTextLower.includes("customer specialist");

                let updatedStatus = c.status;
                if (c.status === 'monitoring' && hasHandoffKeyword) {
                  updatedStatus = 'escalated';
                  setTimeout(() => {
                    playNotificationChime();
                    setSelectedConvId(c.id);
                  }, 0);
                }
                
                if (currentTextConcat !== newTextConcat || c.status !== updatedStatus) {
                  return { 
                    ...c, 
                    status: updatedStatus,
                    lastMessage: mergedMsgs[mergedMsgs.length - 1]?.text || c.lastMessage, 
                    messages: mergedMsgs 
                  };
                }
              }
              return c;
            }));
          }
        } catch (err) {}
      }
    }, 2500);
    return () => { isMounted = false; clearInterval(fetchInterval); };
  }, []);

  // Auto conversation background summarizing has been removed so that summaries are only generated once when the handoff/escalation is proposed, and can be updated manually thereafter by clicking 'GENERATE SUMMARY'.

  // Automatically trigger smart generative summary when handoff/escalation is proposed!
  useEffect(() => {
    if (!activeConversation) return;
    
    if (activeConversation.status === 'escalated') {
      // Trigger summary generation automatically with steps animation only once
      if (!isGeneratingSummary && !activeConversation.summary) {
        const timer = setTimeout(() => {
          startGenerativeSummary();
        }, 500);
        return () => clearTimeout(timer);
      }
    }
  }, [activeConversation?.id, activeConversation?.status, activeConversation?.summary]);

  // ─── REUSABLE KNOWLEDGE ASSIST ENGINE ───
  const handleProactiveKnowledgeTrigger = async () => {
    if (!activeConversation) return;

    // Proactive knowledge assistance is triggered for both escalated and active states so agent can prepare/join with support
    if (activeConversation.status !== 'active' && activeConversation.status !== 'escalated') {
      // Clear suggestions for non-active sessions so they stay clean
      setProactiveSuggestions([]);
      return;
    }

    // Extract the absolute newest customer message to define the active query context, with a fallback to the latest message of any sender
    const newestCustMsg = [...activeConversation.messages]
      .reverse()
      .find(m => m.sender === 'customer' || m.sender === 'user');

    const newestAnyMsg = [...activeConversation.messages]
      .reverse()
      .find(m => m.text);

    const activeMsg = newestCustMsg || newestAnyMsg;
    if (!activeMsg) return;

    const term = (activeMsg.text || "").toLowerCase().trim();

    const fetchBackendSuggestions = async () => {
      try {
        console.log("Fetching proactive suggestions from full-stack backend for message:", term);
        const response = await fetch(`${BACKEND_URL}/api/chat/suggestions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            conversation_name: activeConversation.id,
            messages: activeConversation.messages
          })
        });

        if (response.ok) {
          const data = await response.json();
          const suggestions = Array.isArray(data) ? data : (data.suggestions || data.results || []);
          if (suggestions.length > 0) {
            const parsed: KnowledgeSuggestion[] = suggestions.map((s: any) => ({
              title: s.title || s.headline || "Suggested Article",
              content: s.content || s.text || s.summary || "",
              source: s.source || "Revised Bank Jago FAQ",
              confidence: s.confidence || (0.8 + Math.random() * 0.19)
            }));

            setConversations(prev => prev.map(c => {
              if (c.id === activeConversation.id) {
                return { ...c, knowledgeSuggestions: parsed };
              }
              return c;
            }));

            setProactiveSuggestions(parsed);
            return true; // success
          }
        }
      } catch (err: any) {
        console.warn("Backend proactive suggestions fetch failed, relying on frontend generator:", err.message);
      }
      return false; // did not load
    };

    const runLocalAnalysis = () => {
      const cleanStr = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, "");
      const cleanTerm = cleanStr(term);
      const queryWords = cleanTerm
        .split(/\s+/)
        .filter(t => t.length > 1 && !["dan", "di", "ke", "saya", "kamu", "bisa", "yang", "untuk", "dari", "ini", "itu", "atau", "apa", "cara", "ada", "nih", "kok", "tidak"].includes(t));

      if (queryWords.length === 0) {
        queryWords.push(...cleanTerm.split(/\s+/).filter(t => t.length > 0));
      }

      const scored = JAGO_KNOWLEDGE_BASE.map(item => {
        const titleClean = cleanStr(item.title);
        const contentClean = cleanStr(item.content);
        let score = 0;

        // Big boost for direct title or contents match
        if (titleClean.includes(cleanTerm)) {
          score += 1000;
        } else if (contentClean.includes(cleanTerm)) {
          score += 400;
        }

        // Score based on word matches
        for (const word of queryWords) {
          if (titleClean.includes(word)) {
            score += 300;
          }
          if (contentClean.includes(word)) {
            score += 100;
          }
        }

        // Contextual rule matches to boost specific topics
        if (cleanTerm.includes("transfer") || cleanTerm.includes("kirim") || cleanTerm.includes("bifast") || cleanTerm.includes("bi-fast")) {
          if (item.category === "Transfers") {
            // Highly prioritize "Solusi Gagal Transfer" if they complain about transfer failure/issues/tidak bisa
            if ((cleanTerm.includes("gagal") || cleanTerm.includes("tidak bisa") || cleanTerm.includes("bermasalah") || cleanTerm.includes("error")) && item.title.includes("Gagal")) {
              score += 900;
            } else if (item.title.includes("Ke Bank Lain")) {
              score += 500;
            } else {
              score += 100;
            }
          }
        }

        if (cleanTerm.includes("kartu") || cleanTerm.includes("debit") || cleanTerm.includes("hilang")) {
          if (item.category === "Debits Card") {
            score += 400;
          }
        }

        if (cleanTerm.includes("gopay") || cleanTerm.includes("gojek") || cleanTerm.includes("goto")) {
          if (item.category === "Partner Integrations") {
            score += 400;
          }
        }

        if (cleanTerm.includes("kantong") || cleanTerm.includes("kunci") || cleanTerm.includes("bunga") || cleanTerm.includes("locked")) {
          if (item.category === "Savings") {
            score += 400;
          }
        }

        return { item, score };
      });

      const matchedItems = scored
        .filter(x => x.score > 0)
        .sort((a, b) => b.score - a.score)
        .map(x => x.item);

      if (matchedItems.length > 0) {
        const suggestions: KnowledgeSuggestion[] = matchedItems.slice(0, 3).map((m, idx) => ({
          title: m.title,
          content: m.content,
          source: `${m.category} SOP V1.4`,
          confidence: Math.max(0.75, 0.98 - idx * 0.05)
        }));

        setConversations(prev => prev.map(c => {
          if (c.id === activeConversation.id) {
            return {
              ...c,
              knowledgeSuggestions: suggestions
            };
          }
          return c;
        }));

        setProactiveSuggestions(suggestions);
      }
    };

    const loaded = await fetchBackendSuggestions();
    if (!loaded) {
      runLocalAnalysis();
    }
  };

  // Dynamically analyze messages to suggest proactive knowledge articles (Knowledge Assist)
  useEffect(() => {
    handleProactiveKnowledgeTrigger();
  }, [activeConversation?.messages?.length, activeConversation?.status, connectionDetails]);

  // ─── 🟢 BACKGROUND WEB WORKER HEARTBEAT DISCOVERY ───
  useEffect(() => {
    let isMounted = true;

    // Inline worker thread preventing browser frame execution throttling
    const workerScriptCode = `
      let backgroundTimerLoop = null;
      self.onmessage = function(event) {
        if (event.data === 'ACTIVATE_LISTENER') {
          backgroundTimerLoop = setInterval(() => {
            self.postMessage('TRIGGER_POLL_TICK');
          }, 3000);
        } else if (event.data === 'TERMINATE_LISTENER') {
          clearInterval(backgroundTimerLoop);
        }
      };
    `;

    const workerBlobContainer = new Blob([workerScriptCode], { type: 'application/javascript' });
    const backgroundWorkerThread = new Worker(URL.createObjectURL(workerBlobContainer));

    const pollEscalationsActiveTask = async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/api/chat/active`);
        if (response.ok) {
          const data = await response.json();
          const convId = data.conversation_name || data.conversationName;
          
          if (convId && typeof convId === 'string' && convId.startsWith("projects/")) {
            if (!processedConvIdsRef.current.has(convId)) {
              const rawMsgs = await fetchConversationMessagesAndHistory(convId);
              
              const parsedMsgs: Message[] = rawMsgs.map((m: any, idx: number) => {
                const incomingRole = String(m.sender || m.role || m.author || m.speaker || '').toLowerCase().trim();
                
                let alignedSender: 'customer' | 'agent' | 'bot' = 'bot';
                if (incomingRole === 'customer' || incomingRole === 'user' || incomingRole.includes('customer') || incomingRole.includes('user')) {
                  alignedSender = 'customer';
                } else if (incomingRole === 'agent' || incomingRole === 'human' || incomingRole.includes('agent') || incomingRole.includes('human')) {
                  alignedSender = 'agent';
                }

                return {
                  id: m.id || m.name || `init_msg_turn_${idx}_${Date.now()}`,
                  sender: alignedSender,
                  text: m.text || m.content || m.message || '',
                  timestamp: m.timestamp || formatIndoTime()
                };
              }).filter((m: Message) => {
                const textLower = m.text.trim().toLowerCase().replace(/[.,!]/g, '');
                return textLower !== 'hi' && textLower !== 'hello' && textLower !== 'halo';
              });

              const messagesTextLower = parsedMsgs.map((m: any) => String(m.text || '').toLowerCase()).join(" ");
              const hasHandoffKeyword = 
                messagesTextLower.includes("hubungkan ke") || 
                messagesTextLower.includes("menghubungkan ke") || 
                messagesTextLower.includes("tim spesialis") ||
                messagesTextLower.includes("spesialis transfer") ||
                messagesTextLower.includes("spesialis bank jago") ||
                messagesTextLower.includes("live agent") ||
                messagesTextLower.includes("eskalasi") ||
                messagesTextLower.includes("transfer ke agen") ||
                (messagesTextLower.includes("hubung") && messagesTextLower.includes("spesialis")) ||
                messagesTextLower.includes("customer specialist");

              const isEscalatedSignal = 
                data.isEscalated === true || 
                data.is_escalated === true || 
                data.escalated === true || 
                data.is_handoff === true ||
                data.status === 'escalated' || 
                data.state === 'escalated';

              const isEscalated = isEscalatedSignal || hasHandoffKeyword;

              if (isEscalated) {
                processedConvIdsRef.current.add(convId);

                const newConv: Conversation = {
                  id: convId,
                  customerName: "Hendi Satrio",
                  customerAvatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80",
                  email: "customer@jagoan.co.id",
                  phone: "+62 812-xxxx-xxxx",
                  accountType: "WhatsApp Live Stream Slot",
                  status: 'escalated', 
                  lastMessage: parsedMsgs[parsedMsgs.length - 1]?.text || "Eskalasi diajukan...",
                  lastMessageTime: formatIndoTime(),
                  messages: parsedMsgs,
                  assignedParticipant: `${convId}/participants/agent-real`,
                  agentAssistToken: "",
                  summary: null,
                  knowledgeSuggestions: []
                };

                if (isMounted) {
                  setConversations(prev => [newConv, ...prev.filter(c => c.id !== convId)]);
                  setSelectedConvId(convId);
                  playNotificationChime();
                }
              }
            }
          }
        }
      } catch (err) {
        console.warn("Intake channel sync exception safely bypassed: ", err);
      }
    };

    backgroundWorkerThread.onmessage = function(event) {
      if (event.data === 'TRIGGER_POLL_TICK' && isMounted) {
        pollEscalationsActiveTask();
      }
    };

    backgroundWorkerThread.postMessage('ACTIVATE_LISTENER');
    console.log("🚀 [Worker Thread Active] Discovery engine protected against background idling sleep loops completely.");

    return () => {
      isMounted = false;
      backgroundWorkerThread.postMessage('TERMINATE_LISTENER');
      backgroundWorkerThread.terminate();
    };
  }, []);

  // 2. Background escalation simulation has been removed to avoid mock noise and let real API flows populate naturally.

  // Handle human participant handshake connection (Cloud Run OR Simulation fallback)
  const handleConnectAgentSession = async (convPath: string) => {
    if (!convPath || !convPath.trim()) {
      alert("Validation Aborted: Please input a Conversation ID target path.");
      return;
    }

    if (!convPath.startsWith("projects/")) {
      alert("Format Unrecognized: Conversation string must be a fully qualified path starting with 'projects/'");
      return;
    }

    setIsProvisioning(true);
    setConnectionDetails(null);

    try {
      console.log(`Connecting to Cloud Run at: ${BACKEND_URL}/api/chat/escalate...`);
      const response = await fetch(`${BACKEND_URL}/api/chat/escalate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversation_name: convPath.trim() })
      });

      if (!response.ok) {
        throw new Error(`HTTP Core returned status ${response.status}`);
      }

      const responseData = await response.json();
      console.log("Cloud Run response successful:", responseData);

      // Successfully synced real participant
      setConnectionDetails({
        linkedThreadId: responseData.conversationName || convPath,
        participantHandle: responseData.agentParticipantName || "Assigned Human Specialist",
        token: responseData.agentAssistAccessToken || "auth_token_synchronized",
        isReal: true
      });

      // Pre-fill agent message input box as requested
      setInternalNote("Halo, saya Customer Specialist Bank Jago. Ada yang bisa saya bantu hari ini?");

      // Parse responseData.history if present
      let parsedHistory: Message[] = [];
      const rawHistory = responseData.history || responseData.messages;
      if (rawHistory && Array.isArray(rawHistory)) {
        parsedHistory = parseAndSortMessages(rawHistory);
      }

      // Parse responseData.summary if present
      let parsedSummary: ConversationSummary | null = null;
      if (responseData.summary) {
        const s = responseData.summary;
        parsedSummary = {
          date: s.date || new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric' }),
          time: s.time || formatIndoTime(),
          duration: s.duration || "05:12 min",
          situation: s.situation || s.summary || s.text || "Summary successfully fetched from Google Cloud CCAI Agent Assist.",
          action: s.action || "Agent assist captured the conversational exchange.",
          resolution: s.resolution || "Active Session Escalated",
          satisfaction: s.satisfaction || s.score || "9.0"
        };
      }

      // Update state in active row with aggregated history & summaries
      setConversations(prev => prev.map(c => {
        if (c.id === convPath) {
          const alertId = `system_conn_real_${convPath}`;
          let mergedMessages = parsedHistory.length > 0 ? parsedHistory : c.messages;

          // Check if system alert is missing and cleanly append it
          if (!mergedMessages.some((m: any) => m.id === alertId)) {
            mergedMessages = [
              ...mergedMessages,
              {
                id: alertId,
                sender: 'bot' as const,
                text: `[SYSTEM ALERT] Human Agent Seat initialized successfully. Agent Assist Copilot connected to Google Pub/Sub channel.`,
                timestamp: 'Now'
              }
            ];
          }

          return { 
            ...c, 
            status: 'active',
            messages: mergedMessages,
            summary: parsedSummary || c.summary,
            lastMessage: mergedMessages[mergedMessages.length - 1]?.text || c.lastMessage
          };
        }
        return c;
      }));

      // Synchronize state immediately to unlock visibility in the workspace card
      if (parsedSummary) {
        setGeneratedSummary(parsedSummary);
      }

    } catch (err: any) {
      console.warn("Backend connection failed. Switching to high-fidelity Sandbox Simulation session model:", err.message);
      
      // Fallback sandbox simulation
      setTimeout(() => {
        setConnectionDetails({
          linkedThreadId: convPath,
          participantHandle: `projects/ph-poc-465208/locations/asia-southeast2/conversations/.../participants/agent-${Math.floor(100+Math.random()*900)}`,
          token: `token_jagoan_sec_${Math.random().toString(36).substring(7)}`,
          isReal: false
        });

        // Pre-fill agent message input box as requested
        setInternalNote("Halo, saya Customer Specialist Bank Jago. Ada yang bisa saya bantu hari ini?");

        // Update corresponding conversation status in master state
        setConversations(prev => prev.map(c => {
          if (c.id === convPath) {
            const sandboxAlertId = `system_conn_sandbox_${convPath}`;
            const alreadyHasHandshake = c.messages.some(m => m.id === sandboxAlertId || m.text.includes("Connected to live monitoring loop") || m.text.includes("[SANDBOX Handshake]"));
            if (alreadyHasHandshake) {
              return { ...c, status: 'active' };
            }
            return {
              ...c,
              status: 'active',
              messages: [
                ...c.messages.filter((m: Message) => {
                  const textLower = m.text.trim().toLowerCase().replace(/[.,!]/g, '');
                  return textLower !== 'hi' && textLower !== 'hello' && textLower !== 'halo';
                }),
                {
                  id: sandboxAlertId,
                  sender: 'bot',
                  text: `[SANDBOX Handshake] Connected to live monitoring loop. Proactive Generative suggestions synchronized.`,
                  timestamp: 'Now'
                }
              ]
            };
          }
          return c;
        }));
      }, 1000);
    } finally {
      setIsProvisioning(false);
    }
  };

  // Manual knowledge base matching search
  const triggerKnowledgeSearch = async (query: string) => {
    if (!query || !query.trim()) return;
    
    const term = query.toLowerCase().trim();

    // Query backend for grounded search results
    if (activeConversation?.id) {
      try {
        console.log(`Searching real knowledge assist for query: ${query}`);
        const response = await fetch(`${BACKEND_URL}/api/chat/search?query=${encodeURIComponent(query)}&conversation_name=${encodeURIComponent(activeConversation.id)}`);
        if (response.ok) {
          const data = await response.json();
          const suggestions = Array.isArray(data) ? data : (data.suggestions || data.results || []);
          if (suggestions.length > 0) {
            const parsedResults = suggestions.map((s: any) => ({
              title: s.title || s.headline || "Knowledge Article",
              content: s.content || s.text || s.summary || s.snippet || "",
              category: s.category || "CCAI KB Index"
            }));
            setSearchResult(parsedResults);
            return;
          }
        }
      } catch (err) {
        console.warn("Backend search failed or unavail, using client fallback:", err);
      }
    }

    let results = JAGO_KNOWLEDGE_BASE.filter(item => 
      item.title.toLowerCase().includes(term) || 
      item.content.toLowerCase().includes(term) ||
      item.category.toLowerCase().includes(term)
    );

    if (results.length === 0) {
      const words = term.split(/\s+/);
      results = JAGO_KNOWLEDGE_BASE.filter(item => 
        words.some(w => 
          item.title.toLowerCase().includes(w) || 
          item.content.toLowerCase().includes(w) ||
          item.category.toLowerCase().includes(w)
        )
      );
    }
    
    if (results.length === 0) {
      results = [{
        title: `Informasi Mengenai "${query}"`,
        category: "AI Agent Assist Index",
        content: `Hasil pencarian untuk "${query}": Panduan khusus sedang dicatatkan oleh Admin Portal Bank Jago. Silakan hubungi Support Desk untuk detail Prosedur Standar Operasional.`
      }];
    }
    
    setSearchResult(results);
  };

  // Terminate active conversation immediately (End Conversation button)
  const handleEndConversation = () => {
    if (!activeConversation) return;

    // Reset layout connection details
    setConnectionDetails(null);
    setIsGeneratingSummary(false);

    // Set conversation status to Resolved
    setConversations(prev => prev.map(c => {
      if (c.id === activeConversation.id) {
        return {
          ...c,
          status: 'resolved',
          messages: [
            ...c.messages,
            {
              id: `system_resolve_${Date.now()}`,
              sender: 'bot',
              text: `[Session Terminated] Conversation finalized by human agent seat. Handback complete.`,
              timestamp: 'Now'
            }
          ]
        };
      }
      return c;
    }));

    // Trigger toast notification
    const resolveNotif = {
      id: `resolve_${Date.now()}`,
      customerName: activeConversation.customerName,
      message: `✓ Conversation with ${activeConversation.customerName} successfully terminated. Handback complete.`,
      timestamp: "Just Now",
      conversationId: activeConversation.id,
      type: 'system' as const
    };
    setNotifications(prev => [resolveNotif, ...prev]);
  };

  // Simulate Agent Assist smart Generative Summary function
  const startGenerativeSummary = async () => {
    setIsGeneratingSummary(true);
    setGeneratedSummary(null);
    
    const steps = [
      "Securing conversation transcript payload...",
      "Analysing Dialogflow CX intent classification...",
      "Segmenting Situation and Customer request points...",
      "Extracting action items and SLA resolution state...",
      "Finalising Agent Assist summary document..."
    ];

    let currentStepIdx = 0;
    setGenerationSteps(steps[0]);

    const interval = setInterval(() => {
      currentStepIdx++;
      if (currentStepIdx < steps.length) {
        setGenerationSteps(steps[currentStepIdx]);
      }
    }, 450);

    try {
      console.log("Requesting real agent assist summary from full-stack backend...");
      const response = await fetch(`${BACKEND_URL}/api/chat/summary`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          conversation_name: activeConversation.id,
          messages: activeConversation.messages
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data && (data.situation || data.summary)) {
          const backendSummary: ConversationSummary = {
            date: data.date || new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric' }),
            time: data.time || formatIndoTime(),
            duration: data.duration || "05:12 min",
            situation: data.situation || data.summary || "Ringkasan penjelasan berhasil dibuat oleh asisten virtual.",
            action: data.action || "Asisten merekomendasikan solusi mandiri menggunakan dokumentasi teknis.",
            resolution: data.resolution || "Y: Ya. Semua masalah dan pertanyaan nasabah berhasil diselesaikan.",
            satisfaction: data.satisfaction || "N: Nasabah netral atau memiliki perasaan positif di akhir percakapan."
          };

          clearInterval(interval);
          setConversations(prev => prev.map(c => {
            if (c.id === activeConversation.id) {
              return { ...c, summary: backendSummary };
            }
            return c;
          }));
          setGeneratedSummary(backendSummary);
          setIsGeneratingSummary(false);
          return;
        }
      }
    } catch (err: any) {
      console.warn("Could not query backend for live Agent Assist summary, using native summarizer:", err.message);
    }

    // Client-side fallback generator
    setTimeout(() => {
      clearInterval(interval);
      const sumObj = generateDynamicSummaryOfMessages(
        activeConversation.customerName,
        activeConversation.messages,
        activeConversation.status
      );

      setConversations(prev => prev.map(c => {
        if (c.id === activeConversation.id) {
          return {
            ...c,
            summary: sumObj
          };
        }
        return c;
      }));

      setGeneratedSummary(sumObj);
      setIsGeneratingSummary(false);
    }, 2400);
  };

  const handleCreateLiveSession = async () => {
    setIsCreatingSession(true);
    try {
      console.log(`Starting real chat session at: ${BACKEND_URL}/api/chat/start...`);
      const response = await fetch(`${BACKEND_URL}/api/chat/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP Core returned status ${response.status}`);
      }

      const responseData = await response.json();
      console.log("Chat start successful:", responseData);

      const uniqueId = responseData.conversationName;
      if (!uniqueId) {
        throw new Error("No conversationName returned from backend.");
      }

      const shortConvId = uniqueId.split('/').pop() || 'session';
      const newConv: Conversation = {
        id: uniqueId,
        customerName: `Live Test ${shortConvId.substring(0, 6)}`,
        customerAvatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80",
        email: "live.test@jago.co.id",
        phone: "+62 812-999-999",
        accountType: "CCAI Live Integration Tab",
        status: 'monitoring',
        lastMessage: "Sesi CCAI live terbuat di backend. Anda bisa 'Join Chat' sekarang.",
        lastMessageTime: formatIndoTime(),
        messages: [
          {
            id: `sys_start_${Date.now()}`,
            sender: 'bot' as const,
            text: `Sesi baru berhasil diinisialisasi oleh backend. ID Percakapan: ${uniqueId}. Klik 'Join Chat' di atas setelah Anda siap mengambil alih percakapan dari bot.`,
            timestamp: 'Just Now'
          }
        ],
        assignedParticipant: "",
        agentAssistToken: "",
        customerParticipantName: responseData.customerParticipantName,
        summary: null,
        knowledgeSuggestions: [
          {
            title: "Prosedur Hubung Live Agent Jago",
            content: "Klik tombol 'Join Chat' di atas untuk menyambungkan Human Agent ke percakapan Dialogflow CX.",
            source: "CRM Integration Guide",
            confidence: 0.99
          }
        ]
      };

      setConversations(prev => [newConv, ...prev]);
      setSelectedConvId(newConv.id);
      playNotificationChime();

      // Automatically join the session to mount viewport instantly
      setTimeout(() => {
        handleConnectAgentSession(uniqueId);
      }, 100);

    } catch (err: any) {
      console.warn("Backend /api/chat/start call failed. Simulating local sandbox:", err.message);
      const mockConvId = `projects/ph-poc-465208/locations/asia-southeast2/conversations/conv-sandbox-${Math.floor(1000 + Math.random() * 9000)}`;
      const newConv: Conversation = {
        id: mockConvId,
        customerName: `Live Sandbox ${mockConvId.split('-').pop()}`,
        customerAvatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80",
        email: "sandbox.test@jago.co.id",
        phone: "+62 812-999-999",
        accountType: "Sandbox Emulator",
        status: 'monitoring',
        lastMessage: "Sesi lokal baru terbuat (fallback sandbox).",
        lastMessageTime: formatIndoTime(),
        messages: [
          {
            id: `sys_start_${Date.now()}`,
            sender: 'bot' as const,
            text: `[SANDBOX Fallback] Sesi lokal diaktifkan karena backend offline. ID Percakapan: ${mockConvId}`,
            timestamp: 'Just Now'
          }
        ],
        assignedParticipant: "",
        agentAssistToken: "",
        customerParticipantName: `${mockConvId}/participants/customer-real`,
        summary: null,
        knowledgeSuggestions: [
          {
            title: "Prosedur Sandbox Hubung Agent",
            content: "Klik tombol 'Join Chat' di atas untuk menyambungkan Human Agent ke percakapan Dialogflow CX.",
            source: "CRM Sandbox Guide",
            confidence: 0.99
          }
        ]
      };
      setConversations(prev => [newConv, ...prev]);
      setSelectedConvId(newConv.id);
      playNotificationChime();

      // Automatically join the sandbox session to mount viewport instantly
      setTimeout(() => {
        handleConnectAgentSession(mockConvId);
      }, 100);
    } finally {
      setIsCreatingSession(false);
    }
  };

  // ─── 🟢 FIXED HUMAN SPECIALIST MESSAGE SUBMISSION HANDLER ───
  const submitInternalNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!internalNote || !internalNote.trim()) return;
    if (!activeConversation) return;

    const textValue = internalNote.trim();
    setInternalNote("");

    // Fix 1: Use a clean sequential index layout number so parseAndSortMessages won't break on sorting math
    const uniqueMsgIndexId = `agent_note_turn_${activeConversation.messages.length + 1}`;
    const newMsg: Message = {
      id: uniqueMsgIndexId,
      sender: 'agent',
      text: textValue,
      timestamp: formatIndoTime()
    };

    // Append directly to the local active chat window viewport timeline
    setConversations(prev => prev.map(c => {
      if (c.id === activeConversation.id) {
        return {
          ...c,
          lastMessage: textValue,
          messages: [...c.messages, newMsg]
        };
      }
      return c;
    }));

    // Fix 2: Bypass connectionDetails runtime delays and build the target path explicitly from the active conversation id parameters
    try {
      const activeThreadIdPath = activeConversation.id;
      const explicitParticipantPath = `${activeThreadIdPath}/participants/agent-real`;

      console.log(`🚀 [CRM Outbound dispatch] Routing operator text turn: ${textValue}`);
      await fetch(`${BACKEND_URL}/api/chat/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participant_name: explicitParticipantPath, // 🟢 Aligned directly to main.py cache ledgers!
          text: textValue
        })
      });
    } catch (err) {
      console.warn("Live agent message transit exception: ", err);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-[#F8FAFC] font-sans text-slate-800 border-8 border-[#FECC2F] overflow-hidden">
      
      {/* 1. MOCK CRM HEADER IN JAGO BRIGHT YELLOW & WHITE CONTRAST */}
      <header className="flex items-center justify-between px-6 h-16 bg-[#FECC2F] border-b border-amber-400 shrink-0 sticky top-0 z-20 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="relative">
            <img 
              src="https://cloud-icons.onemodel.app/gcp/agent_assist/agent_assist.png" 
              className="h-9 w-9 object-contain p-1 bg-white border border-[#FECC2F]/20 rounded-lg shadow" 
              alt="Google Agent Assist"
              referrerPolicy="no-referrer"
            />
            <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-emerald-500 border-2 border-[#FECC2F] rounded-full shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
          </div>
          <div>
            <h1 className="text-slate-900 font-extrabold text-base leading-none flex items-center gap-2">
              Agent Assist
            </h1>
            <p className="text-[10px] text-slate-700 font-semibold uppercase tracking-wider">Enterprise CX Workspace</p>
          </div>
        </div>

        {/* Clean header space */}
      </header>

      {/* 2. REAL-TIME MULTIPLE CONVERSATION PENDING ALERTS */}
      {notifications.length > 0 && (
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 overflow-hidden">
            <div className="flex items-center justify-center p-1.5 bg-amber-100 text-amber-700 rounded border border-amber-200 shadow-sm">
              <AlertCircle className="w-4 h-4" />
            </div>
            <p className="text-xs font-semibold text-amber-900 truncate">
              {notifications[0].message}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button 
              onClick={async () => {
                setSelectedConvId(notifications[0].conversationId);
                // Explicitly trigger human takeover so status is changed to active
                await handleConnectAgentSession(notifications[0].conversationId);
                // Clear notification on click
                setNotifications(prev => prev.filter(n => n.id !== notifications[0].id));
              }}
              className="bg-[#FECC2F] hover:bg-[#ebbd23] text-slate-900 text-xs font-semibold px-4 py-2 rounded uppercase tracking-tighter transition-colors cursor-pointer"
            >
              Take Over
            </button>
            <button 
              onClick={() => setNotifications([])}
              className="p-1 hover:bg-amber-100 rounded text-amber-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 3. CORE SPLIT SCREEN LAYOUT */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* LEFT COLUMN: ACTIVE PIPELINE & INTAKE CONVERSATIONS MAPPING */}
        <section className="w-80 border-r border-slate-200 bg-white flex flex-col shrink-0 overflow-y-auto">
          <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 sticky top-0 z-10 gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between mb-1 gap-1">
                <h2 className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider flex items-center gap-1 min-w-0">
                  <Radio className="w-3 h-3 text-rose-500 shrink-0" />
                  <span className="truncate">Live Pipeline</span>
                </h2>
                <span className="bg-[#FECC2F] text-slate-900 border border-amber-300 text-[9px] px-1.5 py-0.2 rounded-full font-bold shrink-0">
                  {conversations.length}
                </span>
              </div>
            </div>
          </div>

          {/* Conversation List Rows */}
          <div className="flex-1 divide-y divide-slate-150 overflow-y-auto">
            {conversations.map((conv) => {
              const isSelected = conv.id === selectedConvId;
              const hasAlert = conv.status === 'escalated';
              
              return (
                <div 
                  key={conv.id}
                  onClick={() => setSelectedConvId(conv.id)}
                  className={`p-4 cursor-pointer relative transition-all duration-200 border-b border-slate-100 group ${
                    isSelected 
                      ? 'border-l-4 border-amber-400 bg-amber-500/5' 
                      : 'hover:bg-slate-50/60 border-l-4 border-transparent'
                  } ${hasAlert ? 'bg-amber-500/5' : ''}`}
                >
                  {/* Elegant static alert for escalated items */}
                  {hasAlert && (
                    <div className="absolute top-3 right-3 flex items-center gap-1 bg-rose-50 text-rose-600 border border-rose-200 text-[10px] px-1.5 py-0.5 rounded font-bold font-mono">
                      <span className="w-1.5 h-1.5 bg-rose-500 rounded-full" />
                      HANDOFF
                    </div>
                  )}

                  <div className="flex gap-3">
                    <div className={`w-10 h-10 rounded-full border flex items-center justify-center text-xs font-bold font-mono shrink-0 select-none transition-colors duration-200 ${
                      isSelected 
                        ? 'bg-[#FECC2F] text-slate-900 border-amber-400 shadow-sm' 
                        : 'bg-amber-50 text-slate-700 border-amber-200/40'
                    }`}>
                      {getInitials(conv.customerName)}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-baseline">
                        <span className="text-xs font-bold text-slate-800 truncate">
                          {conv.customerName}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {conv.lastMessageTime}
                        </span>
                      </div>
                      
                      <p className="text-[11px] text-slate-600 truncate mt-0.5">
                        {conv.lastMessage}
                      </p>

                      <div className="flex items-center gap-1.5 mt-2">
                        {/* Status chip */}
                        {conv.status === 'monitoring' && (
                          <span className="text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-bold font-mono border border-slate-200/60">
                            🤖 Monitoring
                          </span>
                        )}
                        {conv.status === 'escalated' && (
                          <span className="text-[9px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-bold font-mono border border-amber-200">
                            🟠 Handoff proposed
                          </span>
                        )}
                        {conv.status === 'active' && (
                          <span className="text-[9px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-bold font-mono border border-emerald-200/80">
                            🟢 Live Connected
                          </span>
                        )}
                        {conv.status === 'resolved' && (
                          <span className="text-[9px] bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded font-bold font-mono line-through border border-slate-200/60">
                            ✓ Handback Completed
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* MIDDLE COLUMN: ACTIVE CHROMIUM CHAT MONITOR & CRM HANDSHAKE HANDS */}
        <section className="flex-1 bg-slate-50 flex flex-col overflow-hidden">
          
          {/* Active Intake Information details */}
          <div className="p-4 bg-white border-b border-slate-200 flex flex-col gap-3 shadow-sm">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-extrabold text-slate-800">
                  Conversation Monitor Zone
                </h3>
              </div>

              {/* Handback terminating button when active */}
              {activeConversation.status === 'active' && (
                <button
                  onClick={handleEndConversation}
                  className="px-4 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-xs font-bold transition-all shadow-md flex items-center gap-1.5 ml-auto cursor-pointer uppercase tracking-tighter"
                >
                  <X className="w-3.5 h-3.5" />
                  End Conversation
                </button>
              )}
            </div>

            {/* High-Fidelity 3-State Conversation Monitor Banner */}
            {activeConversation.status === 'monitoring' && (
              <div className="p-3.5 bg-slate-100 border border-slate-200 rounded-xl text-xs text-slate-600 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-slate-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-slate-400"></span>
                  </span>
                  <span className="font-semibold text-slate-700">🤖 Virtual Assistant Monitoring: Tanya Jago chatbot is currently handling the session.</span>
                </div>
                <span className="text-[9px] bg-slate-200 border border-slate-300 px-2 py-0.5 rounded font-extrabold uppercase text-slate-600 font-mono">
                  BOT ACTIVE
                </span>
              </div>
            )}

            {activeConversation.status === 'escalated' && (
              <div className="p-3.5 bg-amber-50 border border-amber-200/70 rounded-xl text-xs text-amber-950 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2.5 w-2.5 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-500 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
                  </span>
                  <span className="font-bold text-amber-950">⚠️ Eskalasi Handoff Diusulkan: Klik "Take Over" untuk mengambil alih percakapan ini ke Live Human Seat.</span>
                </div>
                <button
                  onClick={() => handleConnectAgentSession(activeConversation.id)}
                  disabled={isProvisioning}
                  className="bg-[#FECC2F] hover:bg-[#ebbd23] text-slate-900 border border-amber-400 text-[10px] px-3 py-1.5 rounded-lg font-bold uppercase tracking-tight shadow-sm transition-all focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer disabled:opacity-50"
                >
                  {isProvisioning ? "Connecting..." : "Take Over"}
                </button>
              </div>
            )}

            {activeConversation.status === 'active' && (
              <div className="p-3.5 bg-emerald-50 border border-emerald-150 rounded-xl text-xs text-emerald-900 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="font-bold text-emerald-950">✓ Connected to live chat session: Instant Human Seat successfully synchronized.</span>
                </div>
                <span className="text-[9px] bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded font-extrabold uppercase text-emerald-800 font-mono">
                  LIVE SEAT ACTIVE
                </span>
              </div>
            )}
          </div>

          {/* REAL TIME CONVERSATION TRANSCRIPT VIEWER */}
          <div ref={messagesContainerRef} className="flex-1 p-6 overflow-y-auto space-y-4">
            
            {activeConversation.messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3 text-slate-400">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-widest mb-1.5 flex items-center gap-1.5 justify-center">
                  💬 Belum ada pesan
                </h4>
                <p className="text-[11px] text-slate-500 max-w-sm leading-relaxed">
                  Percakapan ini sedang tersambung. Mengambil riwayat pesan dari asisten virtual...
                </p>
              </div>
            ) : (
              activeConversation.messages.map((msg, idx) => {
                if (msg.text.includes("[SYSTEM") || msg.text.includes("[SANDBOX")) {
                  return (
                    <div key={msg.id} className="flex justify-center py-1.5">
                      <div className="px-3 py-1 bg-[#4AE54A]/10 border border-[#4AE54A]/30 rounded text-[10px] text-emerald-800 font-mono flex items-center gap-1 shadow-sm">
                        <span className="w-1.5 h-1.5 bg-[#4AE54A] rounded-full mr-1" />
                        {msg.text}
                      </div>
                    </div>
                  );
                }

                const isCustomer = msg.sender === 'customer';
                const isAgent = msg.sender === 'agent';
                const isBot = msg.sender === 'bot';

                return (
                  <div key={msg.id} className={`flex gap-3 items-end ${isCustomer ? '' : 'flex-row-reverse'}`}>
                    
                    {/* Sender Avatar */}
                    <div className="shrink-0 mb-1">
                      {isCustomer ? (
                        <div className="w-8 h-8 rounded-full bg-amber-50 text-slate-800 border border-amber-200/50 flex items-center justify-center text-[10px] font-extrabold font-mono shadow-sm select-none">
                          {getInitials(activeConversation.customerName)}
                        </div>
                      ) : isBot ? (
                        <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200/60 flex items-center justify-center shadow-sm">
                          <Bot className="w-4 h-4 text-slate-650" />
                        </div>
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-[#FECC2F] border border-amber-300/60 flex items-center justify-center text-[10px] font-extrabold text-slate-900 font-mono shadow-sm">
                          ME
                        </div>
                      )}
                    </div>

                    {/* Message Bubble container */}
                    <div className="max-w-[70%]">
                      <div className={`p-3 rounded-2xl text-xs leading-relaxed shadow-sm ${
                        isCustomer 
                          ? 'bg-white text-slate-800 border border-slate-200 rounded-tl-none' 
                          : isBot
                            ? 'bg-slate-100/90 text-slate-700 border border-slate-200 rounded-tr-none'
                            : 'bg-amber-100/30 text-slate-900 border border-amber-200/60 rounded-tr-none'
                      }`}>
                        <p>{msg.text}</p>
                      </div>
                      {/* Timestamp signature details */}
                      <p className={`text-[9px] text-slate-400 font-medium mt-1 uppercase tracking-wider ${isCustomer ? 'text-left' : 'text-right'}`}>
                        {isCustomer ? activeConversation.customerName : isBot ? "Sistem Bot Jago" : "Live Agent"} • {msg.timestamp}
                      </p>
                    </div>

                  </div>
                );
              })
            )}
          </div>

          {/* CRM Internal Agent Note & Action Input Field */}
          {activeConversation.status === 'escalated' ? (
            <div className="p-4 bg-amber-50/95 border-t border-amber-200 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-md">
              <div className="flex items-center gap-2.5">
                <span className="relative flex h-3 w-3 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-500 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
                </span>
                <div className="text-left">
                  <p className="text-xs font-bold text-amber-950">Eskalasi Terdeteksi!</p>
                  <p className="text-[11px] text-amber-800 font-medium">
                    Asisten Virtual mengusulkan pengalihan sesi ke Live Specialist untuk {activeConversation.customerName}.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleConnectAgentSession(activeConversation.id)}
                disabled={isProvisioning}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 bg-[#FECC2F] hover:bg-[#ebbd23] text-slate-900 border border-amber-400 text-xs px-5 py-2.5 rounded-xl font-bold uppercase tracking-wider shadow-sm hover:shadow-md transition-all cursor-pointer disabled:opacity-50"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping mr-1" />
                {isProvisioning ? "Connecting..." : "Take Over / Join Chat"}
              </button>
            </div>
          ) : activeConversation.status === 'monitoring' ? (
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm">
              <div className="flex items-center gap-2.5">
                <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse shrink-0" />
                <div className="text-left">
                  <p className="text-xs font-bold text-indigo-950 flex items-center gap-1">
                    🤖 Tanya Jago Virtual Assistant Aktif
                  </p>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Asisten Virtual sedang berinteraksi secara mandiri dengan {activeConversation.customerName}. Sesuai kebijakan privasi, perwakilan manusia hanya dapat bergabung setelah sistem secara resmi mengidentifikasi eskalasi/handoff.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-white border-t border-slate-200 shadow pb-5">
              <form onSubmit={submitInternalNote} className="flex gap-2">
                <input 
                  type="text"
                  value={internalNote}
                  disabled={!connectionDetails}
                  onChange={(e) => setInternalNote(e.target.value)}
                  placeholder={
                    connectionDetails ? "Ketik balasan untuk nasabah (Live Agent)..." : "⚠️ Agent Assist akan menyambung otomatis begitu sesi terdeteksi..."
                  }
                  className="flex-1 bg-slate-50 disabled:bg-slate-100 border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-800 outline-none focus:ring-1 focus:ring-amber-400 transition-all placeholder-slate-400 font-medium disabled:cursor-not-allowed"
                />
                <button 
                  type="submit"
                  disabled={!connectionDetails || !internalNote.trim()}
                  className="bg-[#FECC2F] hover:bg-[#FECC2F]/90 text-slate-900 disabled:bg-slate-100 disabled:text-slate-400 font-bold flex items-center justify-center rounded-xl px-4 py-3 text-xs transition-all shadow-sm border border-amber-400/20 disabled:cursor-not-allowed select-none"
                >
                  Send <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                </button>
              </form>
            </div>
          )}

        </section>

        {/* RIGHT COLUMN: REFACTORED WORKSPACE DISPLAY MATCHING SCREENSHOT */}
        <section className="w-[450px] border-l border-slate-200 bg-[#F1F5F9] flex flex-col shrink-0 overflow-hidden">
          
          {/* 🟢 Keep this layout div container permanently mounted to prevent React state race conditions */}
          <div className="hidden" aria-hidden="true text-transparent">
            <div ref={googleModuleRef} id="google-shadow-root-container" />
          </div>

          {/* ALWAYS SHOW POLISHED SMART ASSIST */}
          <div className="flex-1 flex flex-col overflow-hidden">
              
              {/* Outer Scroll Container for Floating Workspace Cards */}
              <div className="flex-1 p-4 space-y-4 overflow-y-auto">
                
                {/* CARD 1: EXTREMELY POLISHED GENERATIVE SUMMARIZATION ASYNC ENGINE */}
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
                  
                  {/* Card Header */}
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span className="bg-[#ECE2FE] text-[#5B21B6] border border-violet-200 text-[10px] uppercase font-mono tracking-wider font-extrabold px-2.5 py-0.5 rounded">
                        Summary
                      </span>
                    </div>
                    
                    {/* Action icons on right */}
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={handleCopySummary}
                        disabled={!generatedSummary}
                        title={isSummaryCopied ? "Copied!" : "Copy to Clipboard"}
                        className={`p-1.5 rounded-lg transition-colors border ${
                          isSummaryCopied 
                            ? 'bg-emerald-50 text-emerald-600 border-emerald-250' 
                            : 'hover:bg-slate-50 text-slate-400 hover:text-slate-600 border-transparent'
                        }`}
                      >
                        {isSummaryCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>

                      <button 
                        onClick={startGenerativeSummary}
                        disabled={isGeneratingSummary || activeConversation.status === 'resolved'}
                        title="Regenerate"
                        className="p-1.5 rounded-lg hover:bg-slate-50 text-slate-400 hover:text-slate-600 border border-transparent transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>

                      <button 
                        onClick={() => setIsSummaryExpanded(!isSummaryExpanded)}
                        className="p-1.5 rounded-lg hover:bg-slate-50 text-slate-400 hover:text-slate-600 border border-transparent transition-colors"
                      >
                        {isSummaryExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  {/* Body container (collapsible) */}
                  {isSummaryExpanded && (
                    <div className="pt-1">
                      {isGeneratingSummary && (
                        <div className="border border-amber-200/80 bg-amber-50/20 rounded-lg p-4 text-xs space-y-2.5 shadow-sm animate-none">
                          <div className="flex items-center gap-2">
                            <div className="w-3.5 h-3.5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                            <span className="font-bold text-amber-900 font-mono tracking-tight">AI Engine processing transcript...</span>
                          </div>
                          <p className="text-[11px] text-slate-500 font-mono leading-none">{generationSteps}</p>
                          <div className="w-full bg-slate-200 h-1 rounded-full overflow-hidden">
                            <div className="bg-amber-400 h-1 rounded-full animate-pulse w-4/5" />
                          </div>
                        </div>
                      )}

                      {generatedSummary && !isGeneratingSummary && (
                        <div className="space-y-3 pt-1 text-[11px] leading-relaxed">
                          <div className="grid grid-cols-[140px_1fr] border-b border-slate-100 pb-2 gap-2">
                            <span className="font-bold text-slate-400 uppercase tracking-wider font-mono">Date</span>
                            <span className="text-slate-700 font-medium text-right md:text-left">{generatedSummary.date}</span>
                          </div>
                          <div className="grid grid-cols-[140px_1fr] border-b border-slate-100 pb-2 gap-2">
                            <span className="font-bold text-slate-400 uppercase tracking-wider font-mono">Time</span>
                            <span className="text-slate-700 font-medium text-right md:text-left">{generatedSummary.time}</span>
                          </div>
                          <div className="grid grid-cols-[140px_1fr] border-b border-slate-100 pb-2 gap-2">
                            <span className="font-bold text-slate-400 uppercase tracking-wider font-mono">Duration</span>
                            <span className="text-slate-700 font-medium text-right md:text-left">{generatedSummary.duration}</span>
                          </div>
                          <div className="grid grid-cols-[140px_1fr] border-b border-slate-100 pb-3 gap-2">
                            <span className="font-bold text-slate-400 uppercase tracking-wider font-mono">Situation</span>
                            <span className="text-slate-700 font-sans font-medium text-left leading-relaxed">{generatedSummary.situation}</span>
                          </div>
                          <div className="grid grid-cols-[140px_1fr] border-b border-slate-100 pb-3 gap-2">
                            <span className="font-bold text-slate-400 uppercase tracking-wider font-mono">Action</span>
                            <span className="text-slate-700 font-sans font-medium text-left leading-relaxed">{generatedSummary.action}</span>
                          </div>
                          <div className="grid grid-cols-[140px_1fr] border-b border-slate-100 pb-2 gap-2">
                            <span className="font-bold text-slate-400 uppercase tracking-wider font-mono">Resolution</span>
                            <span className="text-slate-800 font-bold font-mono text-right md:text-left">{generatedSummary.resolution}</span>
                          </div>
                          <div className="grid grid-cols-[140px_1fr] gap-2">
                            <span className="font-bold text-slate-400 uppercase tracking-wider font-mono">Customer satisfaction</span>
                            <span className="text-slate-800 font-bold font-mono text-right md:text-left">{generatedSummary.satisfaction}</span>
                          </div>
                        </div>
                      )}

                      {!generatedSummary && !isGeneratingSummary && (
                        <div className="bg-slate-50 border border-dashed border-slate-200 p-5 rounded-xl text-center text-xs text-slate-400">
                          No summary loaded. Choose a pipeline row or click "Generate summary" at the bottom to trigger.
                        </div>
                      )}
                    </div>
                  )}

                </div>

                {/* CARD 2: PROACTIVE GENERATIVE KNOWLEDGE ASSIST CHIPS */}
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
                  
                  {/* Card Header with Green Badge */}
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="bg-[#D1FAE5] text-[#065F46] border border-emerald-250 text-[10px] uppercase font-mono tracking-wider font-extrabold px-2.5 py-0.5 rounded shrink-0">
                        Knowledge
                      </span>
                      <span className="text-[11px] text-slate-500 font-medium truncate italic pr-1">
                        {proactiveSuggestions.length > 0 
                          ? `Context-aware assistance (${proactiveSuggestions.length} found)` 
                          : "Awaiting real-time conversation..."
                        }
                      </span>
                    </div>

                    {/* Action icons on right */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button 
                        onClick={handleCopyKnowledge}
                        title={isKnowledgeCopied ? "Copied!" : "Copy Solutions"}
                        className={`p-1.5 rounded-lg transition-colors border ${
                          isKnowledgeCopied 
                            ? 'bg-emerald-50 text-emerald-600 border-emerald-250' 
                            : 'hover:bg-slate-50 text-slate-400 hover:text-slate-600 border-transparent'
                        }`}
                      >
                        {isKnowledgeCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>

                      <button 
                        onClick={() => {}} 
                        title="Useful Helpful"
                        className="p-1.5 rounded-lg hover:bg-slate-50 text-slate-400 hover:text-slate-600 border border-transparent transition-colors"
                      >
                        <ThumbsUp className="w-3.5 h-3.5" />
                      </button>

                      <button 
                        onClick={() => setIsKnowledgeExpanded(!isKnowledgeExpanded)}
                        className="p-1.5 rounded-lg hover:bg-slate-50 text-slate-400 hover:text-slate-600 border border-transparent transition-colors"
                      >
                        {isKnowledgeExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  {/* Body container (collapsible) */}
                  {isKnowledgeExpanded && (
                    <div className="space-y-3 pt-1">
                      
                      {/* Interactive Search lists inline if searched */}
                      {searchResult.length > 0 && (
                        <div className="bg-amber-50 border border-amber-200/80 rounded-xl p-3 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-amber-800 uppercase font-mono tracking-widest flex items-center gap-1">
                              <span>🔍 Found Knowledge ({searchResult.length})</span>
                            </span>
                            <button 
                              onClick={() => setSearchResult([])} 
                              className="text-[10px] text-slate-400 hover:text-slate-600 font-mono underline"
                            >
                              Clear
                            </button>
                          </div>
                          <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                            {searchResult.map((res, idx) => (
                              <div key={idx} className="bg-white border border-slate-200 rounded-lg p-2.5 text-xs space-y-1.5 shadow-sm">
                                <div className="flex justify-between items-center border-b border-slate-100 pb-1">
                                  <span className="font-bold text-slate-800 text-[11px]">{res.title}</span>
                                  <span className="text-[8px] bg-slate-100 text-slate-500 font-bold border px-1.5 py-0.5 rounded">
                                    {res.category}
                                  </span>
                                </div>
                                <p className="text-slate-600 text-[11px] leading-relaxed">{res.content}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Default reactive suggestions */}
                      <div className="space-y-3">
                        {proactiveSuggestions.map((sug, idx) => (
                          <div 
                            key={idx} 
                            className="bg-slate-50 hover:bg-amber-100/10 border border-slate-200 hover:border-amber-400/40 rounded-xl p-3.5 transition-colors shadow-none duration-150 relative space-y-1.5"
                          >
                            <div className="flex justify-between items-center bg-white px-2 py-1 rounded border border-slate-100">
                              <span className="font-bold text-slate-800 text-[11px] truncate pr-1">{sug.title}</span>
                              <span className="text-[9px] font-mono bg-emerald-50 text-emerald-700 border border-[#4AE54A]/30 font-extrabold px-1.5 py-0.5 rounded shrink-0">
                                Match {(sug.confidence * 100).toFixed(0)}%
                              </span>
                            </div>
                            <p className="text-slate-600 text-[11px] leading-relaxed">{sug.content}</p>
                            <div className="flex justify-between items-center pt-2 border-t border-slate-200/50 text-[9px] text-slate-400 font-mono">
                              <span>Source: {sug.source}</span>
                              <span className="text-emerald-750 font-bold uppercase tracking-wider">Suggested</span>
                            </div>
                          </div>
                        ))}
                      </div>

                    </div>
                  )}

                </div>

              </div>

              {/* Inline slides search drawer toggled by Search knowledge */}
              {isSearchVisible && (
                <div className="bg-white border-t border-slate-200 p-4 shrink-0 shadow-2xl relative space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider font-mono">
                      Jago Multi-Category Knowledge Base Search
                    </label>
                    <button 
                      onClick={() => setIsSearchVisible(false)} 
                      className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <input 
                      type="text"
                      value={knowledgeSearchQuery}
                      onChange={(e) => setKnowledgeSearchQuery(e.target.value)}
                      placeholder="Search Jago BI-FAST limit, pocket comparison, fees, gopay..."
                      className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 outline-none focus:ring-1 focus:ring-amber-400 transition-all"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') triggerKnowledgeSearch(knowledgeSearchQuery);
                      }}
                    />
                    <button 
                      onClick={() => triggerKnowledgeSearch(knowledgeSearchQuery)}
                      className="px-4 py-2 bg-[#FECC2F] hover:bg-[#ebbd23] text-slate-900 text-xs font-bold rounded-lg transition-colors cursor-pointer border-none"
                    >
                      Search
                    </button>
                  </div>
                </div>
              )}

              {/* STICKY FOOTER ACTION STRIP - EXACT MATCH WITH PILLS SCREENSHOT */}
              <div className="bg-slate-200 p-4 border-t border-slate-300 shrink-0 flex items-center justify-center gap-4 animate-none">
                
                {/* Generate summary pill button */}
                <button
                  onClick={startGenerativeSummary}
                  disabled={isGeneratingSummary || activeConversation.status === 'resolved'}
                  className="flex items-center gap-2 px-5 py-2.5 bg-white hover:bg-slate-50 border border-amber-250/60 hover:border-amber-400 text-amber-900 text-xs font-bold rounded-full shadow-sm hover:shadow active:scale-95 transition-all cursor-pointer uppercase tracking-wider"
                >
                  <FileText className="w-3.5 h-3.5 text-amber-700" />
                  Generate summary
                </button>

                {/* Search knowledge pill button */}
                <button
                  onClick={() => {
                    setIsSearchVisible(!isSearchVisible);
                    handleProactiveKnowledgeTrigger();
                  }}
                  className={`flex items-center gap-2 px-5 py-2.5 border text-xs font-bold rounded-full shadow-sm hover:shadow active:scale-95 transition-all cursor-pointer uppercase tracking-wider ${
                    isSearchVisible 
                      ? 'bg-[#FECC2F] text-slate-900 border-[#FECC2F]' 
                      : 'bg-white hover:bg-slate-50 border-amber-250/60 hover:border-amber-400 text-amber-900'
                  }`}
                >
                  <Search className="w-3.5 h-3.5" />
                  Search knowledge
                </button>

              </div>

            </div>

        </section>

      </div>

    </div>
  );
}
