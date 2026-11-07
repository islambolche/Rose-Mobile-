export type GeminiProfileType = "free" | "paid";

export type ConnectionStatus = "not_configured" | "testing" | "connected" | "error";

export type VerificationStatus =
  | "NOT CONFIGURED"
  | "SAVING"
  | "VERIFYING"
  | "VERIFIED"
  | "INVALID KEY"
  | "CONNECTION ERROR"
  | "QUOTA EXCEEDED"
  | "BILLING ISSUE"
  | "VERIFICATION EXPIRED";

export interface GeminiApiProfile {
  key?: string; // transient during entry, masked/omitted from client storage
  maskedKey?: string;
  hasKey?: boolean;
  status: ConnectionStatus;
  verificationStatus: VerificationStatus;
  lastTested: string | null;
  lastError: string | null;
  errorCategory: string | null;
  model: string;
  callsCount: number;
  quotaLimit: string;
  billingStatus: string;
  estimatedCost: string;
}

export interface ExtraApiKey {
  id: string;
  name: string;
  key: string;
}

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

export interface BusinessProfile {
  businessName: string;
  category?: string;
  contactEmail?: string;
  contactPhone?: string;
  address: string;
  operatingHours?: string;
  supportedCurrencies?: string[];
  timeZone?: string;
  defaultLanguage?: string;
  customerSupportPolicy?: string;
  deliveryPolicy?: string;
  refundPolicy?: string;
  ownerName?: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  website?: string;
  facebook?: string;
  hours?: string;
  about?: string;
  products?: string;
  policies?: string;
  replyStyle?: string;
  [key: string]: any;
}

export interface AgentInfo {
  id: "rose" | "mira" | "arin" | "zayan" | "naira";
  name: string;
  title: string;
  roleDescription: string;
  status: "active" | "idle" | "busy" | "restricted";
  responsibilities: string[];
  permissions: string[];
  autoApprovedActions: string[];
  lastReport: string;
  tasksHandledToday: number;
}

export interface CustomerMessage {
  id: string;
  customerName: string;
  customerPhone?: string;
  platform: "WhatsApp" | "Messenger" | "Web Chat" | "Instagram";
  message: string;
  timestamp: string;
  status: "pending" | "replied" | "escalated";
  assignedAgent: string;
  replyText?: string;
  isComplaint?: boolean;
}

export interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
}

export interface BusinessOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  phone: string;
  items: OrderItem[];
  totalAmount: number;
  currency: string;
  paymentStatus: "paid" | "pending" | "failed";
  deliveryStatus: "processing" | "shipped" | "delivered" | "delayed" | "returned";
  trackingNumber: string;
  courierName: string;
  createdAt: string;
  needsApproval?: boolean;
}

export interface ParcelTracking {
  trackingNumber: string;
  orderNumber: string;
  recipientName: string;
  courier: string;
  status: "in_transit" | "out_for_delivery" | "delivered" | "delayed" | "returned";
  origin: string;
  destination: string;
  lastLocation: string;
  estimatedDelivery: string;
  lastUpdate: string;
  issueNote?: string;
}

export interface AutomationRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  agentId: "rose" | "mira" | "arin" | "zayan" | "naira";
  requiresOwnerApproval: boolean;
  actionType: "reply_message" | "confirm_order" | "track_parcel" | "audit_finance" | "refund" | "price_change";
}

export interface ActivityLog {
  id: string;
  timestamp: string;
  agentId: string;
  action: string;
  details: string;
  status: "success" | "pending_approval" | "approved" | "rejected" | "error";
  performedBy: string;
}

