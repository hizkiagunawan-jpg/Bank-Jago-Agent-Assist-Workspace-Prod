export interface Message {
  id: string;
  sender: 'customer' | 'agent' | 'bot';
  text: string;
  timestamp: string;
}

export interface ConversationSummary {
  date: string;
  time: string;
  duration: string;
  situation: string;
  action: string;
  resolution: string;
  satisfaction: string;
}

export interface KnowledgeSuggestion {
  title: string;
  content: string;
  source: string;
  confidence: number;
}

export interface Conversation {
  id: string;
  customerName: string;
  customerAvatar: string;
  email: string;
  phone: string;
  accountType: string;
  status: 'monitoring' | 'escalated' | 'active' | 'resolved';
  lastMessage: string;
  lastMessageTime: string;
  messages: Message[];
  assignedParticipant: string;
  agentAssistToken: string;
  summary: ConversationSummary | null;
  knowledgeSuggestions: KnowledgeSuggestion[];
  customerParticipantName?: string;
}

export interface KnowledgeArticle {
  title: string;
  category: string;
  content: string;
}
