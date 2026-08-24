import { useState, useEffect, useRef } from "react";
import { useLocation, useSearch } from "wouter";
import { useCreateArtist } from "@/hooks/use-artists";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { ShieldAlert, Plus, Mic2, Image as ImageIcon, Lock, LogOut, Check, X, Inbox, Search, Trash2, Upload, Users, AlertTriangle, Download, BarChart2, Shuffle, Pencil, Loader2 } from "lucide-react";
import { CATEGORIES } from "@shared/schema";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

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
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await apiRequest("POST", "/api/admin/login", { password });
      const data = await res.json();
      if (data.success) {
        onLogin();
      }
    } catch {
      setError("Wrong password. Try again.");
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

          {error && (
            <p className="text-red-400 text-center text-sm font-bold" data-testid="text-login-error">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !password}
            data-testid="button-admin-login"
            className={`
              w-full py-4 rounded-xl font-display text-xl tracking-widest transition-all duration-300
              ${loading || !password
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

export default function Admin() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const presetCategory = params.get("category") || "";
  const queryClient = useQueryClient();

  const [isAuthed, setIsAuthed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [activeTab, setActiveTab] = useState<"add" | "requests" | "waitlist" | "approved" | "delete" | "votes">("add");
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

  useEffect(() => {
    fetch("/api/admin/check", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        setIsAuthed(d.isAdmin);
        setChecking(false);
      })
      .catch(() => setChecking(false));
  }, []);

  const { mutate: createArtist, isPending } = useCreateArtist();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: "",
    genre: "",
    imageUrl: "",
    category: presetCategory || CATEGORIES[0].id,
    bio: "",
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
        title: "VOTES ADDED",
        description: `${vars.add} vote${vars.add === 1 ? "" : "s"} added successfully. Live site updated.`,
        className: "bg-primary/90 text-black border-none font-display",
      });
      setAddAmounts((prev) => ({ ...prev, [vars.id]: "" }));
      queryClient.invalidateQueries({ queryKey: ["/api/artists"] });
    },
    onError: (err: any) => {
      toast({ title: "Failed", description: err?.message || "Could not add votes. Try again.", variant: "destructive" });
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
    mutationFn: async ({ id, name, imageUrl }: { id: number; name: string; imageUrl: string }) => {
      await apiRequest("PATCH", `/api/admin/artists/${id}`, { name, imageUrl });
    },
    onSuccess: () => {
      toast({ title: "SAVED", description: "Nominee name and photo updated.", className: "bg-secondary text-secondary-foreground border-none font-display" });
      setEditingArtistId(null);
      setEditingArtistName("");
      setEditingArtistImageUrl("");
      queryClient.invalidateQueries({ queryKey: ["/api/artists"] });
    },
    onError: (err: any) => {
      toast({ title: "Save failed", description: err?.message || "Could not save. Try again.", variant: "destructive" });
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
      const res = await fetch("/api/upload", { method: "POST", body: fd, credentials: "include", signal: controller.signal });
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
        setFormData({ name: "", genre: "", imageUrl: "", category: formData.category, bio: "" });
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
          const catName = CATEGORIES.find(c => c.id === req.category)?.name || req.category;
          toast({
            title: "Cannot approve — category full",
            description: `${catName} already has 9 nominees. Remove one from that category first, then try again.`,
            variant: "destructive",
          });
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
        </div>

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
                    {CATEGORIES.map((cat) => (
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
                      <p className="text-xs text-primary font-bold mt-1">{CATEGORIES.find((c) => c.id === req.category)?.name}</p>
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
                        {CATEGORIES.filter((c) => c.id !== req.category).map((c) => {
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
                    These nominees tried to register in a category that was already full (9/9 nominees). Instead of losing them, we saved their details here and suggested alternative categories with open spots. You can promote them if a spot opens up, or contact them by phone.
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
                      <p className="text-xs text-amber-400 font-bold mt-1">Tried: {CATEGORIES.find((c) => c.id === req.category)?.name}</p>
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
                        {CATEGORIES.filter((c) => c.id !== req.category).map((c) => {
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
                    These nominees are LIVE on the public site. Use the yellow "MOVE TO CATEGORY" dropdown on any card to shift them into a different category at any time — the public site updates instantly. Categories at 9/9 are blocked as destinations.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <select
                value={approvedCategory}
                onChange={(e) => setApprovedCategory(e.target.value)}
                data-testid="select-approved-category-filter"
                className="bg-black/50 border border-white/10 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-secondary transition-all font-bold appearance-none cursor-pointer"
              >
                <option value="" className="bg-black">All Categories</option>
                {CATEGORIES.map((cat) => (
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
                return (
                  <div key={req.id} data-testid={`approved-card-${req.id}`} className="bg-card border border-secondary/20 rounded-2xl p-6 flex flex-col sm:flex-row gap-4">
                    <div className="w-24 h-24 rounded-xl overflow-hidden border border-white/10 shrink-0">
                      <img src={req.imageUrl} alt={req.name} className="w-full h-full object-cover object-top" onError={(e) => { (e.target as HTMLImageElement).src = "/placeholder.svg"; }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-display text-xl text-white">{req.name}</h3>
                      <p className="text-xs text-secondary font-bold mt-1">✓ LIVE in: {CATEGORIES.find((c) => c.id === req.category)?.name}</p>
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
                            href={`https://wa.me/${req.submitterPhone.replace(/[^0-9]/g, '').replace(/^0/, '254')}`}
                            target="_blank"
                            rel="noopener"
                            data-testid={`link-whatsapp-approved-${req.id}`}
                            className="inline-flex items-center gap-2 px-3 py-2 bg-secondary/15 border border-secondary/40 rounded-lg text-secondary text-sm font-bold hover:bg-secondary/25"
                          >
                            WhatsApp
                          </a>
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
                        {CATEGORIES.filter((c) => c.id !== req.category).map((c) => {
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
                  {CATEGORIES.map((cat) => (
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
                            <p className="text-xs text-primary font-bold truncate">{CATEGORIES.find(c => c.id === artist.category)?.name}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{artist.totalVotes} {artist.totalVotes === 1 ? "vote" : "votes"}</p>
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
                                    } else {
                                      setEditingArtistId(artist.id);
                                      setEditingArtistName(artist.name);
                                      setEditingArtistImageUrl(artist.imageUrl);
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
                            </div>
                            <div className="flex gap-2 mt-3">
                              <button
                                onClick={() => updateArtistMutation.mutate({ id: artist.id, name: editingArtistName, imageUrl: editingArtistImageUrl })}
                                disabled={updateArtistMutation.isPending || !editingArtistName.trim() || !editingArtistImageUrl.trim()}
                                data-testid={`button-save-artist-${artist.id}`}
                                className="px-4 py-2 bg-secondary text-black rounded-xl hover:bg-secondary/90 transition-all flex items-center gap-1.5 text-sm font-bold disabled:opacity-40"
                              >
                                <Check className="w-4 h-4" /> {updateArtistMutation.isPending ? "SAVING…" : "SAVE CHANGES"}
                              </button>
                              <button
                                onClick={() => { setEditingArtistId(null); setEditingArtistName(""); setEditingArtistImageUrl(""); }}
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
            <div className="bg-card border border-white/10 rounded-2xl p-6 sm:p-8">
              <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
                <div>
                  <h3 className="font-display text-xl text-white flex items-center gap-2">
                    <BarChart2 className="w-5 h-5 text-primary" />
                    VOTE MANAGER
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Live vote counts — final results.
                  </p>
                </div>
                <div className="flex flex-col items-end gap-3">
                  <div className="text-right">
                    <p className="text-2xl font-display text-primary font-bold" data-testid="text-total-votes">
                      {allArtists.reduce((sum: number, a: any) => sum + (a.totalVotes || 0), 0).toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground">total votes cast</p>
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
                  {CATEGORIES.map((cat) => (
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
                      const catName = CATEGORIES.find((c) => c.id === artist.category)?.name || artist.category;
                      const addVal = addAmounts[artist.id] ?? "";
                      const addNum = parseInt(addVal, 10);
                      const canAdd = Number.isInteger(addNum) && addNum > 0;
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
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-xl font-display text-secondary font-bold" data-testid={`votes-count-${artist.id}`}>
                              {(artist.totalVotes || 0).toLocaleString()}
                            </p>
                            <p className="text-xs text-muted-foreground">votes</p>
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
                  These payments were made but votes were not recorded — money was deducted. Click <strong>RECOVER</strong> to verify with Paystack and record the vote. Click <strong>DISMISS</strong> if the payment was not actually successful.
                </p>
                <div className="space-y-3">
                  {pendingPayments.map((p: any) => {
                    const artist = allArtists.find((a: any) => a.id === p.artistId);
                    const catName = CATEGORIES.find((c) => c.id === artist?.category)?.name || artist?.category || "Unknown";
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
          </motion.div>
        )}
      </div>
    </div>
  );
}