export interface SharedBusinessDatabase {
  version: number;
  lastSyncedAt: string;
  syncStatus: "synced" | "syncing" | "offline" | "error";
  syncError?: string;
  activeGeminiProfile: GeminiProfileType;
  geminiProfiles: {
    free: GeminiApiProfile;
    paid: GeminiApiProfile;
  };
  groq: {
    keys: string;
    hasKeys: boolean;
    maskedKeys: string;
    status: ConnectionStatus;
    verificationStatus: VerificationStatus;
    lastTested: string | null;
  };
  otherKeys: ExtraApiKey[];
  metaAccessToken: string;
  firebaseConfig: FirebaseConfig;
  businessProfile: BusinessProfile;
  agents: Record<string, AgentInfo>;
  messages: CustomerMessage[];
  orders: BusinessOrder[];
  parcels: ParcelTracking[];
  automationRules: AutomationRule[];
  activityLogs: ActivityLog[];
}

export const INITIAL_BUSINESS_PROFILE: BusinessProfile = {
  businessName: "Rose AI Enterprise & Commerce",
  category: "E-Commerce & Digital Services",
  contactEmail: "md.yousuf.khan060@gmail.com",
  contactPhone: "+8801671060679",
  address: "Dhaka, Bangladesh",
  operatingHours: "9:00 AM - 10:00 PM (GMT+6)",
  supportedCurrencies: ["BDT", "USD", "EUR"],
  timeZone: "Asia/Dhaka",
  defaultLanguage: "Bengali (বাংলা) & English",
  customerSupportPolicy: "Prompt, courteous support with live chat agent routing within 2 minutes.",
  deliveryPolicy: "Standard courier delivery across Bangladesh within 24-48 hours. International shipping via express courier.",
  refundPolicy: "Full refund or replacement on verified damaged parcels within 7 days. Sensitive refunds require Owner Approval.",
};

export const INITIAL_AGENTS: Record<string, AgentInfo> = {
  rose: {
    id: "rose",
    name: "Rose",
    title: "Main Business Manager",
    roleDescription: "Executive oversight, agent report aggregation, daily business health monitoring, and escalation manager.",
    status: "active",
    responsibilities: [
      "Collect and synthesize reports from Mira, Arin, Zayan, and Naira",
      "Monitor daily business KPIs and cashflow summaries",
      "Request explicit Owner Approval for sensitive operations",
      "Conduct autonomous morning and evening business briefings",
    ],
    permissions: ["view_all", "delegate_tasks", "request_approvals", "send_daily_briefing"],
    autoApprovedActions: ["generate_summary", "delegate_task", "flag_discrepancy"],
    lastReport: "All 4 subordinate agents operating normally. No unresolved critical alerts.",
    tasksHandledToday: 38,
  },
  mira: {
    id: "mira",
    name: "Mira",
    title: "Customer Communication Agent",
    roleDescription: "Monitors business inboxes across WhatsApp, Messenger, and Web. Drafts responses and resolves inquiries.",
    status: "active",
    responsibilities: [
      "Scan customer queries and classify intent",
      "Draft and send approved routine responses",
      "Track unanswered tickets and escalated complaints",
      "Report message volume and customer sentiment to Rose",
    ],
    permissions: ["read_inbox", "send_replies", "tag_complaints"],
    autoApprovedActions: ["send_greeting", "reply_faq", "send_tracking_link"],
    lastReport: "Handled 14 customer inquiries. 2 delivery delay questions answered with tracking info.",
    tasksHandledToday: 14,
  },
  arin: {
    id: "arin",
    name: "Arin",
    title: "Sales & Order Management Agent",
    roleDescription: "Validates incoming orders, monitors stock levels, tracks payment status, and flags discrepancies.",
    status: "active",
    responsibilities: [
      "Process new cart orders and verify customer phone & address",
      "Check inventory availability prior to order confirmation",
      "Verify payment gateway / COD transaction status",
      "Report pending or disputed orders to Rose",
    ],
    permissions: ["view_orders", "update_order_status", "check_inventory"],
    autoApprovedActions: ["verify_order", "update_payment_received"],
    lastReport: "Processed 8 orders today. Total volume BDT 14,250. 0 stock collisions.",
    tasksHandledToday: 8,
  },
  zayan: {
    id: "zayan",
    name: "Zayan",
    title: "Parcel & Delivery Management Agent",
    roleDescription: "Coordinates parcel packaging, courier assignment, tracking verification, and delivery exception alerts.",
    status: "active",
    responsibilities: [
      "Monitor dispatch queues and assign courier tracking numbers",
      "Poll courier tracking status for delays or failed attempts",
      "Proactively alert customers when parcels are out for delivery",
      "Report return parcels and transit bottlenecks to Rose",
    ],
    permissions: ["manage_parcels", "fetch_tracking", "dispatch_courier"],
    autoApprovedActions: ["generate_waybill", "poll_courier_status"],
    lastReport: "6 parcels in transit. 1 parcel delayed due to heavy rain in Chattogram; customer notified.",
    tasksHandledToday: 11,
  },
  naira: {
    id: "naira",
    name: "Naira",
    title: "Business Audit & Analytics Agent",
    roleDescription: "Cross-checks order revenues against payments and courier collections, audits anomalies, and generates analytics.",
    status: "active",
    responsibilities: [
      "Reconcile confirmed orders against received payments",
      "Detect missing courier disbursements or unpaid balances",
      "Calculate daily gross sales, profit margins, and return rates",
      "Deliver discrepancy audits directly to Rose",
    ],
    permissions: ["audit_reports", "view_financials", "flag_anomalies"],
    autoApprovedActions: ["generate_daily_audit", "flag_unmatched_payment"],
    lastReport: "Audit verified: 100% of delivered orders matched courier settlements. 0 fraud flags.",
    tasksHandledToday: 5,
  },
};

