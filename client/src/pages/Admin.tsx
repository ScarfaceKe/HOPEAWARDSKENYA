import { useState, useEffect, useRef } from "react";
import { useLocation, useSearch } from "wouter";
import { useCreateArtist } from "@/hooks/use-artists";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { ShieldAlert, ShieldCheck, KeyRound, Activity, Plus, Mic2, Image as ImageIcon, Lock, LogOut, Check, X, Inbox, Search, Trash2, Upload, Users, AlertTriangle, Download, BarChart2, Shuffle, Pencil, Loader2, Tags, Smartphone, Facebook, Music2, Youtube, Share2, RefreshCw, Send, Pause, Play } from "lucide-react";
import { CATEGORY_CAP } from "@shared/schema";
import { MAX_MANUAL_VOTES_PER_ADDITION, USSD_SHORTCODE, ussdNomineeCode } from "@shared/site";
import { formatPairingCode, pairingCodeSecondsLeft } from "@shared/pairing";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, csrfFetch } from "@/lib/queryClient";
import { Switch } from "@/components/ui/switch";
import { useCategories } from "@/hooks/use-categories";
import { setCsrfToken, csrfHeaders, getCsrfToken } from "@/lib/csrf";
import { approvalFailure } from "@/lib/approvalError";

async function compressImage(file: File, maxPx = 1200, quality = 0.82): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    const cleanup = () => URL.revokeObjectURL(url);

    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("Photo took too long to load. Please try a smaller photo or a JPG/PNG file."));
    }, 15000);

    img.onload = () => {
      clearTimeout(timer);
      cleanup();
      let { width, height } = img;
      if (width > maxPx || height > maxPx) {
        if (width >= height) {
          height = Math.round((height / width) * maxPx);
          width = maxPx;
        } else {
          width = Math.round((width / height) * maxPx);
          height = maxPx;
        }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Could not process this photo. Try a JPG or PNG file."));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Could not compress this photo. Try a JPG or PNG file."));
            return;
          }
          resolve(new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" }));
        },
        "image/jpeg",
        quality
      );
    };

    img.onerror = () => {
      clearTimeout(timer);
      cleanup();
      reject(new Error("This photo format isn't supported. Please use a JPG, PNG, or WebP file."));
    };

    img.src = url;
  });
}

function AdminLogin({ onLogin }: { onLogin: () => void }) {
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [needsCode, setNeedsCode] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Picks up the CSRF token for this session and learns whether a second
    // factor is configured on the server.
    fetch("/api/admin/check", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        setCsrfToken(d?.csrfToken);
        if (d?.twoFactorRequired) setNeedsCode(true);
      })
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...csrfHeaders() },
        credentials: "include",
        body: JSON.stringify({ password, code: needsCode ? code.trim() : undefined }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok && data.success) {
        setCsrfToken(data.csrfToken);
        onLogin();
        return;
      }
      if (data.twoFactorRequired) setNeedsCode(true);
      setError(data.message || "Wrong password. Try again.");
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-grid-pattern flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="w-20 h-20 bg-red-500/20 rounded-2xl flex items-center justify-center border border-red-500/50 mb-4">
            <Lock className="w-10 h-10 text-red-500" />
          </div>
          <h1 className="font-display text-3xl text-white">ADMIN ACCESS</h1>
          <p className="text-muted-foreground mt-2">Enter your password to continue</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-card border border-white/10 rounded-2xl p-8 space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              data-testid="input-admin-password"
              placeholder="Enter admin password"
              className="w-full bg-black/50 border border-white/10 rounded-xl py-4 px-5 text-white placeholder:text-white/20 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all font-display text-xl text-center tracking-widest"
              autoFocus
            />
          </div>

          {needsCode && (
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                <KeyRound className="w-3.5 h-3.5 text-accent" />
                Authenticator code
              </label>
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={7}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))}
                data-testid="input-admin-2fa-code"
                placeholder="123456"
                className="w-full bg-black/50 border border-white/10 rounded-xl py-4 px-5 text-white placeholder:text-white/20 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all font-display text-2xl text-center tracking-[0.35em]"
              />
              <p className="text-[11px] text-muted-foreground">
                The 6-digit code from Google Authenticator, Authy or any TOTP app.
              </p>
            </div>
          )}

          {error && (
            <p className="text-red-400 text-center text-sm font-bold" data-testid="text-login-error">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !password || (needsCode && code.length !== 6)}
            data-testid="button-admin-login"
            className={`
              w-full py-4 rounded-xl font-display text-xl tracking-widest transition-all duration-300
              ${loading || !password || (needsCode && code.length !== 6)
                ? 'bg-white/5 text-white/30 cursor-not-allowed'
                : 'bg-primary text-black hover:bg-primary/90 active:scale-95'}
            `}
          >
            {loading ? "CHECKING..." : "ENTER"}
          </button>
        </form>
      </motion.div>
    </div>
  );
}

const SOCIAL_PLATFORM_META = [
  {
    id: "facebook",
    label: "Facebook",
    hint: "Hope Awards Kenya Page",
    icon: Facebook,
    className: "border-[#1877F2]/35 bg-[#1877F2]/10",
    iconClassName: "text-[#4A9EFF]",
  },
  {
    id: "tiktok",
    label: "TikTok",
    hint: "@hopeawardske",
    icon: Music2,
    className: "border-white/20 bg-white/5",
    iconClassName: "text-white",
  },
  {
    id: "youtube",
    label: "YouTube",
    hint: "20s poster video + gospel sound",
    icon: Youtube,
    className: "border-[#FF0000]/35 bg-[#FF0000]/10",
    iconClassName: "text-[#FF5A5A]",
  },
] as const;