export const INITIAL_ORDERS: BusinessOrder[] = [
  {
    id: "ord_101",
    orderNumber: "ROSE-2026-101",
    customerName: "Tanvir Ahmed",
    phone: "01711223344",
    items: [
      { id: "i1", name: "Rose Smart Voice Assistant Pro", quantity: 1, unitPrice: 3500 },
      { id: "i2", name: "USB-C Fast Charging Desk Hub", quantity: 1, unitPrice: 850 },
    ],
    totalAmount: 4350,
    currency: "BDT",
    paymentStatus: "paid",
    deliveryStatus: "shipped",
    trackingNumber: "SA-98210344",
    courierName: "Steadfast Courier",
    createdAt: "2026-10-29T02:15:00Z",
  },
  {
    id: "ord_102",
    orderNumber: "ROSE-2026-102",
    customerName: "Sadia Rahman",
    phone: "01822334455",
    items: [
      { id: "i3", name: "Premium Desktop Ambient Glow Bar", quantity: 2, unitPrice: 1600 },
    ],
    totalAmount: 3200,
    currency: "BDT",
    paymentStatus: "paid",
    deliveryStatus: "delivered",
    trackingNumber: "RD-44321908",
    courierName: "RedX Express",
    createdAt: "2026-10-28T14:30:00Z",
  },
  {
    id: "ord_103",
    orderNumber: "ROSE-2026-103",
    customerName: "Farhan Kabir",
    phone: "01933445566",
    items: [
      { id: "i4", name: "Wireless Conference Mic Puck", quantity: 1, unitPrice: 2400 },
    ],
    totalAmount: 2400,
    currency: "BDT",
    paymentStatus: "pending",
    deliveryStatus: "processing",
    trackingNumber: "TRK-PENDING-03",
    courierName: "Pathao Courier",
    createdAt: "2026-10-29T03:50:00Z",
    needsApproval: false,
  },
];

export const INITIAL_PARCELS: ParcelTracking[] = [
  {
    trackingNumber: "SA-98210344",
    orderNumber: "ROSE-2026-101",
    recipientName: "Tanvir Ahmed",
    courier: "Steadfast Courier",
    status: "in_transit",
    origin: "Dhaka Central Hub",
    destination: "Dhanmondi, Dhaka",
    lastLocation: "Tejgaon Sorting Facility",
    estimatedDelivery: "Today, 4:00 PM",
    lastUpdate: "2026-10-29T03:30:00Z",
  },
  {
    trackingNumber: "RD-44321908",
    orderNumber: "ROSE-2026-102",
    recipientName: "Sadia Rahman",
    courier: "RedX Express",
    status: "delivered",
    origin: "Dhaka Central Hub",
    destination: "Uttara Sector 7, Dhaka",
    lastLocation: "Customer Address (Signed by Self)",
    estimatedDelivery: "Delivered",
    lastUpdate: "2026-10-28T18:12:00Z",
  },
  {
    trackingNumber: "ST-77123490",
    orderNumber: "ROSE-2026-098",
    recipientName: "Mahbub Hasan",
    courier: "Paperfly Express",
    status: "delayed",
    origin: "Dhaka Central Hub",
    destination: "Agrabad, Chattogram",
    lastLocation: "Chattogram Zonal Hub",
    estimatedDelivery: "Tomorrow morning",
    lastUpdate: "2026-10-29T02:00:00Z",
    issueNote: "Heavy rain along highway delayed regional linehaul transit.",
  },
];

export const INITIAL_MESSAGES: CustomerMessage[] = [
  {
    id: "msg_1",
    customerName: "Kazi Nabil",
    customerPhone: "01755667788",
    platform: "WhatsApp",
    message: "Hello! Is the Rose AI voice assistant in stock right now?",
    timestamp: "2026-10-29T03:45:00Z",
    status: "replied",
    assignedAgent: "Mira",
    replyText: "Hello Kazi! Yes, the Rose AI Assistant is in stock with 24-hour nationwide delivery.",
  },
  {
    id: "msg_2",
    customerName: "Nusrat Jahan",
    customerPhone: "01866778899",
    platform: "Messenger",
    message: "Can I get my tracking number for order ROSE-2026-101?",
    timestamp: "2026-10-29T03:52:00Z",
    status: "replied",
    assignedAgent: "Mira",
    replyText: "Hi Nusrat! Your Steadfast tracking number is SA-98210344, currently out for delivery in Tejgaon.",
  },
  {
    id: "msg_3",
    customerName: "Rahim Chowdhury",
    customerPhone: "01977889900",
    platform: "Web Chat",
    message: "I need to change my delivery address before shipment.",
    timestamp: "2026-10-29T04:05:00Z",
    status: "pending",
    assignedAgent: "Mira",
  },
];

export const INITIAL_AUTOMATION_RULES: AutomationRule[] = [
  {
    id: "rule_1",
    name: "Auto-Draft Routine Replies",
    description: "Allows Mira to automatically draft routine answers for product inquiries and hours.",
    enabled: true,
    agentId: "mira",
    requiresOwnerApproval: false,
    actionType: "reply_message",
  },
  {
    id: "rule_2",
    name: "Automated Tracking Sharing",
    description: "Sends courier tracking URLs to customers upon parcel dispatch without manual review.",
    enabled: true,
    agentId: "zayan",
    requiresOwnerApproval: false,
    actionType: "track_parcel",
  },
  {
    id: "rule_3",
    name: "Customer Refund Requests",
    description: "Restricted: Any refund or financial payout requires explicit Owner Approval.",
    enabled: true,
    agentId: "naira",
    requiresOwnerApproval: true,
    actionType: "refund",
  },
  {
    id: "rule_4",
    name: "Catalog Price Adjustments",
    description: "Restricted: Product price modifications require Owner confirmation.",
    enabled: true,
    agentId: "arin",
    requiresOwnerApproval: true,
    actionType: "price_change",
  },
  {
    id: "rule_5",
    name: "Order Cancellations",
    description: "Restricted: Immediate cancellation of confirmed orders requires Owner approval.",
    enabled: true,
    agentId: "arin",
    requiresOwnerApproval: true,
    actionType: "confirm_order",
  },
];