export default function Admin() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const presetCategory = params.get("category") || "";
  const queryClient = useQueryClient();
  // Live category list: includes every category an admin has added, and feeds
  // the nomination dropdowns, the filters and the category manager below.
  const { categories, categoryName } = useCategories();

  const [isAuthed, setIsAuthed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [activeTab, setActiveTab] = useState<"add" | "categories" | "requests" | "waitlist" | "approved" | "delete" | "votes" | "social" | "security">(
    params.get("social") ? "social" : "add",
  );
  const [approvedSearch, setApprovedSearch] = useState("");
  const [approvedCategory, setApprovedCategory] = useState("");
  const [uploadMode, setUploadMode] = useState<"url" | "file">("url");
  const [uploading, setUploading] = useState(false);

  const [deleteSearch, setDeleteSearch] = useState("");
  const [deleteCategory, setDeleteCategory] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [editingBioId, setEditingBioId] = useState<number | null>(null);
  const [editingBioText, setEditingBioText] = useState("");
  const [editingArtistId, setEditingArtistId] = useState<number | null>(null);
  const [editingArtistName, setEditingArtistName] = useState("");
  const [editingArtistImageUrl, setEditingArtistImageUrl] = useState("");
  const [editingArtistPosterReady, setEditingArtistPosterReady] = useState(false);
  const [editingArtistUploading, setEditingArtistUploading] = useState(false);
  const uploadAbortRef = useRef<AbortController | null>(null);

  const cancelUpload = () => {
    uploadAbortRef.current?.abort();
    uploadAbortRef.current = null;
    setEditingArtistUploading(false);
    setUploading(false);
  };

  const [votesSearch, setVotesSearch] = useState("");
  const [votesCategory, setVotesCategory] = useState("");
  const [addAmounts, setAddAmounts] = useState<Record<number, string>>({});

  // ── Category manager state ──
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryGroup, setNewCategoryGroup] = useState("");
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [deletingCategory, setDeletingCategory] = useState<string | null>(null);

  // Same slug rule as the server, so the panel can show the real page address
  // before the category is saved.
  const newCategorySlug = newCategoryName
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");

  useEffect(() => {
    fetch("/api/admin/check", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        // Every mutating admin request carries this token (see @/lib/csrf).
        setCsrfToken(d.csrfToken);
        setIsAuthed(d.isAdmin);
        setChecking(false);
      })
      .catch(() => setChecking(false));
  }, []);

  // ── Security tab data: what the fraud controls have been seeing ──
  // Loaded as soon as we're signed in (not just on the Security tab), because
  // the tab's badge is how an admin notices there is something to look at.
  const { data: alerts = [], refetch: refetchAlerts } = useQuery<any[]>({
    queryKey: ["/api/admin/alerts"],
    enabled: isAuthed,
    refetchInterval: 30_000,
  });

  const { data: auditLog = [] } = useQuery<any[]>({
    queryKey: ["/api/admin/audit"],
    queryFn: async () => {
      const res = await fetch("/api/admin/audit?limit=100", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isAuthed && activeTab === "security",
  });

  const { data: twoFactor } = useQuery<{ enabled: boolean; secret?: string; uri?: string }>({
    queryKey: ["/api/admin/2fa"],
    queryFn: async () => {
      const res = await fetch("/api/admin/2fa", { credentials: "include" });
      if (!res.ok) return { enabled: false } as { enabled: boolean };
      return res.json();
    },
    enabled: isAuthed && activeTab === "security",
  });

  // Live M-Pesa STK test (Security tab): sends a real prompt so the gateway can
  // be proven, not assumed. Reads nothing from storage — the test order is never
  // recorded as a vote.
  const [stkPhone, setStkPhone] = useState("");
  const [stkSending, setStkSending] = useState(false);
  const [stkResult, setStkResult] = useState<any>(null);

  const sendStkTest = async () => {
    setStkSending(true);
    setStkResult(null);
    try {
      const res = await csrfFetch("/api/admin/test-stk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ phone: stkPhone }),
      });
      const data = await res.json().catch(() => ({}));
      setStkResult({ ...data, ok: res.ok && data?.ok === true, httpStatus: data?.httpStatus ?? res.status });
    } catch (err: any) {
      setStkResult({ ok: false, message: err?.message || "Could not reach the server. Try again." });
    } finally {
      setStkSending(false);
    }
  };

  const { mutate: createArtist, isPending } = useCreateArtist();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: "",
    genre: "",
    imageUrl: "",
    category: presetCategory || categories[0]?.id || "",
    bio: "",
    // Opt-in, never inferred from the presence of a photo: most nominees only
    // have an ordinary profile picture, not the finished official poster.
    posterReady: false,
  });

  useEffect(() => {
    if (presetCategory) {
      setFormData((prev) => ({ ...prev, category: presetCategory }));
    }
  }, [presetCategory]);

  const { data: pendingRequests = [] } = useQuery<any[]>({
    queryKey: ["/api/requests", { status: "pending" }],
    queryFn: async () => {
      const res = await fetch("/api/requests?status=pending", { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: isAuthed,
  });

  const { data: approvedRequests = [] } = useQuery<any[]>({
    queryKey: ["/api/requests", { status: "approved" }],
    queryFn: async () => {
      const res = await fetch("/api/requests?status=approved", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isAuthed,
  });
  const { data: waitlistRequests = [] } = useQuery<any[]>({
    queryKey: ["/api/requests", { status: "waitlist" }],
    queryFn: async () => {
      const res = await fetch("/api/requests?status=waitlist", { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: isAuthed,
  });

  // Every approved nominee's own voting link, the exact message they would
  // receive, and whether it has already gone out.
  const { data: nomineeLinks } = useQuery<{ configured: boolean; connected?: boolean; votingOpen: boolean; items: any[] }>({
    queryKey: ["/api/admin/nominee-links"],
    enabled: isAuthed,
  });
  const linkByRequest = new Map<number, any>((nomineeLinks?.items ?? []).map((i: any) => [i.requestId, i]));
  const linksSent = (nomineeLinks?.items ?? []).filter((i: any) => i.notification?.status === "sent").length;
  const linksMissing = (nomineeLinks?.items ?? []).filter(
    (i: any) => i.notification?.status !== "sent" && i.notification?.status !== "skipped",
  ).length;

  // The posters' WhatsApp number is linked once; everything after that sends
  // itself. Poll while unlinked so the pairing code / QR stays current.
  const { data: whatsapp, refetch: refetchWhatsApp } = useQuery<any>({
    queryKey: ["/api/admin/whatsapp"],
    enabled: isAuthed,
    refetchInterval: 5_000,
  });
  const [waPhone, setWaPhone] = useState("");

  // Social posters are slower than WhatsApp by design (one every 4 hours),
  // so a 15-second refresh is enough to show the queue moving without hammering
  // the Zernio API.
  const { data: social, refetch: refetchSocial } = useQuery<any>({
    queryKey: ["/api/admin/social"],
    enabled: isAuthed,
    // Only poll while the Social tab is open: the status call asks Zernio for
    // the connected accounts, and the rest of the admin panel does not need it.
    refetchInterval: activeTab === "social" ? 30_000 : false,
  });

  // The linking code is short-lived, so show the admin exactly how long is
  // left instead of letting them find out on the phone. The ticker only runs
  // while a code is on screen.
  const [pairingTick, setPairingTick] = useState(Date.now());
  useEffect(() => {
    if (!whatsapp?.pairingCode) return;
    setPairingTick(Date.now());
    const timer = setInterval(() => setPairingTick(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, [whatsapp?.pairingCode, whatsapp?.pairingCodeIssuedAt]);
  const pairingSecondsLeft = pairingCodeSecondsLeft(whatsapp?.pairingCodeIssuedAt ?? null, pairingTick);


  const { data: capacity = [] } = useQuery<any[]>({
    queryKey: ["/api/categories/capacity"],
    enabled: isAuthed,
  });
  const capMap = new Map<string, any>(capacity.map((c: any) => [c.id, c]));

  const approveMutation = useMutation({
    mutationFn: async ({ id, action }: { id: number; action: "approved" | "rejected" }) => {
      await apiRequest("PATCH", `/api/requests/${id}`, { status: action });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/categories/capacity"] });
    },
  });

  const sendNomineeLinkMutation = useMutation({
    mutationFn: async (requestId: number) => {
      const res = await apiRequest("POST", `/api/admin/nominee-links/${requestId}/send`);
      return (await res.json()) as any;
    },
    onSuccess: (notice: any) => {
      toast({
        title: notice?.status === "sent" ? "LINK SENT" : "LINK READY",
        description:
          notice?.status === "sent"
            ? "The nominee has their voting link on WhatsApp."
            : notice?.error || "Use the one-tap WhatsApp button to send it.",
        className: notice?.status === "sent" ? "bg-secondary/90 text-black border-none font-display" : undefined,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/nominee-links"] });
    },
    onError: (err: any) => {
      toast({ title: "Send failed", description: err?.message || "Try again.", variant: "destructive" });
    },
  });

  const connectWhatsAppMutation = useMutation({
    mutationFn: async (phone?: string) => {
      const res = await apiRequest("POST", "/api/admin/whatsapp/connect", phone ? { phone } : {});
      return (await res.json()) as any;
    },
    onSettled: () => {
      // Even a failed pairing request can leave a QR waiting, so always refresh.
      refetchWhatsApp();
    },
    onError: (err: any) => {
      toast({ title: "Could not start WhatsApp", description: err?.message || "Try again.", variant: "destructive" });
    },
  });

  const logoutWhatsAppMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/whatsapp/logout");
      return (await res.json()) as any;
    },
    onSuccess: () => {
      refetchWhatsApp();
      toast({ title: "WHATSAPP UNLINKED", description: "The number will no longer send automatically." });
    },
  });

  const pauseWhatsAppMutation = useMutation({
    mutationFn: async (paused: boolean) => {
      const res = await apiRequest("POST", "/api/admin/whatsapp/pause", { paused });
      return (await res.json()) as any;
    },
    onSuccess: (_data: any, paused: boolean) => {
      refetchWhatsApp();
      queryClient.invalidateQueries({ queryKey: ["/api/admin/nominee-links"] });
      toast({
        title: paused ? "WHATSAPP PAUSED" : "WHATSAPP RESUMED",
        description: paused
          ? "No automatic or bulk messages will be sent. Links already delivered still work."
          : "Batches will run at most 5 messages an hour, about a minute apart.",
      });
    },
    onError: (err: any) => {
      toast({ title: "Could not change automation", description: err?.message || "Try again.", variant: "destructive" });
    },
  });

  const sweepWhatsAppMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/whatsapp/sweep");
      return (await res.json()) as any;
    },
    onSuccess: (data: any) => {
      toast({
        title: "WHATSAPP BATCH STARTED",
        description: `Up to ${data?.batchSize ?? 5} messages, about ${data?.gapSeconds ?? 60} seconds apart. The list refreshes when the batch finishes.`,
      });
      // A batch is intentionally slow; refresh the ledger once it should be done.
      window.setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/admin/nominee-links"] });
      }, ((data?.batchSize ?? 5) * (data?.gapSeconds ?? 60) * 1000) + 5_000);
      refetchWhatsApp();
    },
    onError: (err: any) => {
      toast({ title: "Could not start the batch", description: err?.message || "Try again.", variant: "destructive" });
    },
  });

  const sendAllLinksMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/nominee-links/send-all");
      return (await res.json()) as any;
    },
    onSuccess: (data: any) => {
      toast({
        title: "WHATSAPP BATCH STARTED",
        description: `Up to ${data?.batchSize ?? 5} messages, about ${data?.gapSeconds ?? 60} seconds apart.`,
        className: "bg-secondary/90 text-black border-none font-display",
      });
      window.setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/admin/nominee-links"] });
      }, ((data?.batchSize ?? 5) * (data?.gapSeconds ?? 60) * 1000) + 5_000);
    },
    onError: (err: any) => {
      toast({ title: "Could not start the batch", description: err?.message || "Try again.", variant: "destructive" });
    },
  });

  const toggleSocialMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const res = await apiRequest("POST", "/api/admin/social/toggle", { enabled });
      return (await res.json()) as any;
    },
    onSuccess: (_data: any, enabled: boolean) => {
      refetchSocial();
      toast({
        title: enabled ? "AUTO-POSTING ON" : "AUTO-POSTING PAUSED",
        description: enabled
          ? "The next poster goes out at the next queue check (within five minutes), then one every 4 hours across every connected account."
          : "Nothing new will publish automatically. Already posted posters stay live.",
      });
    },
    onError: (err: any) => {
      toast({ title: "Could not change auto-posting", description: err?.message || "Try again.", variant: "destructive" });
    },
  });

  const posterFilterMutation = useMutation({
    mutationFn: async (onlyWithPosters: boolean) => {
      const res = await apiRequest("POST", "/api/admin/social/only-with-posters", { onlyWithPosters });
      return (await res.json()) as any;
    },
    onSuccess: (_data: any, onlyWithPosters: boolean) => {
      refetchSocial();
      toast({
        title: onlyWithPosters ? "POSTER-ONLY QUEUE ON" : "POSTER FILTER OFF",
        description: onlyWithPosters
          ? "Only nominees you marked as having an official poster will be posted."
          : "Every approved nominee's current photo is now eligible. Use this only when you are sure the photos are finished posters.",
        variant: onlyWithPosters ? undefined : "destructive",
      });
    },
    onError: (err: any) => {
      toast({ title: "Could not change the poster filter", description: err?.message || "Try again.", variant: "destructive" });
    },
  });

  const postSocialMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/social/post");
      return (await res.json()) as any;
    },
    onSuccess: (data: any) => {
      const ok = data?.status === "published";
      const partial = data?.status === "partial";
      const queued = data?.status === "queued";
      toast({
        title: ok
          ? "POSTER PUBLISHED"
          : partial
            ? "POSTER PARTIALLY PUBLISHED"
            : queued
              ? "POSTER QUEUED"
              : "POSTER DID NOT PUBLISH",
        description: ok
          ? `${data?.artistName ?? "The nominee"} is live on ${data?.posted ?? 0} platform(s).`
          : partial
            ? `${data?.artistName ?? "The nominee"} is live where the platform accepted it. Check the per-platform result below.`
            : queued
              ? "A platform is holding the post for its daily limit; Zernio will publish it automatically. The next poster can continue."
              : data?.error || "Check the Zernio connection and try again.",
        variant: ok || partial || queued ? undefined : "destructive",
        className: ok ? "bg-secondary/90 text-black border-none font-display" : undefined,
      });
      refetchSocial();
    },
    onError: (err: any) => {
      toast({ title: "Could not publish the poster", description: err?.message || "Try again.", variant: "destructive" });
    },
  });

  const connectSocialMutation = useMutation({
    mutationFn: async (platform: string) => {
      const res = await fetch(`/api/admin/social/connect/${platform}`, { credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "Could not start the connection.");
      return data.authUrl as string;
    },
    onSuccess: (authUrl: string) => {
      window.location.href = authUrl;
    },
    onError: (err: any) => {
      toast({ title: "Could not connect the account", description: err?.message || "Try again.", variant: "destructive" });
    },
  });

  const moveCategoryMutation = useMutation({
    mutationFn: async ({ id, category, keepApproved }: { id: number; category: string; keepApproved?: boolean }) => {
      const body: any = { category };
      if (keepApproved) body.status = "approved";
      else body.status = "pending";
      await apiRequest("PATCH", `/api/requests/${id}`, body);
    },
    onSuccess: (_data, vars) => {
      toast({
        title: "MOVED",
        description: vars.keepApproved
          ? "Nominee moved to the new category and is still LIVE on the public site."
          : "Nominee moved to the new category. They're now pending — approve them when ready.",
        className: "bg-secondary/90 text-black border-none font-display",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/categories/capacity"] });
      queryClient.invalidateQueries({ queryKey: ["/api/artists"] });
    },
    onError: (err: any) => {
      const msg = err?.message || "Could not move nominee. Try again.";
      toast({ title: "Move failed", description: msg, variant: "destructive" });
    },
  });

  const shuffleMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/admin/shuffle-nominees", {});
    },
    onSuccess: () => {
      toast({
        title: "SHUFFLED!",
        description: "Nominees have been randomly reordered within their categories on the live site.",
        className: "bg-accent/90 text-black border-none font-display",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/artists"] });
    },
    onError: (err: any) => {
      toast({ title: "Shuffle failed", description: err?.message || "Try again.", variant: "destructive" });
    },
  });

  const addVotesMutation = useMutation({
    mutationFn: async ({ id, add }: { id: number; add: number }) => {
      return await apiRequest("PATCH", `/api/artists/${id}/votes`, { add });
    },
    onSuccess: (_data, vars) => {
      toast({
        title: "ADJUSTMENT LOGGED",
        description: `${vars.add} vote${vars.add === 1 ? "" : "s"} recorded in the audit log. Official totals only include paid votes and did not change.`,
        className: "bg-primary/90 text-black border-none font-display",
      });
      setAddAmounts((prev) => ({ ...prev, [vars.id]: "" }));
      queryClient.invalidateQueries({ queryKey: ["/api/artists"] });
    },
    onError: (err: any) => {
      toast({ title: "Failed", description: err?.message || "Could not log the adjustment. Try again.", variant: "destructive" });
    },
  });

  const { data: manualVoteSettings, isLoading: loadingManualVoteSettings, refetch: refetchManualVoteSettings } = useQuery<{
    enabled: boolean;
  }>({
    queryKey: ["/api/admin/manual-votes"],
    enabled: isAuthed,
  });
  const manualVotesEnabled = manualVoteSettings?.enabled === true;

  const toggleManualVotesMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const res = await apiRequest("POST", "/api/admin/manual-votes/toggle", { enabled });
      return (await res.json()) as { enabled: boolean };
    },
    onSuccess: (data, enabled) => {
      queryClient.setQueryData(["/api/admin/manual-votes"], data);
      // Turning it off must also clear any half-typed adjustment immediately.
      if (!enabled) setAddAmounts({});
      toast({
        title: enabled ? "MANUAL ADJUSTMENT LOG ON" : "MANUAL ADJUSTMENT LOG OFF",
        description: enabled
          ? "Each nominee now has a LOG ADJUSTMENT control. Entries are audited and never added to official totals."
          : "The adjustment controls are hidden and the server will reject any entries.",
      });
    },
    onError: (err: any) => {
      refetchManualVoteSettings();
      toast({
        title: "Could not change manual adjustments",
        description: err?.message || "Try again.",
        variant: "destructive",
      });
    },
  });

  const { data: allArtists = [], isLoading: loadingArtists } = useQuery<any[]>({
    queryKey: ["/api/artists"],
    enabled: isAuthed,
  });

  const { data: adminStats } = useQuery<{ paidVotes: number; revenueKes: number }>({
    queryKey: ["/api/admin/stats"],
    enabled: isAuthed,
  });

  const { data: pendingPayments = [], refetch: refetchPending } = useQuery<any[]>({
    queryKey: ["/api/admin/pending-payments"],
    enabled: isAuthed,
    refetchInterval: 30_000,
  });

  const recoverMutation = useMutation({
    mutationFn: (reference: string) => apiRequest("POST", `/api/admin/pending-payments/${reference}/recover`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/artists"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      refetchPending();
      toast({ title: "Vote recovered!", description: "Payment verified and vote recorded." });
    },
    onError: (err: any) => toast({ title: "Recovery failed", description: err?.message || "Could not recover", variant: "destructive" }),
  });

  const dismissPendingMutation = useMutation({
    mutationFn: (reference: string) => apiRequest("DELETE", `/api/admin/pending-payments/${reference}`, {}),
    onSuccess: () => { refetchPending(); toast({ title: "Dismissed", description: "Pending payment removed." }); },
    onError: (err: any) => toast({ title: "Error", description: err?.message, variant: "destructive" }),
  });

  // Recent credited votes: the safety net for a payment Safaricom reversed
  // after the fan already saw "vote added".
  const { data: recentVotes = [] } = useQuery<any[]>({
    queryKey: ["/api/admin/recent-votes"],
    enabled: isAuthed && activeTab === "votes",
    refetchInterval: 60_000,
  });

  const voidVoteMutation = useMutation({
    mutationFn: (reference: string) => apiRequest("POST", `/api/admin/votes/${encodeURIComponent(reference)}/void`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/artists"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/recent-votes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({ title: "VOTE REMOVED", description: "The reversed payment's vote was taken off the tally." });
    },
    onError: (err: any) => toast({ title: "Could not void", description: err?.message || "Try again.", variant: "destructive" }),
  });

  const filteredArtists = allArtists.filter((a) => {
    if (deleteCategory && a.category !== deleteCategory) return false;
    if (deleteSearch) {
      const q = deleteSearch.toLowerCase();
      if (!a.name?.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/artists/${id}`);
    },
    onSuccess: () => {
      toast({ title: "DELETED", description: "Artist removed from the competition.", className: "bg-red-500/90 text-white border-none font-display" });
      setConfirmDeleteId(null);
      queryClient.invalidateQueries({ queryKey: ["/api/artists"] });
      queryClient.invalidateQueries({ queryKey: ["/api/categories/capacity"] });
    },
    onError: (err: any) => {
      setConfirmDeleteId(null);
      const msg = err?.message || "Could not delete. You may need to log in again.";
      toast({ title: "Delete failed", description: msg, variant: "destructive" });
    },
  });

  const updateBioMutation = useMutation({
    mutationFn: async ({ id, bio }: { id: number; bio: string }) => {
      await apiRequest("PATCH", `/api/artists/${id}/bio`, { bio });
    },
    onSuccess: () => {
      toast({ title: "BIO SAVED", description: "Nominee bio has been updated.", className: "bg-primary/90 text-black border-none font-display" });
      setEditingBioId(null);
      setEditingBioText("");
      queryClient.invalidateQueries({ queryKey: ["/api/artists"] });
    },
    onError: () => {
      toast({ title: "Save failed", description: "Could not save bio. Try again.", variant: "destructive" });
    },
  });

  const updateArtistMutation = useMutation({
    mutationFn: async ({ id, name, imageUrl, posterReady }: { id: number; name: string; imageUrl: string; posterReady: boolean }) => {
      await apiRequest("PATCH", `/api/admin/artists/${id}`, { name, imageUrl, posterReady });
    },
    onSuccess: () => {
      toast({ title: "SAVED", description: "Nominee details and poster status updated.", className: "bg-secondary text-secondary-foreground border-none font-display" });
      setEditingArtistId(null);
      setEditingArtistName("");
      setEditingArtistImageUrl("");
      setEditingArtistPosterReady(false);
      queryClient.invalidateQueries({ queryKey: ["/api/artists"] });
      refetchSocial();
    },
    onError: (err: any) => {
      toast({ title: "Save failed", description: err?.message || "Could not save. Try again.", variant: "destructive" });
    },
  });

  const posterReadyMutation = useMutation({
    mutationFn: async ({ id, posterReady }: { id: number; posterReady: boolean }) => {
      await apiRequest("PATCH", `/api/admin/artists/${id}/poster-ready`, { posterReady });
    },
    onSuccess: (_data, vars) => {
      toast({
        title: vars.posterReady ? "OFFICIAL POSTER MARKED" : "POSTER MARK REMOVED",
        description: vars.posterReady
          ? "This nominee can now enter the social queue."
          : "This nominee will be skipped while the poster-only filter is on.",
        className: vars.posterReady ? "bg-secondary text-secondary-foreground border-none font-display" : undefined,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/artists"] });
      refetchSocial();
    },
    onError: (err: any) => {
      toast({ title: "Could not update poster status", description: err?.message || "Try again.", variant: "destructive" });
    },
  });

  const handleEditArtistPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setEditingArtistUploading(true);
    const controller = new AbortController();
    uploadAbortRef.current = controller;
    const fetchTimer = setTimeout(() => controller.abort(), 60000);
    try {
      const compressed = await compressImage(file);
      const fd = new FormData();
      fd.append("image", compressed);
      const res = await fetch("/api/upload", {
        method: "POST",
        body: fd,
        credentials: "include",
        headers: csrfHeaders(),
        signal: controller.signal,
      });
      const data = await res.json();
      if (data.imageUrl) {
        setEditingArtistImageUrl(data.imageUrl);
        toast({ title: "Uploaded!", description: "New photo ready. Click SAVE to apply." });
      } else {
        throw new Error(data.message || "Upload failed");
      }
    } catch (err: any) {
      if (err.name === "AbortError") {
        toast({ title: "Upload cancelled", description: "Upload was stopped. Try again with a smaller photo or better connection.", variant: "destructive" });
      } else {
        toast({ title: "Upload Failed", description: err.message, variant: "destructive" });
      }
    } finally {
      clearTimeout(fetchTimer);
      uploadAbortRef.current = null;
      setEditingArtistUploading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    setUploading(true);
    const controller = new AbortController();
    uploadAbortRef.current = controller;
    const fetchTimer = setTimeout(() => controller.abort(), 60000);
    try {
      const compressed = await compressImage(file);
      const fd = new FormData();
      fd.append("image", compressed);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: fd,
        credentials: "include",
        headers: csrfHeaders(),
        signal: controller.signal,
      });
      const data = await res.json();
      if (data.imageUrl) {
        setFormData((prev) => ({ ...prev, imageUrl: data.imageUrl }));
        toast({ title: "Uploaded!", description: "Photo uploaded successfully." });
      } else {
        throw new Error(data.message || "Upload failed");
      }
    } catch (err: any) {
      if (err.name === "AbortError") {
        toast({ title: "Upload cancelled", description: "Upload was stopped. Try again with a smaller photo or better connection.", variant: "destructive" });
      } else {
        toast({ title: "Upload Failed", description: err.message, variant: "destructive" });
      }
    } finally {
      clearTimeout(fetchTimer);
      uploadAbortRef.current = null;
      setUploading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim() || !formData.genre.trim() || !formData.imageUrl.trim()) {
      toast({ title: "Missing Fields", description: "Please fill in all fields.", variant: "destructive" });
      return;
    }

    createArtist(formData, {
      onSuccess: () => {
        toast({ title: "SUCCESS!", description: `${formData.name} added to the competition.`, className: "bg-secondary text-secondary-foreground border-none font-display" });
        setFormData({ name: "", genre: "", imageUrl: "", category: formData.category, bio: "", posterReady: false });
      },
      onError: (err) => {
        toast({ title: "Error", description: err.message, variant: "destructive" });
      },
    });
  };

  const handleLogout = async () => {
    await apiRequest("POST", "/api/admin/logout");
    setIsAuthed(false);
  };

  const refreshCategories = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
    queryClient.invalidateQueries({ queryKey: ["/api/categories/capacity"] });
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (creatingCategory) return;
    setCreatingCategory(true);
    try {
      const res = await csrfFetch("/api/admin/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newCategoryName, group: newCategoryGroup }),
        credentials: "include",
      });
      const body = (await res.json().catch(() => null)) as { name?: string; message?: string } | null;
      if (!res.ok) throw new Error(body?.message || "Could not add the category.");

      setNewCategoryName("");
      setNewCategoryGroup("");
      refreshCategories();
      toast({
        title: "CATEGORY ADDED",
        description: `${body?.name || "The category"} is live in every nomination form and admin dropdown. Approve two nominees in it and it appears on the home page.`,
        className: "bg-secondary/90 text-black border-none font-display",
      });
    } catch (err: any) {
      toast({
        title: "COULD NOT ADD CATEGORY",
        description: err?.message || "Check the connection and try again.",
        variant: "destructive",
      });
    } finally {
      setCreatingCategory(false);
    }
  };

  const handleDeleteCategory = async (id: string, name: string) => {
    if (!window.confirm(`Delete "${name}"? Nominees must be moved off it first. This cannot be undone.`)) return;
    setDeletingCategory(id);
    try {
      const res = await csrfFetch(`/api/admin/categories/${encodeURIComponent(id)}`, {
        method: "DELETE",
        credentials: "include",
      });
      const body = (await res.json().catch(() => null)) as { message?: string } | null;
      if (!res.ok) throw new Error(body?.message || "Could not delete the category.");

      refreshCategories();
      toast({ title: "CATEGORY DELETED", description: `${name} is no longer listed anywhere on the site.` });
    } catch (err: any) {
      toast({
        title: "COULD NOT DELETE CATEGORY",
        description: err?.message || "Check the connection and try again.",
        variant: "destructive",
      });
    } finally {
      setDeletingCategory(null);
    }
  };

  const categoryGroups = Array.from(new Set(categories.map((c) => c.group)));

  const handleApproveRequest = (req: any) => {
    createArtist(
      { name: req.name, genre: req.genre || "—", imageUrl: req.imageUrl, category: req.category },
      {
        onSuccess: () => {
          approveMutation.mutate({ id: req.id, action: "approved" });
          toast({ title: "APPROVED!", description: `${req.name} has been added.`, className: "bg-secondary text-secondary-foreground border-none font-display" });
          queryClient.invalidateQueries({ queryKey: ["/api/categories/capacity"] });
          queryClient.invalidateQueries({ queryKey: ["/api/artists"] });
        },
        onError: (err: any) => {
          const catName = categoryName(req.category);
          const { title, description } = approvalFailure(err, catName);
          toast({ title, description, variant: "destructive" });
        },
      }
    );
  };


  if (checking) {
    return (
      <div className="min-h-screen bg-grid-pattern flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthed) {
    return <AdminLogin onLogin={() => setIsAuthed(true)} />;
  }

  return (
    <div className="min-h-screen bg-grid-pattern py-24">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-primary/20 rounded-xl flex items-center justify-center border border-primary/50">
              <ShieldAlert className="w-7 h-7 text-primary" />
            </div>
            <div>
              <h1 className="font-display text-4xl text-white">ADMIN PANEL</h1>
              <p className="text-muted-foreground font-semibold">Manage artists and nominations</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Nominations do not stop when voting starts — this is the shortcut
                to the same public form fans use, admin review still applies. */}
            <a
              href="/nominate"
              target="_blank"
              rel="noopener noreferrer"
              data-testid="link-admin-nominate"
              className="flex items-center gap-2 px-4 py-2 bg-primary/15 border border-primary/40 rounded-xl text-primary hover:bg-primary/25 transition-all"
              title="Nominations stay open during voting — opens the public nomination form"
            >
              <Plus className="w-4 h-4" />
              <span className="text-sm font-bold uppercase tracking-wider hidden sm:inline">Nominate</span>
            </a>
            <a
              href="/api/requests/export.csv"
              data-testid="link-export-nominees"
              className="flex items-center gap-2 px-4 py-2 bg-secondary/15 border border-secondary/40 rounded-xl text-secondary hover:bg-secondary/25 transition-all"
              title="Download all nominees with phone numbers as CSV"
            >
              <Download className="w-4 h-4" />
              <span className="text-sm font-bold uppercase tracking-wider hidden sm:inline">Export CSV</span>
            </a>
            <button
              onClick={handleLogout}
              data-testid="button-admin-logout"
              className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-muted-foreground hover:text-white hover:bg-white/10 transition-all"
            >
              <LogOut className="w-4 h-4" />
              <span className="text-sm font-bold uppercase tracking-wider hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>

        {/* The USSD rail is invisible unless the admin can see the shortcode and
            each nominee's code — these are what fans type on a feature phone. */}
        <div
          data-testid="admin-ussd-banner"
          className="mb-6 rounded-2xl border border-primary/25 bg-primary/5 px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-8"
        >
          <div className="shrink-0">
            <p className="text-[11px] uppercase tracking-widest text-primary/70 font-bold">USSD voting</p>
            <p className="font-display text-2xl text-primary tracking-wider" data-testid="text-ussd-shortcode">
              {USSD_SHORTCODE}
            </p>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Fans without data dial this, enter the nominee's three-digit code and pick a vote pack.
            Codes are listed in the <strong className="text-white">VOTES</strong> tab and on each nominee's public page.
            USSD payments credit the <strong className="text-white">same vote totals</strong> as the website — there is no separate counter.
          </p>
        </div>

        <div className="flex gap-2 mb-8 flex-wrap">
          <button
            onClick={() => setActiveTab("add")}
            data-testid="tab-add-artist"
            className={`px-6 py-3 rounded-xl font-display text-sm tracking-wider transition-all ${
              activeTab === "add" ? "bg-primary text-black neon-box-gold" : "bg-white/5 text-muted-foreground hover:bg-white/10"
            }`}
          >
            <Plus className="w-4 h-4 inline mr-2" />
            ADD ARTIST
          </button>
          <button
            onClick={() => setActiveTab("requests")}
            data-testid="tab-requests"
            className={`px-6 py-3 rounded-xl font-display text-sm tracking-wider transition-all relative ${
              activeTab === "requests" ? "bg-accent text-black" : "bg-white/5 text-muted-foreground hover:bg-white/10"
            }`}
          >
            <Inbox className="w-4 h-4 inline mr-2" />
            NOMINATIONS
            {pendingRequests.length > 0 && (
              <>
                <span className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full animate-ping opacity-60" />
                <span
                  data-testid="badge-pending-count"
                  className="absolute -top-2 -right-2 min-w-[1.5rem] h-6 px-1.5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center font-bold border-2 border-background shadow-lg shadow-red-500/50"
                >
                  {pendingRequests.length}
                </span>
              </>
            )}
          </button>
          <button
            onClick={() => setActiveTab("waitlist")}
            data-testid="tab-waitlist"
            className={`px-6 py-3 rounded-xl font-display text-sm tracking-wider transition-all relative ${
              activeTab === "waitlist" ? "bg-amber-500 text-black" : "bg-white/5 text-muted-foreground hover:bg-white/10"
            }`}
          >
            <Users className="w-4 h-4 inline mr-2" />
            WAITLIST
            {waitlistRequests.length > 0 && (
              <span
                data-testid="badge-waitlist-count"
                className="absolute -top-2 -right-2 min-w-[1.5rem] h-6 px-1.5 bg-amber-500 text-black rounded-full text-xs flex items-center justify-center font-bold border-2 border-background shadow-lg shadow-amber-500/40"
              >
                {waitlistRequests.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("approved")}
            data-testid="tab-approved"
            className={`px-6 py-3 rounded-xl font-display text-sm tracking-wider transition-all relative ${
              activeTab === "approved" ? "bg-secondary text-black" : "bg-white/5 text-muted-foreground hover:bg-white/10"
            }`}
          >
            <Check className="w-4 h-4 inline mr-2" />
            APPROVED
            {approvedRequests.length > 0 && (
              <span
                data-testid="badge-approved-count"
                className="absolute -top-2 -right-2 min-w-[1.5rem] h-6 px-1.5 bg-secondary text-black rounded-full text-xs flex items-center justify-center font-bold border-2 border-background"
              >
                {approvedRequests.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("social")}
            data-testid="tab-social"
            className={`px-6 py-3 rounded-xl font-display text-sm tracking-wider transition-all relative ${
              activeTab === "social" ? "bg-[#E1306C] text-white" : "bg-white/5 text-muted-foreground hover:bg-white/10"
            }`}
          >
            <Share2 className="w-4 h-4 inline mr-2" />
            SOCIAL
            {social?.enabled && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-background" />
            )}
          </button>
          <button
            onClick={() => setActiveTab("delete")}
            data-testid="tab-delete"
            className={`px-6 py-3 rounded-xl font-display text-sm tracking-wider transition-all ${
              activeTab === "delete" ? "bg-red-500 text-white" : "bg-white/5 text-muted-foreground hover:bg-white/10"
            }`}
          >
            <Trash2 className="w-4 h-4 inline mr-2" />
            DELETE
          </button>
          <button
            onClick={() => setActiveTab("votes")}
            data-testid="tab-votes"
            className={`px-6 py-3 rounded-xl font-display text-sm tracking-wider transition-all ${
              activeTab === "votes" ? "bg-primary text-black" : "bg-white/5 text-muted-foreground hover:bg-white/10"
            }`}
          >
            <BarChart2 className="w-4 h-4 inline mr-2" />
            VOTES
          </button>
          <button
            onClick={() => setActiveTab("categories")}
            data-testid="tab-categories"
            className={`px-6 py-3 rounded-xl font-display text-sm tracking-wider transition-all ${
              activeTab === "categories" ? "bg-primary text-black" : "bg-white/5 text-muted-foreground hover:bg-white/10"
            }`}
          >
            <Tags className="w-4 h-4 inline mr-2" />
            CATEGORIES
          </button>
          <button
            onClick={() => setActiveTab("security")}
            data-testid="tab-security"
            className={`px-6 py-3 rounded-xl font-display text-sm tracking-wider transition-all relative ${
              activeTab === "security" ? "bg-white text-black" : "bg-white/5 text-muted-foreground hover:bg-white/10"
            }`}
          >
            <ShieldCheck className="w-4 h-4 inline mr-2" />
            SECURITY
            {alerts.length > 0 && (
              <span
                data-testid="badge-alerts-count"
                className="absolute -top-2 -right-2 min-w-[1.5rem] h-6 px-1.5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center font-bold border-2 border-background"
              >
                {alerts.length}
              </span>
            )}
          </button>
        </div>

        {activeTab === "categories" && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* ── Add a category ── */}
            <div className="bg-card border border-white/10 rounded-2xl p-8 md:p-10 shadow-2xl">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center">
                  <Tags className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="font-display text-2xl text-white tracking-wide">ADD A CATEGORY</h2>
                  <p className="text-sm text-muted-foreground">It goes live as soon as you save it — no redeploy.</p>
                </div>
              </div>

              <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
                A new category is usable straight away: it appears on the nomination form, in every admin dropdown, on
                the discover page and at its own public page. The home page lists it once two nominees are approved in it.
              </p>

              <form onSubmit={handleCreateCategory} className="space-y-5">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label htmlFor="new-category-name" className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                      Category name
                    </label>
                    <input
                      id="new-category-name"
                      required
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      data-testid="input-new-category-name"
                      placeholder="e.g. Best Gospel Song of the Year 2026"
                      maxLength={120}
                      className="w-full bg-black/50 border border-white/10 rounded-xl py-3 px-4 text-white placeholder:text-white/25 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all font-bold"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Public page:{" "}
                      <span className="font-mono text-primary">/category/{newCategorySlug || "…"}</span>
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="new-category-group" className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                      Award group
                    </label>
                    <input
                      id="new-category-group"
                      required
                      list="award-groups"
                      value={newCategoryGroup}
                      onChange={(e) => setNewCategoryGroup(e.target.value)}
                      data-testid="input-new-category-group"
                      placeholder={categoryGroups[0] || "Main Awards"}
                      maxLength={60}
                      className="w-full bg-black/50 border border-white/10 rounded-xl py-3 px-4 text-white placeholder:text-white/25 focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-all font-bold"
                    />
                    <datalist id="award-groups">
                      {categoryGroups.map((group) => (
                        <option key={group} value={group} />
                      ))}
                    </datalist>
                    <p className="text-[11px] text-muted-foreground">
                      Pick an existing group, or type a new one to create a new section on the home page.
                    </p>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={creatingCategory || !newCategoryName.trim() || !newCategoryGroup.trim()}
                  data-testid="button-create-category"
                  className={`px-6 py-3 rounded-xl font-display text-sm tracking-wider transition-all ${
                    creatingCategory || !newCategoryName.trim() || !newCategoryGroup.trim()
                      ? "bg-white/5 text-white/30 cursor-not-allowed"
                      : "bg-primary text-black hover:bg-primary/90 active:scale-95"
                  }`}
                >
                  {creatingCategory ? "ADDING…" : "+ ADD CATEGORY"}
                </button>
              </form>
            </div>

            {/* ── Existing categories ── */}
            <div className="bg-card border border-white/10 rounded-2xl p-8 md:p-10">
              <div className="flex items-center justify-between gap-4 mb-4">
                <h2 className="font-display text-xl text-white tracking-wide">
                  ALL CATEGORIES <span className="text-muted-foreground">({categories.length})</span>
                </h2>
                <p className="text-[11px] text-muted-foreground uppercase tracking-widest font-bold">
                  {categoryGroups.length} groups
                </p>
              </div>

              <ul className="divide-y divide-white/5">
                {categories.map((cat) => {
                  const cap = capMap.get(cat.id);
                  return (
                    <li key={cat.id} className="flex items-center gap-3 py-3" data-testid={`category-row-${cat.id}`}>
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-bold leading-snug truncate">{cat.name}</p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {cat.group} · /category/{cat.id}
                          {cap ? ` · ${cap.approved}/${cap.cap} nominees` : ""}
                        </p>
                      </div>
                      <a
                        href={`/category/${cat.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider bg-white/5 border border-white/10 text-muted-foreground hover:text-white hover:bg-white/10 transition-colors shrink-0"
                      >
                        View
                      </a>
                      <button
                        onClick={() => handleDeleteCategory(cat.id, cat.name)}
                        disabled={deletingCategory === cat.id}
                        data-testid={`button-delete-category-${cat.id}`}
                        title="Delete this category (nominees must be moved first)"
                        className="w-9 h-9 rounded-lg flex items-center justify-center bg-red-500/10 border border-red-500/25 text-red-400 hover:bg-red-500/20 transition-colors shrink-0 disabled:opacity-40"
                      >
                        {deletingCategory === cat.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </motion.div>
        )}

        {activeTab === "add" && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card border border-white/10 rounded-2xl p-8 md:p-10 shadow-2xl"
          >
            <form onSubmit={handleSubmit} className="space-y-8">
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Category</label>
                  <select
                    name="category"
                    value={formData.category}
                    onChange={handleChange}
                    data-testid="select-category"
                    className="w-full bg-black/50 border border-white/10 rounded-xl py-4 px-5 text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all font-bold text-lg appearance-none cursor-pointer"
                  >
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id} className="bg-black text-white">{cat.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                    <Mic2 className="w-4 h-4 text-primary" />
                    Artist / DJ / MC Name
                  </label>
                  <input
                    required
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    data-testid="input-name"
                    placeholder="e.g. KHALIGRAPH JONES, DJ AFRO"
                    className="w-full bg-black/50 border border-white/10 rounded-xl py-4 px-5 text-white placeholder:text-white/20 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all font-display text-xl"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                    Genre / Style
                  </label>
                  <input
                    required
                    name="genre"
                    value={formData.genre}
                    onChange={handleChange}
                    data-testid="input-genre"
                    placeholder="e.g. Afrobeats, Hip Hop, Gengetone"
                    className="w-full bg-black/50 border border-white/10 rounded-xl py-4 px-5 text-white placeholder:text-white/20 focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-all font-bold text-lg"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                    Bio / About <span className="text-white/30 font-normal normal-case">(optional)</span>
                  </label>
                  <textarea
                    name="bio"
                    value={formData.bio}
                    onChange={(e) => setFormData((prev) => ({ ...prev, bio: e.target.value }))}
                    data-testid="input-bio"
                    rows={3}
                    placeholder="e.g. Award-winning Afrobeats artist from Nairobi, known for hits like..."
                    className="w-full bg-black/50 border border-white/10 rounded-xl py-3 px-4 text-white placeholder:text-white/20 focus:outline-none focus:border-white/30 focus:ring-1 focus:ring-white/20 transition-all text-sm resize-none"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-accent" /> Photo
                  </label>
                  <div className="flex gap-2 mb-3">
                    <button
                      type="button"
                      onClick={() => setUploadMode("url")}
                      className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${uploadMode === "url" ? "bg-primary/20 text-primary border border-primary/30" : "bg-white/5 text-muted-foreground border border-white/10"}`}
                    >
                      URL
                    </button>
                    <button
                      type="button"
                      onClick={() => setUploadMode("file")}
                      data-testid="button-upload-mode"
                      className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${uploadMode === "file" ? "bg-accent/20 text-accent border border-accent/30" : "bg-white/5 text-muted-foreground border border-white/10"}`}
                    >
                      <Upload className="w-4 h-4" /> Upload File
                    </button>
                  </div>

                  {uploadMode === "url" ? (
                    <input
                      type="url"
                      name="imageUrl"
                      value={formData.imageUrl}
                      onChange={handleChange}
                      data-testid="input-image-url"
                      placeholder="https://images.unsplash.com/..."
                      className="w-full bg-black/50 border border-white/10 rounded-xl py-4 px-5 text-white placeholder:text-white/20 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all text-sm font-mono"
                    />
                  ) : (
                    <div className="relative">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileUpload}
                        data-testid="input-file-upload"
                        className="w-full bg-black/50 border border-white/10 rounded-xl py-4 px-5 text-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-accent/20 file:text-accent file:font-bold file:cursor-pointer cursor-pointer"
                      />
                      {uploading && (
                        <div className="absolute right-4 top-1/2 -translate-y-1/2">
                          <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                        </div>
                      )}
                    </div>
                  )}

                  {formData.imageUrl && (
                    <div className="mt-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Preview</label>
                        <span className="text-xs text-muted-foreground/50 font-mono truncate max-w-[200px]">{formData.imageUrl}</span>
                      </div>
                      <div className="rounded-xl overflow-hidden border border-white/10 h-48">
                        <img
                          src={formData.imageUrl}
                          alt="Preview"
                          className="w-full h-full object-cover object-top"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <label className="flex items-start gap-3 rounded-xl border border-secondary/25 bg-secondary/5 p-4 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={formData.posterReady}
                    onChange={(e) => setFormData((prev) => ({ ...prev, posterReady: e.target.checked }))}
                    data-testid="checkbox-poster-ready"
                    className="mt-0.5 h-4 w-4 shrink-0 accent-[#E1306C] cursor-pointer"
                  />
                  <span>
                    <span className="block text-sm font-bold text-white">Official poster is ready</span>
                    <span className="block text-xs text-muted-foreground mt-0.5 leading-relaxed">
                      Tick this only when the photo above is the finished Hope Awards poster. The social queue only publishes nominees with this box ticked while the poster-only filter is on. Leave it unticked for an ordinary profile photo.
                    </span>
                  </span>
                </label>
              </div>

              <button
                type="submit"
                disabled={isPending}
                data-testid="button-submit-artist"
                className={`w-full py-5 rounded-xl font-display text-xl tracking-widest flex items-center justify-center gap-3 transition-all duration-300 ${
                  isPending ? "bg-white/5 text-white/30 cursor-not-allowed" : "bg-white text-black active:scale-95"
                }`}
              >
                {isPending ? "REGISTERING..." : (
                  <><Plus className="w-6 h-6" /> SUBMIT ARTIST</>
                )}
              </button>
            </form>
          </motion.div>
        )}

        {activeTab === "requests" && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            {pendingRequests.length === 0 ? (
              <div className="bg-card border border-white/10 rounded-2xl p-12 text-center">
                <Inbox className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
                <p className="text-muted-foreground font-display text-xl">NO PENDING NOMINATIONS</p>
                <p className="text-muted-foreground/60 mt-2">When fans nominate artists, they'll appear here</p>
              </div>
            ) : (
              pendingRequests.map((req: any) => {
                const cap = capMap.get(req.category);
                const isFull = cap?.isFull;
                return (
                  <div key={req.id} data-testid={`request-card-${req.id}`} className="bg-card border border-white/10 rounded-2xl p-6 flex gap-4">
                    <div className="w-24 h-24 rounded-xl overflow-hidden border border-white/10 shrink-0">
                      <img src={req.imageUrl} alt={req.name} className="w-full h-full object-cover object-top" onError={(e) => { (e.target as HTMLImageElement).src = "/placeholder.svg"; }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-display text-xl text-white">{req.name}</h3>
                      <p className="text-xs text-primary font-bold mt-1">{categoryName(req.category)}</p>
                      {cap && (
                        <p className={`text-xs mt-1 font-bold ${isFull ? "text-red-400" : "text-muted-foreground"}`}>
                          {isFull ? `⚠ Category FULL (${cap.approved}/${cap.cap})` : `${cap.approved}/${cap.cap} spots filled`}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground/60 mt-1">📞 {req.submitterPhone}</p>
                    </div>
                    <div className="flex flex-col gap-2 shrink-0 w-full sm:w-56">
                      <select
                        value=""
                        onChange={(e) => {
                          const newCat = e.target.value;
                          if (newCat && newCat !== req.category) {
                            moveCategoryMutation.mutate({ id: req.id, category: newCat });
                          }
                        }}
                        disabled={moveCategoryMutation.isPending}
                        data-testid={`select-move-category-${req.id}`}
                        className="px-3 py-2 bg-accent/10 text-accent border border-accent/30 rounded-xl text-xs font-bold cursor-pointer focus:outline-none focus:border-accent transition-all w-full"
                      >
                        <option value="" className="bg-black">⇄ MOVE TO CATEGORY…</option>
                        {categories.filter((c) => c.id !== req.category).map((c) => {
                          const cc = capMap.get(c.id);
                          const full = cc?.isFull;
                          return (
                            <option key={c.id} value={c.id} className="bg-black" disabled={full}>
                              {c.name} {cc ? `(${cc.approved}/${cc.cap}${full ? " FULL" : ""})` : ""}
                            </option>
                          );
                        })}
                      </select>
                      <button onClick={() => handleApproveRequest(req)} disabled={approveMutation.isPending || isFull} data-testid={`button-approve-${req.id}`}
                        className={`px-4 py-2 rounded-xl flex items-center justify-center gap-2 text-sm font-bold transition-all ${
                          isFull
                            ? "bg-white/5 text-white/30 border border-white/10 cursor-not-allowed"
                            : "bg-secondary/20 text-secondary border border-secondary/30 hover:bg-secondary/30"
                        }`}>
                        <Check className="w-4 h-4" /> APPROVE
                      </button>
                      <button onClick={() => approveMutation.mutate({ id: req.id, action: "rejected" })} disabled={approveMutation.isPending} data-testid={`button-reject-${req.id}`}
                        className="px-4 py-2 bg-red-500/20 text-red-400 border border-red-500/30 rounded-xl hover:bg-red-500/30 transition-all flex items-center justify-center gap-2 text-sm font-bold">
                        <X className="w-4 h-4" /> REJECT
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </motion.div>
        )}

        {activeTab === "waitlist" && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-5 mb-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-amber-200 font-bold text-sm">What is the waitlist?</p>
                  <p className="text-xs text-amber-200/80 leading-relaxed">
                    These nominees tried to register in a category that was already full ({CATEGORY_CAP}/{CATEGORY_CAP} nominees). Instead of losing them, we saved their details here and suggested alternative categories with open spots. You can promote them if a spot opens up, or contact them by phone.
                  </p>
                </div>
              </div>
            </div>

            {waitlistRequests.length === 0 ? (
              <div className="bg-card border border-white/10 rounded-2xl p-12 text-center">
                <Users className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
                <p className="text-muted-foreground font-display text-xl">WAITLIST IS EMPTY</p>
                <p className="text-muted-foreground/60 mt-2">When a category is full, overflow nominees land here</p>
              </div>
            ) : (
              waitlistRequests.map((req: any) => {
                const cap = capMap.get(req.category);
                const hasRoomNow = cap && !cap.isFull;
                return (
                  <div key={req.id} data-testid={`waitlist-card-${req.id}`} className="bg-card border border-amber-500/20 rounded-2xl p-6 flex gap-4">
                    <div className="w-24 h-24 rounded-xl overflow-hidden border border-white/10 shrink-0">
                      <img src={req.imageUrl} alt={req.name} className="w-full h-full object-cover object-top" onError={(e) => { (e.target as HTMLImageElement).src = "/placeholder.svg"; }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-display text-xl text-white">{req.name}</h3>
                      <p className="text-xs text-amber-400 font-bold mt-1">Tried: {categoryName(req.category)}</p>
                      {cap && (
                        <p className={`text-xs mt-1 font-bold ${hasRoomNow ? "text-secondary" : "text-red-400"}`}>
                          {hasRoomNow ? `✓ ${cap.cap - cap.approved} spot(s) open now — you can promote!` : `Category still full (${cap.approved}/${cap.cap})`}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground/60 mt-2">
                        📞 <a href={`tel:${req.submitterPhone}`} className="text-accent hover:underline">{req.submitterPhone}</a>
                        {" · "}
                        <a href={`https://wa.me/${req.submitterPhone.replace(/[^0-9]/g, '').replace(/^0/, '254')}`} target="_blank" rel="noopener" className="text-secondary hover:underline">WhatsApp</a>
                      </p>
                      <p className="text-xs text-muted-foreground/60 mt-1 italic">
                        We told them: "Category full — saved you on the waitlist & suggested similar categories with open spots."
                      </p>
                    </div>
                    <div className="flex flex-col gap-2 shrink-0 w-full sm:w-56">
                      <select
                        value=""
                        onChange={(e) => {
                          const newCat = e.target.value;
                          if (newCat && newCat !== req.category) {
                            moveCategoryMutation.mutate({ id: req.id, category: newCat });
                          }
                        }}
                        disabled={moveCategoryMutation.isPending}
                        data-testid={`select-move-category-waitlist-${req.id}`}
                        className="px-3 py-2 bg-accent/10 text-accent border border-accent/30 rounded-xl text-xs font-bold cursor-pointer focus:outline-none focus:border-accent transition-all w-full"
                      >
                        <option value="" className="bg-black">⇄ MOVE TO CATEGORY…</option>
                        {categories.filter((c) => c.id !== req.category).map((c) => {
                          const cc = capMap.get(c.id);
                          const full = cc?.isFull;
                          return (
                            <option key={c.id} value={c.id} className="bg-black" disabled={full}>
                              {c.name} {cc ? `(${cc.approved}/${cc.cap}${full ? " FULL" : ""})` : ""}
                            </option>
                          );
                        })}
                      </select>
                      <button
                        onClick={() => handleApproveRequest(req)}
                        disabled={approveMutation.isPending || !hasRoomNow}
                        data-testid={`button-promote-${req.id}`}
                        className={`px-4 py-2 rounded-xl flex items-center justify-center gap-2 text-sm font-bold transition-all ${
                          !hasRoomNow
                            ? "bg-white/5 text-white/30 border border-white/10 cursor-not-allowed"
                            : "bg-secondary/20 text-secondary border border-secondary/30 hover:bg-secondary/30"
                        }`}>
                        <Check className="w-4 h-4" /> PROMOTE
                      </button>
                      <button
                        onClick={() => approveMutation.mutate({ id: req.id, action: "rejected" })}
                        disabled={approveMutation.isPending}
                        data-testid={`button-reject-waitlist-${req.id}`}
                        className="px-4 py-2 bg-red-500/20 text-red-400 border border-red-500/30 rounded-xl hover:bg-red-500/30 transition-all flex items-center justify-center gap-2 text-sm font-bold">
                        <X className="w-4 h-4" /> REJECT
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </motion.div>
        )}

        {activeTab === "approved" && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <div className="bg-secondary/10 border border-secondary/30 rounded-2xl p-5 mb-4">
              <div className="flex items-start gap-3">
                <Check className="w-5 h-5 text-secondary shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-secondary font-bold text-sm">All approved nominees</p>
                  <p className="text-xs text-secondary/80 leading-relaxed">
                    These nominees are LIVE on the public site. Use the yellow "MOVE TO CATEGORY" dropdown on any card to shift them into a different category at any time — the public site updates instantly. Categories at {CATEGORY_CAP}/{CATEGORY_CAP} are blocked as destinations.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-black/40 border border-secondary/25 rounded-2xl p-4" data-testid="whatsapp-automation">
              <div className="flex flex-wrap items-center gap-2">
                <Smartphone className="w-4 h-4 text-secondary" />
                <p className="text-sm font-bold text-white">WHATSAPP AUTOMATION</p>
                <span
                  data-testid="whatsapp-state"
                  className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2 py-0.5 rounded-full ${
                    whatsapp?.connected ? "bg-emerald-500/15 text-emerald-400" : "bg-amber-500/15 text-amber-400"
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${whatsapp?.connected ? "bg-emerald-400" : "bg-amber-400"}`} />
                  {whatsapp?.connected ? `LINKED +${whatsapp.phone ?? ""}` : "NOT LINKED"}
                </span>
                {whatsapp?.paused && (
                  <span
                    data-testid="whatsapp-paused-badge"
                    className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300"
                  >
                    PAUSED
                  </span>
                )}
              </div>

              {whatsapp?.paused && (
                <div className="mt-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3" data-testid="whatsapp-paused">
                  <p className="text-[11px] font-bold tracking-widest text-amber-300">AUTOMATION PAUSED</p>
                  <p className="text-xs text-amber-100/80 mt-1 leading-relaxed">
                    No automatic or bulk messages will be sent. Links already delivered still work. Press RESUME when the number is clear —
                    the pause survives a restart or deploy. Linking a number no longer makes you come back and press RESUME:
                    the first successful connection starts the queue once, then the pause button is always in charge.
                  </p>
                </div>
              )}

              {whatsapp?.connected ? (
                <>
                  <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                    Every nominee is congratulated and sent their voting link automatically — new approvals straight away, and everyone
                    already on the site <span className="text-white">5 at a time, about a minute apart, at most once an hour</span>{" "}
                    ({linksMissing} left). No clicking needed; keep the linked phone online.
                  </p>
                  <div className="flex flex-wrap gap-2 mt-3">
                    <button
                      onClick={() => sweepWhatsAppMutation.mutate()}
                      disabled={whatsapp?.paused || whatsapp?.sweepRunning || sweepWhatsAppMutation.isPending || linksMissing === 0}
                      data-testid="button-whatsapp-sweep"
                      className="px-4 py-2.5 bg-secondary text-black rounded-xl text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-secondary/90"
                    >
                      {whatsapp?.paused
                        ? "PAUSED"
                        : whatsapp?.sweepRunning || sweepWhatsAppMutation.isPending
                          ? "SENDING…"
                          : "SEND NEXT 5"}
                    </button>
                    <button
                      onClick={() => pauseWhatsAppMutation.mutate(!whatsapp?.paused)}
                      disabled={pauseWhatsAppMutation.isPending}
                      data-testid="button-whatsapp-pause"
                      className={`px-4 py-2.5 rounded-xl text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed transition-colors ${
                        whatsapp?.paused
                          ? "bg-amber-400 text-black hover:bg-amber-300"
                          : "bg-amber-500/15 border border-amber-500/40 text-amber-300 hover:bg-amber-500/25"
                      }`}
                    >
                      {pauseWhatsAppMutation.isPending ? "…" : whatsapp?.paused ? "RESUME AUTOMATION" : "PAUSE AUTOMATION"}
                    </button>
                    <button
                      onClick={() => logoutWhatsAppMutation.mutate()}
                      disabled={logoutWhatsAppMutation.isPending}
                      data-testid="button-whatsapp-logout"
                      className="px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-xs font-bold text-muted-foreground hover:text-white"
                    >
                      UNLINK
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                    {whatsapp?.paused && whatsapp?.autoStarted
                      ? "Automation is paused. Press RESUME when the number is clear; the pause survives a restart or deploy."
                      : "Link the awards' WhatsApp number once, here. The first successful connection starts the automatic queue, and every nominee — already live or approved later — gets their link 5 at a time with no extra clicks from you."}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                    Before you ask for a code, open WhatsApp on the awards phone → <span className="text-white">Settings → Linked devices →
                    Link with phone number</span> and keep that screen open. Then press the button and type all 8 characters — WhatsApp adds
                    the dash. Codes are short-lived, and asking again replaces the previous one, so use only the code shown now and type it
                    straight away.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2 mt-3">
                    <input
                      value={waPhone}
                      onChange={(e) => setWaPhone(e.target.value)}
                      placeholder="Awards number, e.g. 0712 345 678"
                      data-testid="input-whatsapp-phone"
                      className="flex-1 bg-black/50 border border-white/10 rounded-xl py-2.5 px-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-secondary"
                    />
                    <button
                      onClick={() => connectWhatsAppMutation.mutate(waPhone.trim() || undefined)}
                      disabled={connectWhatsAppMutation.isPending}
                      data-testid="button-whatsapp-connect"
                      className="px-4 py-2.5 bg-secondary text-black rounded-xl text-xs font-bold disabled:opacity-50 hover:bg-secondary/90"
                    >
                      {connectWhatsAppMutation.isPending
                        ? "STARTING…"
                        : whatsapp?.pairingCode
                          ? "GET A NEW CODE"
                          : "GET PAIRING CODE"}
                    </button>
                  </div>
                  {whatsapp?.pairingCode && (
                    <div className="mt-3 bg-secondary/10 border border-secondary/30 rounded-xl p-3" data-testid="whatsapp-pairing-code">
                      <p className="text-[11px] font-bold text-secondary/80">ENTER IN WHATSAPP → LINKED DEVICES → LINK WITH PHONE NUMBER</p>
                      <p className="font-mono text-2xl tracking-[0.2em] text-secondary mt-1">{formatPairingCode(whatsapp.pairingCode)}</p>
                      <p className={`text-[11px] mt-1 ${pairingSecondsLeft === 0 ? "text-amber-400 font-bold" : "text-muted-foreground"}`}>
                        {pairingSecondsLeft === 0
                          ? "This code may have expired — press GET A NEW CODE and type it straight away."
                          : `Type all 8 characters — WhatsApp adds the dash.${pairingSecondsLeft !== null ? ` Expires in ${Math.floor(pairingSecondsLeft / 60)}:${String(pairingSecondsLeft % 60).padStart(2, "0")}.` : ""}`}
                      </p>
                    </div>
                  )}
                  {whatsapp?.qrDataUrl && !whatsapp?.pairingCode && (
                    <div className="mt-3 flex items-start gap-3">
                      <img src={whatsapp.qrDataUrl} alt="WhatsApp pairing QR" className="w-36 h-36 rounded-lg bg-white p-1" />
                      <p className="text-[11px] text-muted-foreground">Or scan this in WhatsApp → Linked devices.</p>
                    </div>
                  )}
                  {whatsapp?.lastError && <p className="text-[11px] text-amber-400 mt-2">{whatsapp.lastError}</p>}
                </>
              )}
            </div>

            {nomineeLinks && nomineeLinks.items.length > 0 && (
              <div className="bg-black/40 border border-white/10 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center gap-3" data-testid="nominee-links-banner">
                <div className="flex-1">
                  <p className="text-sm font-bold text-white">
                    {linksSent} of {nomineeLinks.items.length} nominees have their voting link sent
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    {whatsapp?.paused
                      ? "Automation is paused — no automatic or bulk batch will start until you press RESUME in the WhatsApp card."
                      : nomineeLinks.connected
                        ? "New approvals are messaged by themselves. The rest go out 5 at a time, about a minute apart, at most one batch an hour."
                        : nomineeLinks.configured
                          ? "Automatic sending is configured but not connected right now — connect the number above, or start the next batch."
                          : "Link the awards WhatsApp number above and every nominee's message sends itself. Until then, each card has a one-tap WhatsApp button."}
                  </p>
                </div>
                <button
                  onClick={() => sendAllLinksMutation.mutate()}
                  disabled={linksMissing === 0 || !nomineeLinks.configured || whatsapp?.paused || whatsapp?.sweepRunning || sendAllLinksMutation.isPending}
                  data-testid="button-send-all-nominee-links"
                  title={whatsapp?.paused ? "Resume WhatsApp automation first" : "Sends the next 5, about a minute apart"}
                  className="px-4 py-2.5 bg-secondary text-black rounded-xl text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-secondary/90 transition-all shrink-0"
                >
                  {whatsapp?.paused
                    ? "PAUSED"
                    : whatsapp?.sweepRunning || sendAllLinksMutation.isPending
                      ? "SENDING…"
                      : "SEND NEXT 5"}
                </button>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <select
                value={approvedCategory}
                onChange={(e) => setApprovedCategory(e.target.value)}
                data-testid="select-approved-category-filter"
                className="bg-black/50 border border-white/10 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-secondary transition-all font-bold appearance-none cursor-pointer"
              >
                <option value="" className="bg-black">All Categories</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id} className="bg-black">{cat.name}</option>
                ))}
              </select>
              <div className="flex-1 relative">
                <Search className="w-4 h-4 text-muted-foreground absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={approvedSearch}
                  onChange={(e) => setApprovedSearch(e.target.value)}
                  data-testid="input-approved-search"
                  placeholder="Filter by name…"
                  className="w-full bg-black/50 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-white placeholder:text-white/30 focus:outline-none focus:border-secondary transition-all"
                />
              </div>
            </div>

            {(() => {
              const filtered = approvedRequests.filter((r: any) => {
                if (approvedCategory && r.category !== approvedCategory) return false;
                if (approvedSearch && !r.name?.toLowerCase().includes(approvedSearch.toLowerCase())) return false;
                return true;
              });
              if (filtered.length === 0) {
                return (
                  <div className="bg-card border border-white/10 rounded-2xl p-12 text-center">
                    <Inbox className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
                    <p className="text-muted-foreground font-display text-xl">
                      {approvedRequests.length === 0 ? "NO APPROVED NOMINEES YET" : "NO MATCHES"}
                    </p>
                    <p className="text-muted-foreground/60 mt-2">
                      {approvedRequests.length === 0 ? "Approve nominations from the Nominations tab to see them here." : "Try a different filter."}
                    </p>
                  </div>
                );
              }
              return filtered.map((req: any) => {
                const cap = capMap.get(req.category);
                const linkInfo = linkByRequest.get(req.id);
                const linkSent = linkInfo?.notification?.status === "sent";
                return (
                  <div key={req.id} data-testid={`approved-card-${req.id}`} className="bg-card border border-secondary/20 rounded-2xl p-6 flex flex-col sm:flex-row gap-4">
                    <div className="w-24 h-24 rounded-xl overflow-hidden border border-white/10 shrink-0">
                      <img src={req.imageUrl} alt={req.name} className="w-full h-full object-cover object-top" onError={(e) => { (e.target as HTMLImageElement).src = "/placeholder.svg"; }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-display text-xl text-white">{req.name}</h3>
                      <p className="text-xs text-secondary font-bold mt-1">✓ LIVE in: {categoryName(req.category)}</p>
                      {cap && (
                        <p className="text-xs text-muted-foreground mt-1">{cap.approved}/{cap.cap} spots filled in this category</p>
                      )}
                      {req.submitterPhone ? (
                        <div className="mt-3 flex flex-wrap items-center gap-2" data-testid={`phone-row-approved-${req.id}`}>
                          <a
                            href={`tel:${req.submitterPhone}`}
                            data-testid={`link-call-approved-${req.id}`}
                            className="inline-flex items-center gap-2 px-3 py-2 bg-accent/15 border border-accent/40 rounded-lg text-accent text-sm font-bold hover:bg-accent/25"
                          >
                            📞 {req.submitterPhone}
                          </a>
                          <a
                            href={linkInfo?.waLink || `https://wa.me/${req.submitterPhone.replace(/[^0-9]/g, '').replace(/^0/, '254')}`}
                            target="_blank"
                            rel="noopener"
                            data-testid={`link-whatsapp-approved-${req.id}`}
                            className="inline-flex items-center gap-2 px-3 py-2 bg-secondary/15 border border-secondary/40 rounded-lg text-secondary text-sm font-bold hover:bg-secondary/25"
                            title="Open WhatsApp with this nominee's voting link already written"
                          >
                            WhatsApp
                          </a>
                          <button
                            onClick={() => sendNomineeLinkMutation.mutate(req.id)}
                            disabled={!nomineeLinks?.configured || whatsapp?.paused || sendNomineeLinkMutation.isPending}
                            data-testid={`button-send-link-approved-${req.id}`}
                            className="inline-flex items-center gap-2 px-3 py-2 bg-secondary/15 border border-secondary/40 rounded-lg text-secondary text-sm font-bold hover:bg-secondary/25 disabled:opacity-50 disabled:cursor-not-allowed"
                            title={whatsapp?.paused
                              ? "Automation is paused — resume it in the WhatsApp card first"
                              : nomineeLinks?.configured
                                ? "Send the voting link to this nominee on WhatsApp now — resending is allowed"
                                : "Link the awards WhatsApp number above first; meanwhile the WhatsApp button opens the same message"}
                          >
                            {linkSent ? "RESEND LINK" : "SEND LINK"}
                          </button>
                          {linkInfo?.notification && !linkSent && (
                            <span className="text-[11px] text-amber-400/80" data-testid={`link-status-approved-${req.id}`}>
                              {linkInfo.notification.status === "not_configured"
                                ? "not sent yet"
                                : linkInfo.notification.status === "skipped"
                                  ? "already messaged on this number"
                                  : linkInfo.notification.status}
                            </span>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground/60 mt-2">No phone on file</p>
                      )}
                    </div>
                    <div className="flex flex-col gap-2 shrink-0 w-full sm:w-56">
                      <select
                        value=""
                        onChange={(e) => {
                          const newCat = e.target.value;
                          if (newCat && newCat !== req.category) {
                            moveCategoryMutation.mutate({ id: req.id, category: newCat, keepApproved: true });
                          }
                        }}
                        disabled={moveCategoryMutation.isPending}
                        data-testid={`select-move-category-approved-${req.id}`}
                        className="px-3 py-2 bg-accent/10 text-accent border border-accent/30 rounded-xl text-xs font-bold cursor-pointer focus:outline-none focus:border-accent transition-all w-full"
                      >
                        <option value="" className="bg-black">⇄ MOVE TO CATEGORY…</option>
                        {categories.filter((c) => c.id !== req.category).map((c) => {
                          const cc = capMap.get(c.id);
                          const full = cc?.isFull;
                          return (
                            <option key={c.id} value={c.id} className="bg-black" disabled={full}>
                              {c.name} {cc ? `(${cc.approved}/${cc.cap}${full ? " FULL" : ""})` : ""}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  </div>
                );
              });
            })()}
          </motion.div>
        )}

        {activeTab === "delete" && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="bg-card border border-white/10 rounded-2xl p-6 sm:p-8">
              <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
                <h3 className="font-display text-xl text-white flex items-center gap-2">
                  <Trash2 className="w-5 h-5 text-red-400" />
                  MANAGE NOMINEES
                </h3>
                <span className="text-sm text-muted-foreground" data-testid="text-artist-count">
                  {loadingArtists ? "Loading…" : `${filteredArtists.length} of ${allArtists.length} shown`}
                </span>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 mb-6">
                <select
                  value={deleteCategory}
                  onChange={(e) => setDeleteCategory(e.target.value)}
                  data-testid="select-delete-category"
                  className="bg-black/50 border border-white/10 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-red-400 transition-all font-bold appearance-none cursor-pointer"
                >
                  <option value="" className="bg-black">All Categories</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id} className="bg-black">{cat.name}</option>
                  ))}
                </select>

                <div className="flex-1 relative">
                  <Search className="w-4 h-4 text-muted-foreground absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={deleteSearch}
                    onChange={(e) => setDeleteSearch(e.target.value)}
                    data-testid="input-delete-search"
                    placeholder="Filter by name…"
                    className="w-full bg-black/50 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-white placeholder:text-white/30 focus:outline-none focus:border-red-400 transition-all"
                  />
                </div>

                {(deleteCategory || deleteSearch) && (
                  <button
                    onClick={() => { setDeleteCategory(""); setDeleteSearch(""); }}
                    data-testid="button-clear-filters"
                    className="px-4 py-3 bg-white/5 border border-white/10 text-muted-foreground rounded-xl hover:bg-white/10 hover:text-white transition-all flex items-center gap-2 text-sm font-bold"
                  >
                    <X className="w-4 h-4" /> CLEAR
                  </button>
                )}
              </div>

              {loadingArtists ? (
                <div className="text-center py-12 text-muted-foreground/50">
                  <div className="w-8 h-8 border-2 border-red-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                  <p>Loading nominees…</p>
                </div>
              ) : filteredArtists.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground/50">
                  <Inbox className="w-12 h-12 mx-auto mb-3 opacity-40" />
                  {allArtists.length === 0 ? (
                    <p>No approved nominees yet. Approve a nomination first.</p>
                  ) : (
                    <p>No nominees match your filter. Try clearing it.</p>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredArtists.map((artist: any) => {
                    const isConfirming = confirmDeleteId === artist.id;
                    const isEditingBio = editingBioId === artist.id;
                    const isEditingArtist = editingArtistId === artist.id;
                    return (
                      <div key={artist.id} data-testid={`delete-card-${artist.id}`} className={`bg-black/30 border rounded-xl p-4 transition-all ${isConfirming ? "border-red-500/60 bg-red-500/5" : isEditingArtist ? "border-secondary/50 bg-secondary/5" : isEditingBio ? "border-primary/40 bg-primary/5" : "border-white/5"}`}>
                        <div className="flex items-center gap-4">
                          <div className="w-16 h-16 rounded-lg overflow-hidden border border-white/10 shrink-0">
                            <img src={isEditingArtist && editingArtistImageUrl ? editingArtistImageUrl : artist.imageUrl} alt={artist.name} className="w-full h-full object-cover object-top" onError={(e) => { (e.target as HTMLImageElement).src = "/placeholder.svg"; }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-display text-lg text-white truncate">{artist.name}</h4>
                            <p className="text-xs text-primary font-bold truncate">{categoryName(artist.category)}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{artist.totalVotes} {artist.totalVotes === 1 ? "vote" : "votes"}</p>
                            <button
                              onClick={() => posterReadyMutation.mutate({ id: artist.id, posterReady: !artist.posterReady })}
                              disabled={posterReadyMutation.isPending}
                              data-testid={`button-poster-ready-${artist.id}`}
                              title={artist.posterReady ? "Tap to remove the official-poster mark" : "Tap to allow this nominee in the poster-only social queue"}
                              className={`mt-1.5 inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border transition-colors disabled:opacity-50 ${artist.posterReady ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25" : "bg-white/5 text-muted-foreground border-white/10 hover:bg-white/10 hover:text-white"}`}
                            >
                              {artist.posterReady ? <><Check className="w-3 h-3" /> OFFICIAL POSTER</> : <>NO OFFICIAL POSTER · MARK</>}
                            </button>
                            {artist.bio && !isEditingBio && !isEditingArtist && (
                              <p className="text-xs text-white/40 mt-1 truncate italic">{artist.bio}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {isConfirming ? (
                              <>
                                <button
                                  onClick={() => deleteMutation.mutate(artist.id)}
                                  disabled={deleteMutation.isPending}
                                  data-testid={`button-confirm-delete-${artist.id}`}
                                  className="px-3 py-2 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-all flex items-center gap-1.5 text-sm font-bold disabled:opacity-50"
                                >
                                  <Check className="w-4 h-4" /> {deleteMutation.isPending ? "..." : "CONFIRM"}
                                </button>
                                <button
                                  onClick={() => setConfirmDeleteId(null)}
                                  disabled={deleteMutation.isPending}
                                  data-testid={`button-cancel-delete-${artist.id}`}
                                  className="px-3 py-2 bg-white/5 border border-white/10 text-muted-foreground rounded-xl hover:bg-white/10 transition-all text-sm font-bold"
                                >
                                  CANCEL
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => {
                                    if (isEditingArtist) {
                                      setEditingArtistId(null);
                                      setEditingArtistName("");
                                      setEditingArtistImageUrl("");
                                      setEditingArtistPosterReady(false);
                                    } else {
                                      setEditingArtistId(artist.id);
                                      setEditingArtistName(artist.name);
                                      setEditingArtistImageUrl(artist.imageUrl);
                                      setEditingArtistPosterReady(artist.posterReady === true);
                                      setEditingBioId(null);
                                      setConfirmDeleteId(null);
                                    }
                                  }}
                                  data-testid={`button-edit-artist-${artist.id}`}
                                  className={`px-3 py-2 border rounded-xl transition-all flex items-center gap-1.5 text-sm font-bold ${isEditingArtist ? "bg-secondary/20 text-secondary border-secondary/40" : "bg-white/5 text-white/50 border-white/10 hover:bg-white/10 hover:text-white"}`}
                                >
                                  <Pencil className="w-3.5 h-3.5" /> EDIT
                                </button>
                                <button
                                  onClick={() => {
                                    setEditingBioId(isEditingBio ? null : artist.id);
                                    setEditingBioText(isEditingBio ? "" : (artist.bio || ""));
                                    setEditingArtistId(null);
                                    setConfirmDeleteId(null);
                                  }}
                                  data-testid={`button-edit-bio-${artist.id}`}
                                  className={`px-3 py-2 border rounded-xl transition-all flex items-center gap-1.5 text-sm font-bold ${isEditingBio ? "bg-primary/20 text-primary border-primary/40" : "bg-white/5 text-white/50 border-white/10 hover:bg-white/10 hover:text-white"}`}
                                >
                                  ✏️ BIO
                                </button>
                                <button
                                  onClick={() => { setConfirmDeleteId(artist.id); setEditingBioId(null); setEditingArtistId(null); }}
                                  data-testid={`button-delete-${artist.id}`}
                                  className="px-4 py-2 bg-red-500/20 text-red-400 border border-red-500/30 rounded-xl hover:bg-red-500/30 transition-all flex items-center gap-2 text-sm font-bold"
                                >
                                  <Trash2 className="w-4 h-4" /> DELETE
                                </button>
                              </>
                            )}
                          </div>
                        </div>

                        {isEditingArtist && (
                          <div className="mt-4 pt-4 border-t border-secondary/20">
                            <p className="text-xs text-secondary font-bold mb-3 uppercase tracking-wider flex items-center gap-2">
                              <Pencil className="w-3 h-3" /> Edit name & photo for {artist.name}
                            </p>
                            <div className="space-y-3">
                              <div>
                                <label className="text-xs text-muted-foreground uppercase tracking-wider mb-1 block">Name</label>
                                <input
                                  value={editingArtistName}
                                  onChange={(e) => setEditingArtistName(e.target.value)}
                                  data-testid={`input-edit-name-${artist.id}`}
                                  placeholder="Artist / DJ / MC name"
                                  className="w-full bg-black/50 border border-white/10 rounded-xl py-3 px-4 text-white placeholder:text-white/30 focus:outline-none focus:border-secondary/50 transition-all font-display text-lg"
                                />
                              </div>
                              <div>
                                <label className="text-xs text-muted-foreground uppercase tracking-wider mb-1 block">Photo</label>
                                <div className="flex gap-2 items-center flex-wrap">
                                  {editingArtistUploading ? (
                                    <button
                                      type="button"
                                      onClick={cancelUpload}
                                      data-testid={`button-cancel-upload-${artist.id}`}
                                      className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold border bg-red-500/20 border-red-500/40 text-red-400 hover:bg-red-500/30 transition-all"
                                    >
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                      Uploading… TAP TO CANCEL
                                    </button>
                                  ) : (
                                    <label
                                      data-testid={`button-edit-photo-${artist.id}`}
                                      className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold cursor-pointer transition-all border bg-accent/20 border-accent/30 text-accent hover:bg-accent/30"
                                    >
                                      <Upload className="w-4 h-4" />
                                      Upload new photo
                                      <input type="file" accept="image/*" onChange={handleEditArtistPhotoUpload} className="hidden" />
                                    </label>
                                  )}
                                  {editingArtistImageUrl && editingArtistImageUrl !== artist.imageUrl && (
                                    <span className="text-xs text-secondary font-bold">✓ New photo ready</span>
                                  )}
                                </div>
                                {editingArtistImageUrl && (
                                  <div className="mt-2 w-24 h-24 rounded-lg overflow-hidden border border-secondary/30">
                                    <img src={editingArtistImageUrl} alt="Preview" className="w-full h-full object-cover object-top" />
                                  </div>
                                )}
                              </div>
                              <label className="flex items-start gap-3 rounded-xl border border-secondary/25 bg-secondary/5 p-3 cursor-pointer select-none">
                                <input
                                  type="checkbox"
                                  checked={editingArtistPosterReady}
                                  onChange={(e) => setEditingArtistPosterReady(e.target.checked)}
                                  data-testid={`checkbox-edit-poster-ready-${artist.id}`}
                                  className="mt-0.5 h-4 w-4 shrink-0 accent-[#E1306C] cursor-pointer"
                                />
                                <span>
                                  <span className="block text-xs font-bold text-white">Official poster is ready</span>
                                  <span className="block text-[11px] text-muted-foreground mt-0.5">
                                    Only tick this when the photo above is the finished campaign poster. Ordinary profile photos stay out of the poster-only queue.
                                  </span>
                                </span>
                              </label>
                            </div>
                            <div className="flex gap-2 mt-3">
                              <button
                                onClick={() => updateArtistMutation.mutate({ id: artist.id, name: editingArtistName, imageUrl: editingArtistImageUrl, posterReady: editingArtistPosterReady })}
                                disabled={updateArtistMutation.isPending || !editingArtistName.trim() || !editingArtistImageUrl.trim()}
                                data-testid={`button-save-artist-${artist.id}`}
                                className="px-4 py-2 bg-secondary text-black rounded-xl hover:bg-secondary/90 transition-all flex items-center gap-1.5 text-sm font-bold disabled:opacity-40"
                              >
                                <Check className="w-4 h-4" /> {updateArtistMutation.isPending ? "SAVING…" : "SAVE CHANGES"}
                              </button>
                              <button
                                onClick={() => { setEditingArtistId(null); setEditingArtistName(""); setEditingArtistImageUrl(""); setEditingArtistPosterReady(false); }}
                                data-testid={`button-cancel-edit-artist-${artist.id}`}
                                className="px-4 py-2 bg-white/5 border border-white/10 text-muted-foreground rounded-xl hover:bg-white/10 transition-all text-sm font-bold"
                              >
                                CANCEL
                              </button>
                            </div>
                          </div>
                        )}

                        {isEditingBio && (
                          <div className="mt-4 pt-4 border-t border-white/10">
                            <p className="text-xs text-primary font-bold mb-2 uppercase tracking-wider">Write bio for {artist.name}</p>
                            <textarea
                              value={editingBioText}
                              onChange={(e) => setEditingBioText(e.target.value)}
                              data-testid={`textarea-bio-${artist.id}`}
                              placeholder="Write a short bio about this nominee... (e.g. genre, background, achievements)"
                              rows={3}
                              className="w-full bg-black/50 border border-white/10 rounded-xl py-3 px-4 text-white placeholder:text-white/30 focus:outline-none focus:border-primary/50 transition-all text-sm resize-none"
                            />
                            <div className="flex gap-2 mt-2">
                              <button
                                onClick={() => updateBioMutation.mutate({ id: artist.id, bio: editingBioText })}
                                disabled={updateBioMutation.isPending}
                                data-testid={`button-save-bio-${artist.id}`}
                                className="px-4 py-2 bg-primary text-black rounded-xl hover:bg-primary/90 transition-all flex items-center gap-1.5 text-sm font-bold disabled:opacity-50"
                              >
                                <Check className="w-4 h-4" /> {updateBioMutation.isPending ? "SAVING…" : "SAVE BIO"}
                              </button>
                              <button
                                onClick={() => { setEditingBioId(null); setEditingBioText(""); }}
                                data-testid={`button-cancel-bio-${artist.id}`}
                                className="px-4 py-2 bg-white/5 border border-white/10 text-muted-foreground rounded-xl hover:bg-white/10 transition-all text-sm font-bold"
                              >
                                CANCEL
                              </button>
                              {artist.bio && (
                                <button
                                  onClick={() => updateBioMutation.mutate({ id: artist.id, bio: "" })}
                                  disabled={updateBioMutation.isPending}
                                  data-testid={`button-clear-bio-${artist.id}`}
                                  className="px-4 py-2 bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl hover:bg-red-500/20 transition-all text-sm font-bold"
                                >
                                  CLEAR BIO
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {activeTab === "votes" && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div
              className={`rounded-2xl border p-5 sm:p-6 transition-colors ${
                manualVotesEnabled
                  ? "border-emerald-400/30 bg-emerald-500/[0.07]"
                  : "border-white/10 bg-card"
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div
                    className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${
                      manualVotesEnabled
                        ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-300"
                        : "border-white/10 bg-white/5 text-muted-foreground"
                    }`}
                  >
                    <Plus className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-display text-lg text-white tracking-wide">MANUAL ADJUSTMENT LOG</h3>
                    <p className="text-xs text-muted-foreground mt-1 max-w-xl leading-relaxed">
                      {manualVotesEnabled
                        ? "The log controls are visible on every nominee below. Entries are audit-only: they never change official vote totals."
                        : "Turn this on to reveal a LOG ADJUSTMENT control on every nominee below. Off means the controls are hidden and the server refuses entries."}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto">
                  <span
                    className={`text-xs font-bold tracking-widest ${
                      manualVotesEnabled ? "text-emerald-300" : "text-muted-foreground"
                    }`}
                    data-testid="text-manual-votes-status"
                  >
                    {loadingManualVoteSettings ? "CHECKING…" : manualVotesEnabled ? "ON" : "OFF"}
                  </span>
                  <Switch
                    checked={manualVotesEnabled}
                    onCheckedChange={(checked) => toggleManualVotesMutation.mutate(checked)}
                    disabled={loadingManualVoteSettings || toggleManualVotesMutation.isPending}
                    aria-label="Toggle manual vote adjustment logging"
                    data-testid="toggle-manual-votes"
                    className="data-[state=checked]:bg-emerald-500 data-[state=unchecked]:bg-white/15"
                  />
                </div>
              </div>

              {manualVotesEnabled && (
                <div className="mt-4 rounded-xl border border-emerald-400/20 bg-black/20 px-4 py-3">
                  <p className="text-xs text-emerald-100/80 leading-relaxed">
                    <strong className="text-emerald-300">Audit only.</strong> Entries are written to the admin audit
                    log for review but never added to any vote total. Official totals are rebuilt from paid votes only.
                  </p>
                </div>
              )}
            </div>

            <div className="bg-card border border-white/10 rounded-2xl p-6 sm:p-8">
              <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
                <div>
                  <h3 className="font-display text-xl text-white flex items-center gap-2">
                    <BarChart2 className="w-5 h-5 text-primary" />
                    VOTE MANAGER
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Official paid-vote counts — final results.
                  </p>
                </div>
                <div className="flex flex-col items-end gap-3">
                  <div className="text-right">
                    <p className="text-2xl font-display text-primary font-bold" data-testid="text-total-votes">
                      {allArtists.reduce((sum: number, a: any) => sum + (a.totalVotes || 0), 0).toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground">paid votes cast</p>
                  </div>
                  <button
                    onClick={() => shuffleMutation.mutate()}
                    disabled={shuffleMutation.isPending}
                    data-testid="button-shuffle-nominees"
                    className="flex items-center gap-2 px-4 py-2 bg-accent/20 border border-accent/40 text-accent rounded-xl text-sm font-bold hover:bg-accent/30 transition-all disabled:opacity-50"
                  >
                    <Shuffle className="w-4 h-4" />
                    {shuffleMutation.isPending ? "SHUFFLING…" : "SHUFFLE ORDER"}
                  </button>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 mb-6">
                <select
                  value={votesCategory}
                  onChange={(e) => setVotesCategory(e.target.value)}
                  data-testid="select-votes-category"
                  className="bg-black/50 border border-white/10 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-primary transition-all font-bold appearance-none cursor-pointer"
                >
                  <option value="" className="bg-black">All Categories</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id} className="bg-black">{cat.name}</option>
                  ))}
                </select>
                <div className="flex-1 relative">
                  <Search className="w-4 h-4 text-muted-foreground absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={votesSearch}
                    onChange={(e) => setVotesSearch(e.target.value)}
                    data-testid="input-votes-search"
                    placeholder="Search by name…"
                    className="w-full bg-black/50 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-white placeholder:text-white/30 focus:outline-none focus:border-primary transition-all"
                  />
                </div>
              </div>

              {loadingArtists ? (
                <p className="text-muted-foreground text-sm">Loading nominees…</p>
              ) : (() => {
                const filtered = allArtists
                  .filter((a: any) => {
                    if (votesCategory && a.category !== votesCategory) return false;
                    if (votesSearch && !a.name?.toLowerCase().includes(votesSearch.toLowerCase())) return false;
                    return true;
                  })
                  .slice()
                  .sort((a: any, b: any) => b.totalVotes - a.totalVotes);

                if (filtered.length === 0) {
                  return <p className="text-muted-foreground text-sm text-center py-8">No nominees found.</p>;
                }

                return (
                  <div className="space-y-3">
                    {filtered.map((artist: any, idx: number) => {
                      const catName = categoryName(artist.category);
                      const addVal = addAmounts[artist.id] ?? "";
                      const addNum = parseInt(addVal, 10);
                      const canAdd =
                        Number.isInteger(addNum) && addNum > 0 && addNum <= MAX_MANUAL_VOTES_PER_ADDITION;
                      const isAdding =
                        addVotesMutation.isPending && addVotesMutation.variables?.id === artist.id;
                      return (
                        <div
                          key={artist.id}
                          data-testid={`votes-card-${artist.id}`}
                          className="bg-black/30 border border-white/5 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4"
                        >
                          <span className="text-2xl font-display text-primary/40 w-8 shrink-0 text-center hidden sm:block">
                            {idx + 1}
                          </span>
                          <div className="w-12 h-12 rounded-lg overflow-hidden border border-white/10 shrink-0">
                            <img
                              src={artist.imageUrl}
                              alt={artist.name}
                              className="w-full h-full object-cover object-top"
                              onError={(e) => { (e.target as HTMLImageElement).src = "/placeholder.svg"; }}
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-display text-base text-white truncate">{artist.name}</h4>
                            <p className="text-xs text-primary/70 truncate">{catName}</p>
                            <p
                              data-testid={`ussd-code-${artist.id}`}
                              className="mt-1 inline-flex items-center gap-1 rounded border border-primary/25 bg-primary/10 px-2 py-0.5 font-mono text-[11px] text-primary"
                              title={`Fans dial ${USSD_SHORTCODE} and enter ${ussdNomineeCode(artist.id)} to vote for ${artist.name}`}
                            >
                              USSD {ussdNomineeCode(artist.id)}
                            </p>

                            {manualVotesEnabled && (
                              <div className="mt-3 flex flex-wrap items-center gap-2">
                                <input
                                  type="number"
                                  inputMode="numeric"
                                  min={1}
                                  max={MAX_MANUAL_VOTES_PER_ADDITION}
                                  step={1}
                                  value={addVal}
                                  onChange={(e) => {
                                    const raw = e.target.value.replace(/[^0-9]/g, "");
                                    setAddAmounts((prev) => ({ ...prev, [artist.id]: raw }));
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" && canAdd && !isAdding) {
                                      e.preventDefault();
                                      addVotesMutation.mutate({ id: artist.id, add: addNum });
                                    }
                                  }}
                                  aria-label={`Manual votes to log for ${artist.name}`}
                                  data-testid={`input-add-votes-${artist.id}`}
                                  placeholder="Votes to log"
                                  className="w-32 rounded-lg border border-emerald-400/25 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-emerald-400/60 focus:ring-1 focus:ring-emerald-400/30 transition-all"
                                />
                                <button
                                  onClick={() => addVotesMutation.mutate({ id: artist.id, add: addNum })}
                                  disabled={!canAdd || isAdding}
                                  data-testid={`button-add-votes-${artist.id}`}
                                  className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-2 text-xs font-bold text-black transition-all hover:bg-emerald-400 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                  {isAdding ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <Plus className="w-3.5 h-3.5" />
                                  )}
                                  {isAdding ? "LOGGING…" : "LOG ADJUSTMENT"}
                                </button>
                                {canAdd && (
                                  <span
                                    className="text-[11px] font-bold text-amber-300/80"
                                    data-testid={`official-total-note-${artist.id}`}
                                  >
                                    Official total stays {(artist.totalVotes || 0).toLocaleString()} — not counted
                                  </span>
                                )}
                                {addVal && !canAdd && (
                                  <span className="text-[11px] font-bold text-amber-300/80">
                                    1–{MAX_MANUAL_VOTES_PER_ADDITION.toLocaleString()} at a time
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-xl font-display text-secondary font-bold" data-testid={`votes-count-${artist.id}`}>
                              {(artist.totalVotes || 0).toLocaleString()}
                            </p>
                            <p className="text-xs text-muted-foreground">official votes</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

            {/* Stuck Payments */}
            {pendingPayments.length > 0 && (
              <div className="bg-amber-950/30 border border-amber-500/30 rounded-2xl p-6">
                <div className="flex items-center gap-2 mb-4">
                  <AlertTriangle className="w-5 h-5 text-amber-400" />
                  <h3 className="font-display text-lg text-amber-400">STUCK PAYMENTS ({pendingPayments.length})</h3>
                </div>
                <p className="text-xs text-amber-300/70 mb-5">
                  Orders that never produced a vote. <strong>RECOVER</strong> asks MegaPay first: a paid order is
                  credited, a failed one is cleared without a vote, and an unconfirmed one is left alone. Orders
                  from before verification was added must be checked against your M-Pesa statement.
                </p>
                <div className="space-y-3">
                  {pendingPayments.map((p: any) => {
                    const artist = allArtists.find((a: any) => a.id === p.artistId);
                    const catName = artist?.category ? categoryName(artist.category) : "Unknown";
                    return (
                      <div key={p.reference} className="flex flex-col sm:flex-row sm:items-center gap-3 bg-black/40 border border-amber-500/20 rounded-xl p-4">
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-bold text-sm">{artist?.name ?? `Artist #${p.artistId}`}</p>
                          <p className="text-xs text-amber-300/60">{catName}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            KES {p.amountKes} · {p.votesAdded} vote{p.votesAdded !== 1 ? "s" : ""} · {new Date(p.createdAt).toLocaleString("en-KE", { timeZone: "Africa/Nairobi" })}
                          </p>
                          <p className="text-[10px] text-muted-foreground/50 font-mono truncate mt-0.5">{p.reference}</p>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <button
                            onClick={() => recoverMutation.mutate(p.reference)}
                            disabled={recoverMutation.isPending || dismissPendingMutation.isPending}
                            data-testid={`button-recover-${p.reference}`}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg text-xs font-bold hover:bg-green-500 transition-all disabled:opacity-50"
                          >
                            RECOVER
                          </button>
                          <button
                            onClick={() => dismissPendingMutation.mutate(p.reference)}
                            disabled={recoverMutation.isPending || dismissPendingMutation.isPending}
                            data-testid={`button-dismiss-${p.reference}`}
                            className="px-4 py-2 bg-red-900/50 border border-red-500/30 text-red-400 rounded-lg text-xs font-bold hover:bg-red-800/50 transition-all disabled:opacity-50"
                          >
                            DISMISS
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Recent paid votes — undo a reversed payment */}
            <div className="bg-card border border-white/10 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="w-5 h-5 text-secondary" />
                <h3 className="font-display text-lg text-white">RECENT PAID VOTES</h3>
              </div>
              <p className="text-xs text-muted-foreground mb-4">
                Every vote credited in the last 14 days. If Safaricom reversed a payment after the fan saw
                “vote added”, remove that vote here — it deletes the ledger row and gives the votes back.
              </p>
              {recentVotes.length === 0 ? (
                <p className="text-sm text-muted-foreground">No paid votes recorded yet.</p>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                  {recentVotes.slice(0, 15).map((v: any) => (
                    <div
                      key={v.reference}
                      className="bg-black/30 border border-white/5 rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white font-semibold truncate">{v.artistName}</p>
                        <p className="text-[11px] text-primary/70 truncate">{categoryName(v.category)}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {v.votesAdded} vote{v.votesAdded === 1 ? "" : "s"} · KES {v.amountKes} ·{" "}
                          {new Date(v.createdAt).toLocaleString("en-KE", { timeZone: "Africa/Nairobi" })}
                        </p>
                        <p className="text-[10px] text-muted-foreground/50 font-mono truncate">{v.reference}</p>
                      </div>
                      <button
                        onClick={() => {
                          if (window.confirm(`Remove ${v.votesAdded} vote(s) for ${v.artistName}? Only do this if the payment was reversed or refunded.`)) {
                            voidVoteMutation.mutate(v.reference);
                          }
                        }}
                        disabled={voidVoteMutation.isPending}
                        data-testid={`button-void-${v.reference}`}
                        className="shrink-0 px-4 py-2 bg-red-900/50 border border-red-500/30 text-red-300 rounded-lg text-xs font-bold hover:bg-red-800/60 transition-all disabled:opacity-50"
                      >
                        VOID VOTE
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {activeTab === "social" && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
            data-testid="social-automation"
          >
            <div className="bg-card border border-white/10 rounded-2xl p-6 md:p-8 shadow-2xl">
              <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-[#E1306C]/15 border border-[#E1306C]/35 flex items-center justify-center shrink-0">
                  <Share2 className="w-6 h-6 text-[#FF5A9E]" />
                </div>
                <div className="flex-1">
                  <h2 className="font-display text-2xl md:text-3xl text-white tracking-wide">SOCIAL POSTER STUDIO</h2>
                  <p className="text-sm text-muted-foreground mt-1 leading-relaxed max-w-3xl">
                    Only nominees you mark as having an <span className="text-white">official poster</span> are queued. Facebook and TikTok
                    get the still poster; YouTube gets a 20-second vertical video of that poster with an original gospel organ instrumental.
                    Every caption is built from <span className="text-white">that nominee's</span> name, category, USSD code and public page —
                    never a generic caption that can land on the wrong poster. Instagram is intentionally left untouched.
                  </p>
                  <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                    Posters come from each nominee's photo in this admin panel — not from Zernio. Add a new one with{" "}
                    <span className="text-white">ADD ARTIST</span> (tick "Official poster is ready" only if that upload is the finished poster), replace one in{" "}
                    <span className="text-white">DELETE → EDIT → Upload new photo</span>, or tap the{" "}
                    <span className="text-white">NO OFFICIAL POSTER · MARK</span> pill on any nominee whose uploaded photo is already the finished poster.
                  </p>
                </div>
                <span
                  className={`shrink-0 inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-full ${
                    !social?.configured
                      ? "bg-amber-500/15 text-amber-300"
                      : social?.enabled
                        ? "bg-emerald-500/15 text-emerald-300"
                        : "bg-white/5 text-muted-foreground"
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${!social?.configured ? "bg-amber-400" : social?.enabled ? "bg-emerald-400" : "bg-white/40"}`} />
                  {!social?.configured ? "SETUP NEEDED" : social?.enabled ? "AUTO-POSTING ON" : "PAUSED"}
                </span>
              </div>

              {params.get("social") === "connected" && (
                <div className="mt-5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
                  Zernio returned from the connection flow. Refresh the accounts below and connect any remaining platform.
                </div>
              )}

              {social && (
                <div className={`mt-5 rounded-2xl border p-4 ${social.onlyWithPosters ? "border-emerald-500/30 bg-emerald-500/5" : "border-amber-500/40 bg-amber-500/10"}`}>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="flex-1">
                      <p className="text-sm font-bold text-white flex items-center gap-2">
                        <ImageIcon className="w-4 h-4" />
                        ONLY POST NOMINEES WITH AN OFFICIAL POSTER
                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${social.onlyWithPosters ? "bg-emerald-500/20 text-emerald-300" : "bg-amber-500/20 text-amber-200"}`}>
                          {social.onlyWithPosters ? "ON" : "OFF"}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                        {social.posterReadyCount ?? 0} of {social.posterTotalCount ?? 0} nominees are marked as poster-ready.
                        {" "}
                        {social.onlyWithPosters
                          ? "Unmarked nominees are skipped completely, so an ordinary profile photo cannot be published as a poster. Mark them in DELETE → MANAGE NOMINEES."
                          : "Warning: every approved nominee is eligible, including those without a finished official poster."}
                      </p>
                    </div>
                    <button
                      onClick={() => posterFilterMutation.mutate(!social.onlyWithPosters)}
                      disabled={posterFilterMutation.isPending}
                      data-testid="button-poster-filter"
                      className={`shrink-0 px-4 py-2.5 rounded-xl text-xs font-bold transition-colors disabled:opacity-40 ${social.onlyWithPosters ? "bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25" : "bg-amber-500/20 border border-amber-500/40 text-amber-100 hover:bg-amber-500/30"}`}
                    >
                      {posterFilterMutation.isPending
                        ? "…"
                        : social.onlyWithPosters
                          ? "TURN FILTER OFF"
                          : "TURN POSTER FILTER ON"}
                    </button>
                  </div>
                </div>
              )}

              {!social?.configured ? (
                <div className="mt-6 rounded-2xl border border-amber-500/35 bg-amber-500/10 p-5 md:p-6">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-amber-400" />
                    <p className="font-display text-lg text-amber-200 tracking-wide">ONE KEY, THEN CONNECT</p>
                  </div>
                  <ol className="mt-3 space-y-2 text-sm text-amber-100/85 list-decimal list-inside leading-relaxed">
                    <li>Get an API key at <a href="https://zernio.com" target="_blank" rel="noreferrer" className="text-white underline underline-offset-4">zernio.com</a> (Settings → API Keys).</li>
                    <li>Add it in <strong className="text-white">Settings → Environment</strong> as <code className="bg-black/40 px-1.5 py-0.5 rounded text-amber-200">ZERNIO_API_KEY</code>.</li>
                    <li>Come back here, press refresh, and connect the Hope Awards Facebook Page, TikTok and YouTube channel.</li>
                    <li>YouTube uploads are rendered automatically as vertical videos with a gospel instrumental — you never upload a song or video yourself.</li>
                  </ol>
                  <p className="mt-4 text-xs text-amber-100/60 leading-relaxed">
                    The integration uses the official{" "}
                    <a href="https://github.com/zernio-dev/zernio-node" target="_blank" rel="noreferrer" className="text-white underline underline-offset-4">
                      zernio-dev/zernio-node
                    </a>{" "}
                    repository. No second app or server is needed: this panel is the queue.
                  </p>
                </div>
              ) : (
                <>
                  {social?.error && (
                    <div className="mt-5 rounded-xl border border-red-500/35 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                      {social.error}
                    </div>
                  )}

                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-6">
                    {SOCIAL_PLATFORM_META.map((platform) => {
                      const account = (social?.accounts ?? []).find((a: any) => a.platform === platform.id);
                      const connected = Boolean(account) && !account?.needsReconnection;
                      const Icon = platform.icon;
                      return (
                        <div key={platform.id} className={`rounded-2xl border ${platform.className} p-4`}>
                          <div className="flex items-center gap-2">
                            <Icon className={`w-4 h-4 ${platform.iconClassName}`} />
                            <p className="text-sm font-bold text-white">{platform.label}</p>
                            <span className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full ${connected ? "bg-emerald-500/15 text-emerald-300" : account?.needsReconnection ? "bg-amber-500/15 text-amber-300" : "bg-black/30 text-white/40"}`}>
                              {connected ? "CONNECTED" : account?.needsReconnection ? "RECONNECT" : "NOT CONNECTED"}
                            </span>
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-1 truncate">
                            {account ? `@${account.username ?? platform.hint.replace(/^@/, "")}` : platform.hint}
                          </p>
                          <button
                            onClick={() => connectSocialMutation.mutate(platform.id)}
                            disabled={connectSocialMutation.isPending}
                            className="mt-3 w-full px-3 py-2 rounded-xl bg-black/35 border border-white/10 text-[11px] font-bold text-white/80 hover:bg-black/55 hover:text-white transition-colors disabled:opacity-40"
                          >
                            {connectSocialMutation.isPending && connectSocialMutation.variables === platform.id
                              ? "OPENING ZERNIO…"
                              : account || account?.needsReconnection
                                ? "RECONNECT"
                                : `CONNECT ${platform.label.toUpperCase()}`}
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex flex-col lg:flex-row lg:items-center gap-4 mt-6 rounded-2xl border border-white/10 bg-black/30 p-4">
                    <div className="flex-1">
                      <p className="text-sm font-bold text-white">
                        {social?.remaining ?? 0} {social?.onlyWithPosters ? "poster-ready nominee" : "poster"}{(social?.remaining ?? 0) === 1 ? "" : "s"} waiting
                      </p>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                        {social?.enabled
                          ? "The next eligible poster publishes automatically, then one every 4 hours. That keeps YouTube at six uploads a day, inside its API quota. Pausing never deletes the queue."
                          : "Press START AUTO-POSTING to send the next poster at the next queue check (within five minutes). Pausing never deletes the queue."}
                        {social && !social.runsOnThisServer && " Automatic and manual publishing run on the production server; this preview will not post to the live pages."}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => toggleSocialMutation.mutate(!social?.enabled)}
                        disabled={toggleSocialMutation.isPending || (!social?.enabled && (social?.accounts ?? []).length === 0)}
                        className={`px-4 py-2.5 rounded-xl text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed transition-colors ${
                          social?.enabled
                            ? "bg-amber-500/15 border border-amber-500/40 text-amber-300 hover:bg-amber-500/25"
                            : "bg-secondary text-black hover:bg-secondary/90"
                        }`}
                      >
                        {toggleSocialMutation.isPending ? "…" : social?.enabled ? <><Pause className="w-3.5 h-3.5 inline mr-1.5" />PAUSE AUTO-POSTING</> : <><Play className="w-3.5 h-3.5 inline mr-1.5" />START AUTO-POSTING</>}
                      </button>
                      <button
                        onClick={() => postSocialMutation.mutate()}
                        disabled={postSocialMutation.isPending || (social?.accounts ?? []).length === 0 || !social?.next || !social?.runsOnThisServer}
                        className="px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs font-bold text-white hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
                      >
                        {postSocialMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                        {postSocialMutation.isPending ? "PUBLISHING…" : "POST NEXT POSTER"}
                      </button>
                      <button
                        onClick={() => refetchSocial()}
                        className="px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs font-bold text-muted-foreground hover:text-white"
                        title="Refresh accounts and queue"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {social?.next ? (
                    <div className="mt-6 grid lg:grid-cols-[220px_1fr] gap-5 rounded-2xl border border-secondary/25 bg-secondary/5 p-4">
                      <div>
                        <p className="text-[10px] font-bold tracking-widest text-secondary/70 mb-2">NEXT POSTER</p>
                        <img
                          src={social.next.imageUrl}
                          alt={`${social.next.name} poster`}
                          className="w-full aspect-[4/5] object-cover rounded-xl border border-white/10 bg-black/40"
                          loading="lazy"
                        />
                        <p className="text-sm font-bold text-white mt-2 truncate">{social.next.name}</p>
                        <p className="text-[11px] text-secondary/80 truncate">{social.next.categoryName}</p>
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[10px] font-bold tracking-widest text-secondary/70">CAPTION PREVIEW · AUTO-GENERATED</p>
                          <p className="text-[10px] text-muted-foreground">One caption per nominee, every connected platform</p>
                        </div>
                        <pre className="mt-2 whitespace-pre-wrap break-words text-xs leading-relaxed text-white/80 font-sans bg-black/35 rounded-xl border border-white/5 p-4 max-h-72 overflow-y-auto">
                          {social.next.caption}
                        </pre>
                        <p className="mt-2 text-[11px] text-muted-foreground leading-relaxed">
                          No caption typing is needed. This is built from the nominee's own name, category, USSD code and public page;
                          it always names the person on the poster and uses the public voting-close date. YouTube uses the title as the
                          video title and this caption as the description; Facebook uses the full caption, and TikTok gets a short title
                          plus the full description.
                        </p>
                      </div>
                    </div>
                  ) : social?.onlyWithPosters && (social?.posterReadyCount ?? 0) === 0 ? (
                    <div className="mt-6 rounded-2xl border border-amber-500/35 bg-amber-500/10 p-5 text-sm text-amber-100">
                      <p className="font-bold">No nominees are marked as having an official poster yet.</p>
                      <p className="mt-1 text-amber-100/75 leading-relaxed">
                        Open <span className="text-white">DELETE → MANAGE NOMINEES</span> and tap{" "}
                        <span className="text-white">NO OFFICIAL POSTER · MARK</span> on each nominee whose uploaded photo is the finished
                        poster. They will appear here immediately. To publish every approved nominee's current photo instead, turn the
                        poster filter off above — but only if those photos are really official posters.
                      </p>
                    </div>
                  ) : (
                    <div className="mt-6 rounded-2xl border border-emerald-500/25 bg-emerald-500/5 p-5 text-sm text-emerald-200">
                      Every eligible nominee in the poster queue has been posted. New approvals and newly marked posters will appear here automatically.
                    </div>
                  )}

                  {(social?.recent ?? []).length > 0 && (
                    <div className="mt-6">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <p className="text-[10px] font-bold tracking-widest text-muted-foreground">RECENT POSTS</p>
                        <p className="text-[10px] text-muted-foreground">One ledger row per nominee, so nothing posts twice</p>
                      </div>
                      <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                        {(social.recent as any[]).map((post: any) => {
                          const posted = (post.platforms ?? []).filter((p: any) => p.status === "published");
                          return (
                            <div key={`${post.artistId}-${post.updatedAt}`} className="rounded-xl border border-white/5 bg-black/30 px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-white font-semibold truncate">{post.artistName}</p>
                                <p className="text-[11px] text-muted-foreground mt-0.5">
                                  {post.updatedAt ? new Date(post.updatedAt).toLocaleString("en-KE", { timeZone: "Africa/Nairobi" }) : "Not published yet"}
                                  {posted.length > 0 && ` · ${posted.length} platform${posted.length === 1 ? "" : "s"} live`}
                                </p>
                                {post.error && <p className="text-[11px] text-red-300/80 mt-1 line-clamp-2">{post.error}</p>}
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                {SOCIAL_PLATFORM_META.map((platform) => {
                                  const entry = (post.platforms ?? []).find((p: any) => p.platform === platform.id);
                                  const Icon = platform.icon;
                                  return (
                                    <span
                                      key={platform.id}
                                      title={`${platform.label}: ${entry?.status ?? "not posted"}`}
                                      className={`w-7 h-7 rounded-lg border flex items-center justify-center ${
                                        entry?.status === "published"
                                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                                          : entry?.status === "failed"
                                            ? "border-red-500/30 bg-red-500/10 text-red-300"
                                            : "border-white/10 bg-white/5 text-white/30"
                                      }`}
                                    >
                                      <Icon className="w-3.5 h-3.5" />
                                    </span>
                                  );
                                })}
                                <span className={`ml-1 text-[10px] font-bold px-2 py-1 rounded-lg ${
                                  post.status === "published"
                                    ? "bg-emerald-500/15 text-emerald-300"
                                    : post.status === "partial" || post.status === "queued"
                                      ? "bg-amber-500/15 text-amber-300"
                                      : post.status === "failed"
                                        ? "bg-red-500/15 text-red-300"
                                        : "bg-white/5 text-white/50"
                                }`}>
                                  {String(post.status).toUpperCase()}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </motion.div>
        )}

        {activeTab === "security" && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            {/* Live M-Pesa STK test */}
            <div className="bg-card border border-primary/30 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-2">
                <Smartphone className="w-5 h-5 text-primary" />
                <h3 className="font-display text-lg text-white">TEST THE M-PESA PUSH</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Sends a real <strong className="text-white/90">10 KES</strong> STK prompt from MegaPay to the
                number you enter, so you can confirm the gateway is live instead of hoping. The test is never
                recorded as a vote — the callback logs it as a test. Only approve the prompt on a phone you
                control: entering your PIN really does deduct 10 KES.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="tel"
                  inputMode="numeric"
                  value={stkPhone}
                  onChange={(e) => setStkPhone(e.target.value)}
                  placeholder="0712 345 678"
                  data-testid="input-stk-phone"
                  className="flex-1 bg-black/50 border border-white/10 rounded-xl py-3 px-4 text-white placeholder:text-white/20 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                />
                <button
                  onClick={sendStkTest}
                  disabled={stkSending || stkPhone.trim().length < 9}
                  data-testid="button-stk-test"
                  className="px-5 py-3 bg-primary text-black rounded-xl font-display text-sm tracking-wide hover:bg-primary/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
                >
                  {stkSending && <Loader2 className="w-4 h-4 animate-spin" />}
                  {stkSending ? "SENDING…" : "SEND TEST PROMPT"}
                </button>
              </div>

              {stkResult && (
                <div
                  data-testid="stk-result"
                  className={`mt-4 rounded-xl border px-4 py-3 text-sm ${
                    stkResult.ok
                      ? "border-secondary/40 bg-secondary/10 text-secondary"
                      : "border-red-500/40 bg-red-500/10 text-red-300"
                  }`}
                >
                  <p className="font-display tracking-wide">
                    {stkResult.ok ? "GATEWAY ACCEPTED THE PUSH" : "PUSH NOT ACCEPTED"}
                  </p>
                  <p className="mt-1 text-white/80">{stkResult.message}</p>
                  <div className="mt-2 space-y-1 text-[11px] font-mono text-muted-foreground break-all">
                    {stkResult.reference && <p>reference: {stkResult.reference}</p>}
                    {stkResult.phone && <p>sent to: {stkResult.phone}</p>}
                    {typeof stkResult.httpStatus === "number" && <p>http: {stkResult.httpStatus}</p>}
                  </div>
                  {stkResult.gateway && (
                    <pre className="mt-2 max-h-40 overflow-auto bg-black/40 rounded-lg p-3 text-[11px] text-white/70 whitespace-pre-wrap break-all">
                      {JSON.stringify(stkResult.gateway, null, 2)}
                    </pre>
                  )}
                </div>
              )}
            </div>

            {/* What is protecting the panel right now */}
            <div className="bg-card border border-white/10 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <ShieldCheck className="w-5 h-5 text-secondary" />
                <h3 className="font-display text-lg text-white">PROTECTIONS ACTIVE</h3>
              </div>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-secondary mt-0.5 shrink-0" />
                  <span>
                    <strong className="text-white/90">CSRF token:</strong>{" "}
                    {getCsrfToken() ? "this browser session is issuing signed write tokens" : "not loaded — reload the page"}
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-secondary mt-0.5 shrink-0" />
                  <span>
                    <strong className="text-white/90">Two-factor login:</strong>{" "}
                    {twoFactor?.enabled ? "ON — an authenticator code is required" : "OFF — set ADMIN_TOTP_SECRET to turn it on"}
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-secondary mt-0.5 shrink-0" />
                  <span>
                    <strong className="text-white/90">Vote limits:</strong> whole-number votes only, a per-transaction
                    ceiling, per-number and per-connection velocity caps, duplicate-order blocking.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-secondary mt-0.5 shrink-0" />
                  <span>
                    <strong className="text-white/90">Audit trail:</strong> every change below is recorded with the IP
                    it came from.
                  </span>
                </li>
              </ul>
            </div>

            {/* Two-factor enrolment */}
            {twoFactor && !twoFactor.enabled && twoFactor.secret && (
              <div className="bg-card border border-accent/30 rounded-2xl p-6">
                <div className="flex items-center gap-2 mb-3">
                  <KeyRound className="w-5 h-5 text-accent" />
                  <h3 className="font-display text-lg text-white">TURN ON TWO-FACTOR</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Add this secret to Google Authenticator, Authy or any TOTP app, then set it on the server as{" "}
                  <code className="text-accent">ADMIN_TOTP_SECRET</code> and restart. From then on, logging in needs the
                  password plus a 6-digit code.
                </p>
                <p
                  data-testid="text-totp-secret"
                  className="font-mono text-sm text-white bg-black/50 border border-white/10 rounded-xl px-4 py-3 break-all"
                >
                  {twoFactor.secret}
                </p>
                <p className="text-[11px] text-muted-foreground mt-3">
                  This secret is only shown while two-factor is off. Anyone who has it can generate your login codes —
                  keep it out of chats and screenshots.
                </p>
              </div>
            )}

            {/* Alerts */}
            <div className="bg-card border border-white/10 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-red-400" />
                  <h3 className="font-display text-lg text-white">RECENT ALERTS</h3>
                </div>
                <button
                  onClick={() => refetchAlerts()}
                  data-testid="button-refresh-alerts"
                  className="text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-white transition-colors"
                >
                  Refresh
                </button>
              </div>
              {alerts.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing flagged yet. That is what you want to see.</p>
              ) : (
                <div className="space-y-2">
                  {alerts.map((a: any) => (
                    <div
                      key={a.id}
                      data-testid={`alert-${a.id}`}
                      className={`rounded-xl border px-4 py-3 ${
                        a.severity === "critical"
                          ? "bg-red-950/30 border-red-500/30"
                          : a.severity === "warning"
                          ? "bg-amber-950/30 border-amber-500/30"
                          : "bg-white/5 border-white/10"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span
                          className={`text-[10px] font-extrabold uppercase tracking-widest ${
                            a.severity === "critical" ? "text-red-400" : a.severity === "warning" ? "text-amber-400" : "text-accent"
                          }`}
                        >
                          {a.severity} · {a.kind}
                        </span>
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {new Date(a.at).toLocaleString("en-KE", { timeZone: "Africa/Nairobi" })}
                        </span>
                      </div>
                      <p className="text-sm text-white/90 mt-1">{a.message}</p>
                      {a.context && (
                        <p className="text-[10px] text-muted-foreground font-mono mt-1 truncate">
                          {JSON.stringify(a.context)}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Audit log */}
            <div className="bg-card border border-white/10 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <ShieldAlert className="w-5 h-5 text-primary" />
                <h3 className="font-display text-lg text-white">AUDIT TRAIL</h3>
              </div>
              {auditLog.length === 0 ? (
                <p className="text-sm text-muted-foreground">No admin changes recorded yet.</p>
              ) : (
                <div className="space-y-2 max-h-[28rem] overflow-y-auto pr-1">
                  {auditLog.map((entry: any) => (
                    <div
                      key={entry.id}
                      data-testid={`audit-${entry.id}`}
                      className="bg-black/30 border border-white/5 rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2"
                    >
                      <span className="text-[10px] font-bold uppercase tracking-wider text-primary shrink-0 w-40">
                        {entry.action}
                      </span>
                      <span className="text-sm text-white/90 flex-1 min-w-0">{entry.summary}</span>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {new Date(entry.createdAt).toLocaleString("en-KE", { timeZone: "Africa/Nairobi" })}
                        {entry.ip ? ` · ${entry.ip}` : ""}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