export const INITIAL_ACTIVITY_LOGS: ActivityLog[] = [
  {
    id: "log_1",
    timestamp: "2026-10-29T04:02:15Z",
    agentId: "Rose",
    action: "Daily Business Briefing Compiled",
    details: "Aggregated morning reports across 4 agents. All subsystems operating normally.",
    status: "success",
    performedBy: "Rose",
  },
  {
    id: "log_2",
    timestamp: "2026-10-29T03:52:10Z",
    agentId: "Mira",
    action: "Replied to Customer Message",
    details: "Sent Steadfast tracking number SA-98210344 to customer Nusrat Jahan.",
    status: "success",
    performedBy: "Mira",
  },
  {
    id: "log_3",
    timestamp: "2026-10-29T03:31:05Z",
    agentId: "Zayan",
    action: "Parcel Dispatched with Courier",
    details: "Order ROSE-2026-101 handed over to Steadfast Courier at Dhaka Central Hub.",
    status: "success",
    performedBy: "Zayan",
  },
  {
    id: "log_4",
    timestamp: "2026-10-29T02:15:30Z",
    agentId: "Arin",
    action: "New Order Validated",
    details: "Order ROSE-2026-101 created for Tanvir Ahmed (BDT 4,350) with verified payment.",
    status: "success",
    performedBy: "Arin",
  },
  {
    id: "log_5",
    timestamp: "2026-10-29T01:45:00Z",
    agentId: "Naira",
    action: "Financial Reconciliation Complete",
    details: "Audited yesterday's bank settlements. BDT 28,400 accounted for with 0 variance.",
    status: "success",
    performedBy: "Naira",
  },
];

export const DEFAULT_SHARED_BUSINESS_DATABASE: SharedBusinessDatabase = {
  version: 1,
  lastSyncedAt: new Date().toISOString(),
  syncStatus: "synced",
  activeGeminiProfile: "free",
  geminiProfiles: {
    free: {
      key: "",
      maskedKey: "",
      hasKey: false,
      status: "not_configured",
      verificationStatus: "NOT CONFIGURED",
      lastTested: null,
      lastError: null,
      errorCategory: null,
      model: "gemini-3.8-flash",
      callsCount: 0,
      quotaLimit: "Standard Free Quota (15 RPM / 1M TPM / 1,500 RPD)",
      billingStatus: "Free tier profile (No credit card required; subject to Google rate limits)",
      estimatedCost: "$0.00 (Free Quota)",
    },
    paid: {
      key: "",
      maskedKey: "",
      hasKey: false,
      status: "not_configured",
      verificationStatus: "NOT CONFIGURED",
      lastTested: null,
      lastError: null,
      errorCategory: null,
      model: "gemini-3.8-flash",
      callsCount: 0,
      quotaLimit: "Pay-as-you-go Quotas (Project Billing Account governed)",
      billingStatus: "Requires active Google Cloud billing account linked to project",
      estimatedCost: "Requires billing account verification via GCP Console",
    },
  },
  groq: {
    keys: "",
    hasKeys: false,
    maskedKeys: "",
    status: "not_configured",
    verificationStatus: "NOT CONFIGURED",
    lastTested: null,
  },
  otherKeys: [],
  metaAccessToken: "",
  firebaseConfig: {
    apiKey: "",
    authDomain: "",
    projectId: "",
    storageBucket: "",
    messagingSenderId: "",
    appId: "",
  },
  businessProfile: INITIAL_BUSINESS_PROFILE,
  agents: INITIAL_AGENTS,
  messages: INITIAL_MESSAGES,
  orders: INITIAL_ORDERS,
  parcels: INITIAL_PARCELS,
  automationRules: INITIAL_AUTOMATION_RULES,
  activityLogs: INITIAL_ACTIVITY_LOGS,
};
