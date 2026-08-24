import { useState, useRef } from "react";
import { useLocation, useSearch, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { Send, Mic2, Music2, Image as ImageIcon, Phone, ShieldCheck, Clock, Upload, Loader2, AlertTriangle, ArrowRight, Users, Vote, Trophy, Copy, Check } from "lucide-react";
import { SiWhatsapp } from "react-icons/si";
import { CATEGORIES, isSongCategory } from "@shared/schema";
import { useVotingStatus } from "@/hooks/use-voting-status";

type CategoryCapacity = {
  id: string;
  name: string;
  group: string;
  approved: number;
  cap: number;
  isFull: boolean;
};

type SuggestedCategory = { id: string; name: string; remaining: number };

export default function NominateArtist() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const { toast } = useToast();
  const { votingPre, votingOpen, votingClosed } = useVotingStatus();
  const [isPending, setIsPending] = useState(false);
  const [submittedStatus, setSubmittedStatus] = useState<null | "pending" | "waitlist">(null);
  const [submittedRequestId, setSubmittedRequestId] = useState<number | null>(null);
  const [submittedName, setSubmittedName] = useState<string>("");
  const [submittedCategory, setSubmittedCategory] = useState<string>("");
  const [submittedImageUrl, setSubmittedImageUrl] = useState<string>("");
  const [copiedShare, setCopiedShare] = useState(false);
  const [suggested, setSuggested] = useState<SuggestedCategory[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: capacity = [] } = useQuery<CategoryCapacity[]>({
    queryKey: ["/api/categories/capacity"],
  });

  const capMap = new Map(capacity.map((c) => [c.id, c]));

  const presetCategory = new URLSearchParams(search).get("category") || "";
  const defaultCategory = CATEGORIES.find(c => c.id === presetCategory)?.id ?? "";

  const [formData, setFormData] = useState({
    name: "",
    imageUrl: "",
    category: defaultCategory,
    submitterPhone: "",
  });

  const hasCategory = formData.category !== "";
  const selectedCap = hasCategory ? capMap.get(formData.category) : undefined;
  const isSong = hasCategory && isSongCategory(formData.category);

  if (votingClosed) {
    return (
      <div className="min-h-screen bg-grid-pattern flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-lg w-full text-center bg-card border border-white/10 rounded-3xl p-10"
        >
          <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center mx-auto mb-5">
            <Trophy className="w-7 h-7 text-primary" />
          </div>
          <h1 className="font-display text-3xl text-white mb-3">Awards Wrapping Up</h1>
          <p className="text-muted-foreground mb-8 leading-relaxed">
            Voting has closed. Winners will be celebrated on awards night.
          </p>
          <Link href="/">
            <span className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-black font-display rounded-xl cursor-pointer hover:bg-primary/90 transition-all" data-testid="link-back-home">
              BACK TO HOME <ArrowRight className="w-4 h-4" />
            </span>
          </Link>
        </motion.div>
      </div>
    );
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === "submitterPhone") {
      const digitsOnly = value.replace(/\D/g, "").slice(0, 15);
      setFormData((prev) => ({ ...prev, submitterPhone: digitsOnly }));
      return;
    }
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please select an image under 2 MB.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    try {
      const tokenRes = await fetch("/api/upload-token", { method: "POST" });
      if (tokenRes.status === 429) throw new Error("Too many requests. Please wait a moment and try again.");
      if (!tokenRes.ok) throw new Error("Could not initiate upload. Please try again.");
      const { token } = await tokenRes.json();

      const fd = new FormData();
      fd.append("image", file);
      const res = await fetch("/api/upload-public", {
        method: "POST",
        headers: { "X-Upload-Token": token },
        body: fd,
      });
      if (res.status === 413) throw new Error("Image is too large. Please choose a file under 2 MB.");
      if (res.status === 429) throw new Error("Too many uploads. Please wait a moment and try again.");
      if (res.status === 503) throw new Error("Upload service is temporarily busy. Please try again shortly.");
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error((errData as any).message || "Upload failed. Please try again.");
      }
      const data = await res.json();
      setFormData((prev) => ({ ...prev, imageUrl: data.imageUrl }));
      toast({
        title: "Photo uploaded",
        description: "Your photo is ready.",
        className: "bg-secondary text-secondary-foreground border-none font-display",
      });
    } catch (err: any) {
      toast({
        title: "Upload failed",
        description: err.message || "Could not upload photo. Try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!hasCategory) {
      toast({
        title: "Choose a category",
        description: "Pick the category you want to be nominated in before submitting.",
        variant: "destructive",
      });
      return;
    }

    if (
      !formData.name.trim() ||
      !formData.imageUrl.trim() ||
      !formData.submitterPhone.trim()
    ) {
      toast({
        title: "Missing Fields",
        description: isSong
          ? "Please fill in the song title, a photo and your phone number."
          : "Please fill in your artist name, photo and phone number.",
        variant: "destructive",
      });
      return;
    }

    const phoneDigits = formData.submitterPhone.replace(/\D/g, "");
    if (phoneDigits.length < 7 || phoneDigits.length > 15) {
      toast({
        title: "Invalid phone number",
        description: "Please enter a valid phone number (7–15 digits, numbers only).",
        variant: "destructive",
      });
      return;
    }

    setIsPending(true);

    try {
      const res = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          imageUrl: formData.imageUrl,
          category: formData.category,
          submitterPhone: formData.submitterPhone,
          submitterName: formData.name,
        }),
      });
      const data = await res.json();
      if (!res.ok && res.status !== 202) {
        throw new Error(data.message || "Failed to submit nomination");
      }
      setSubmittedRequestId(data?.request?.id ?? null);
      setSubmittedName(formData.name);
      setSubmittedCategory(formData.category);
      setSubmittedImageUrl(formData.imageUrl);
      if (data.waitlisted) {
        setSuggested(data.suggested || []);
        setSubmittedStatus("waitlist");
        toast({
          title: "ADDED TO WAITLIST",
          description: data.message,
          className: "bg-amber-500 text-black border-none font-display",
        });
      } else {
        setSubmittedStatus("pending");
        toast({
          title: "NOMINATION SENT!",
          description: "Your nomination has been submitted for review.",
          className: "bg-secondary text-secondary-foreground border-none font-display",
        });
      }

      try {
        if (formData.submitterPhone) {
          localStorage.setItem("hak_my_phone", formData.submitterPhone);
        }
      } catch {}
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to submit nomination",
        variant: "destructive",
      });
    } finally {
      setIsPending(false);
    }
  };

  const switchToCategory = (categoryId: string) => {
    setFormData((prev) => ({ ...prev, category: categoryId }));
    setSubmittedStatus(null);
    setSuggested([]);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (submittedStatus === "waitlist") {
    const triedCategoryName = CATEGORIES.find((c) => c.id === formData.category)?.name || "this category";
    return (
      <div className="min-h-screen bg-grid-pattern flex items-center justify-center px-4 py-24">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center max-w-xl"
        >
          <div className="w-24 h-24 rounded-full bg-amber-500/20 flex items-center justify-center mx-auto mb-6 border border-amber-500/40">
            <Users className="w-12 h-12 text-amber-400" />
          </div>

          <h1 className="font-display text-4xl text-white mb-3">YOU'RE ON THE WAITLIST</h1>
          <p className="text-muted-foreground text-lg mb-6 leading-relaxed">
            <span className="text-amber-300 font-bold">{triedCategoryName}</span> is already full ({selectedCap?.cap || 9} of {selectedCap?.cap || 9} nominees). We've saved your details — the admin will reach out if a spot opens up.
          </p>

          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-5 mb-6 text-left">
            <div className="flex items-start gap-3 mb-3">
              <ShieldCheck className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-200/90 leading-relaxed">
                <span className="font-bold text-amber-300">Don't wait — also enter a category that still has open spots.</span> You can be nominated in more than one category.
              </p>
            </div>
          </div>

          {suggested.length > 0 && (
            <div className="bg-card border border-white/10 rounded-2xl p-5 mb-8 text-left">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4">Suggested categories with open spots</p>
              <div className="space-y-2">
                {suggested.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => switchToCategory(s.id)}
                    data-testid={`button-suggested-${s.id}`}
                    className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-black/40 hover:bg-accent/10 border border-white/10 hover:border-accent/40 rounded-xl transition-all group"
                  >
                    <div className="text-left flex-1 min-w-0">
                      <p className="text-white font-bold truncate">{s.name}</p>
                      <p className="text-xs text-muted-foreground">{s.remaining} {s.remaining === 1 ? "spot" : "spots"} left</p>
                    </div>
                    <ArrowRight className="w-5 h-5 text-accent shrink-0 group-hover:translate-x-1 transition-transform" />
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => { setSubmittedStatus(null); setSuggested([]); }}
              data-testid="button-try-another"
              className="px-6 py-3 bg-accent text-black font-display text-sm rounded-xl"
            >
              TRY ANOTHER CATEGORY
            </button>
            <button
              onClick={() => setLocation("/")}
              data-testid="button-back-home"
              className="px-6 py-3 bg-white/5 text-white font-display text-sm rounded-xl border border-white/10"
            >
              BACK TO HOME
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  if (submittedStatus === "pending") {
    const subCat = CATEGORIES.find((c) => c.id === submittedCategory);
    const subCategoryName = subCat?.name || submittedCategory;
    const subIsSong = isSongCategory(submittedCategory);
    const subSubject = subIsSong ? `the song "${submittedName}"` : submittedName;
    const shareUrl = submittedRequestId && typeof window !== "undefined"
      ? `${window.location.origin}/n/${submittedRequestId}`
      : "";
    const shareMessage = shareUrl
      ? (votingOpen
          ? `🏆 Vote for ${subSubject} in the ${subCategoryName} at Hope Awards Kenya 2026 — voting is OPEN! 1 vote = 10 KES. ${shareUrl}`
          : `🏆 ${subIsSong ? subSubject + " is" : "I'm"} a Hope Awards Kenya 2026 nominee for ${subCategoryName}! Voting opens Mon 1st June 2026 at 6PM EAT. Bookmark and vote when it goes live: ${shareUrl}`)
      : "";
    const whatsappHref = shareMessage ? `https://wa.me/?text=${encodeURIComponent(shareMessage)}` : "#";

    const copyShareLink = async () => {
      if (!shareMessage) return;
      try {
        await navigator.clipboard.writeText(shareMessage);
        setCopiedShare(true);
        setTimeout(() => setCopiedShare(false), 2200);
      } catch {}
    };

    return (
      <div className="min-h-screen bg-grid-pattern flex items-center justify-center px-4 py-16">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center max-w-lg"
        >
          <div className="w-24 h-24 rounded-full bg-accent/20 flex items-center justify-center mx-auto mb-6 border border-accent/40">
            <Trophy className="w-12 h-12 text-accent" />
          </div>

          <p className="text-xs font-bold tracking-[0.3em] text-primary uppercase mb-2">Nomination Received</p>
          <h1 className="font-display text-4xl text-white mb-3 leading-tight">
            CONGRATS,{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-amber-400 to-secondary" data-testid="text-submitted-name">
              {submittedName.toUpperCase()}!
            </span>
          </h1>
          <p className="text-white text-base sm:text-lg leading-relaxed mb-2">
            Your entry for the{" "}
            <span className="text-secondary font-bold" data-testid="text-submitted-category">{subCategoryName}</span>{" "}
            has been submitted and is <span className="text-accent font-bold">awaiting admin review</span>.
          </p>
          <p className="text-muted-foreground text-sm mb-6">
            You'll be listed on the platform once the admin approves your entry. Start rallying your fans now — share your nominee link below.
          </p>

          {submittedRequestId && (
            <div className="bg-gradient-to-br from-secondary/15 via-primary/10 to-secondary/15 border-2 border-secondary/40 rounded-2xl p-5 mb-6">
              <p className="font-display text-secondary text-sm tracking-[0.25em] mb-1">SHARE & RALLY YOUR VOTERS</p>
              <p className="text-white/80 text-sm mb-4">
                The link previews your photo and {subCategoryName} on WhatsApp, Facebook & X.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <a
                  href={whatsappHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid="link-pending-share-whatsapp"
                  className="flex items-center justify-center gap-2 py-3.5 px-4 bg-[#25D366] text-white font-display text-base rounded-xl shadow-lg shadow-[#25D366]/30 hover:scale-[1.04] active:scale-95 transition-all"
                >
                  <SiWhatsapp className="w-5 h-5" /> WHATSAPP
                </a>
                <button
                  onClick={copyShareLink}
                  data-testid="button-pending-share-copy"
                  className={`flex items-center justify-center gap-2 py-3.5 px-4 font-display text-base rounded-xl transition-all hover:scale-[1.04] active:scale-95 ${
                    copiedShare ? "bg-emerald-500 text-white" : "bg-white text-black"
                  }`}
                >
                  {copiedShare ? (<><Check className="w-5 h-5" /> COPIED!</>) : (<><Copy className="w-5 h-5" /> COPY LINK</>)}
                </button>
              </div>
            </div>
          )}

          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-5 mb-8 text-left space-y-2">
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck className="w-5 h-5 text-amber-400 shrink-0" />
              <span className="text-amber-300 font-display text-sm tracking-widest uppercase">What happens next</span>
            </div>
            <div className="flex items-start gap-3 text-sm text-muted-foreground">
              <span className="text-amber-400 font-bold shrink-0">1.</span>
              <span>The Hope Awards Kenya admin reviews your nomination</span>
            </div>
            <div className="flex items-start gap-3 text-sm text-muted-foreground">
              <span className="text-amber-400 font-bold shrink-0">2.</span>
              <span>If approved, you'll be listed on the platform in your category</span>
            </div>
            <div className="flex items-start gap-3 text-sm text-muted-foreground">
              <span className="text-amber-400 font-bold shrink-0">3.</span>
              <span>Fans can then vote for you starting <span className="text-primary font-bold">1st June 2026</span></span>
            </div>
            <div className="flex items-start gap-3 text-sm text-muted-foreground">
              <span className="text-amber-400 font-bold shrink-0">4.</span>
              <span>Share your link above so your fans are ready to vote on day one</span>
            </div>
          </div>

          <button
            onClick={() => setLocation("/")}
            data-testid="button-back-home"
            className="px-8 py-4 bg-primary text-black font-display text-xl rounded-xl neon-box-gold"
          >
            BACK TO HOME
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-grid-pattern py-24">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 bg-accent/20 rounded-xl flex items-center justify-center border border-accent/50">
            <Send className="w-7 h-7 text-accent" />
          </div>
          <div>
            <h1 className="font-display text-4xl text-white">
              {votingOpen
                ? "SUBMIT A REQUEST"
                : isSong ? "NOMINATE YOUR SONG" : "NOMINATE YOURSELF"}
            </h1>
            <p className="text-muted-foreground font-semibold">
              {votingOpen
                ? "Voting is live — fill in your details and the admin will review your entry"
                : isSong
                  ? "Submit your song title and cover art to enter this category"
                  : "Artist, DJ or MC? Submit your details and get into the competition"}
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl px-5 py-4 mb-8">
          <ShieldCheck className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-200/80 leading-relaxed">
            {votingOpen
              ? <><span className="text-amber-300 font-bold">Late request — admin review required.</span> Voting is already live. Submit your details and the admin will review your entry. If approved, you'll be added to your category and fans can vote for you immediately.</>
              : <><span className="text-amber-300 font-bold">Admin approval required.</span> Your nomination will be reviewed before you appear on the platform. Only approved nominees are visible to voters. The admin will onboard you once your details have been verified.</>
            }
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card border border-white/10 rounded-2xl p-8 md:p-10 shadow-2xl"
        >
          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                  Category
                </label>
                <select
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
                  required
                  data-testid="select-request-category"
                  className={`w-full bg-black/50 border border-white/10 rounded-xl py-4 px-5 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all font-bold text-lg appearance-none cursor-pointer ${hasCategory ? "text-white" : "text-white/40"}`}
                >
                  <option value="" disabled className="bg-black text-white/60">
                    — Choose category —
                  </option>
                  {CATEGORIES.map((cat) => {
                    const c = capMap.get(cat.id);
                    const tag = c ? (c.isFull ? "  ▸ FULL — joins waitlist" : `  ▸ ${c.cap - c.approved} spot${c.cap - c.approved === 1 ? "" : "s"} left`) : "";
                    return (
                      <option key={cat.id} value={cat.id} className="bg-black text-white">
                        {cat.name}{tag}
                      </option>
                    );
                  })}
                </select>
                {!hasCategory && (
                  <p className="text-xs text-muted-foreground/70 mt-2 px-1">
                    Pick the category you want to compete in. Song-based categories will ask for the song title; person-based categories will ask for your name.
                  </p>
                )}
                {selectedCap && (
                  selectedCap.isFull ? (
                    <div className="flex items-start gap-2 mt-2 px-3 py-2 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-200/90 leading-relaxed">
                        This category is <strong>full ({selectedCap.cap}/{selectedCap.cap})</strong>. Submitting still works — you'll be saved on the <strong>waitlist</strong> and we'll suggest similar categories with open spots.
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-2 px-1">
                      <span className="text-secondary font-bold">{selectedCap.approved}/{selectedCap.cap}</span> nominees registered — {selectedCap.cap - selectedCap.approved} {selectedCap.cap - selectedCap.approved === 1 ? "spot" : "spots"} left
                    </p>
                  )
                )}
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                  {isSong ? (
                    <><Music2 className="w-4 h-4 text-primary" /> Song Title</>
                  ) : (
                    <><Mic2 className="w-4 h-4 text-primary" /> Artist / DJ / MC Name</>
                  )}
                </label>
                <input
                  required
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  data-testid="input-request-name"
                  placeholder={
                    isSong
                      ? "e.g. NATAKA TUMBO LA HEKIMA — by Mary Wambui"
                      : "e.g. KHALIGRAPH JONES, DJ AFRO, WELL DONE"
                  }
                  className="w-full bg-black/50 border border-white/10 rounded-xl py-4 px-5 text-white placeholder:text-white/20 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all font-display text-xl"
                />
                {isSong && (
                  <p className="text-xs text-muted-foreground/70 px-1 leading-relaxed">
                    This category judges the song, not the artist. Enter the <strong className="text-white/80">song title</strong> (you can add the artist after a dash, e.g. "Title — by Artist").
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-accent" /> {isSong ? "Song Cover Art" : "Your Photo"}
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  data-testid="input-request-image-file"
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  data-testid="button-pick-photo"
                  className="w-full bg-black/50 border border-dashed border-white/20 hover:border-accent/60 rounded-xl py-6 px-5 text-white/70 hover:text-white transition-all flex flex-col items-center justify-center gap-2 cursor-pointer"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-6 h-6 text-accent animate-spin" />
                      <span className="font-bold">Uploading…</span>
                    </>
                  ) : formData.imageUrl ? (
                    <>
                      <Upload className="w-6 h-6 text-accent" />
                      <span className="font-bold">{isSong ? "Change cover art" : "Change photo"}</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-6 h-6 text-accent" />
                      <span className="font-bold">{isSong ? "Choose song cover art" : "Choose photo from your phone"}</span>
                      <span className="text-xs text-muted-foreground/70">JPG, PNG or WEBP — up to 10 MB</span>
                    </>
                  )}
                </button>
              </div>

              {formData.imageUrl && (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                    Preview
                  </label>
                  <div className="rounded-xl overflow-hidden border border-white/10 h-48">
                    <img
                      src={formData.imageUrl}
                      alt="Preview"
                      className="w-full h-full object-cover object-top"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-white/5">
                <p className="text-xs text-muted-foreground/60 mb-4 uppercase tracking-widest font-bold">Contact Details</p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                  <Phone className="w-4 h-4 text-secondary" /> Phone Number
                </label>
                <input
                  required
                  type="tel"
                  inputMode="numeric"
                  pattern="[0-9]{7,15}"
                  minLength={7}
                  maxLength={15}
                  name="submitterPhone"
                  value={formData.submitterPhone}
                  onChange={handleChange}
                  data-testid="input-request-submitter-phone"
                  placeholder="e.g. 0712345678"
                  title="Enter a valid phone number — digits only (7 to 15)"
                  className="w-full bg-black/50 border border-white/10 rounded-xl py-4 px-5 text-white placeholder:text-white/20 focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-all"
                />
                <p className="text-xs text-muted-foreground/70 px-1">
                  Numbers only — no spaces, dashes or letters. We'll use this to contact you about your nomination.
                </p>
              </div>
            </div>

            <button
              type="submit"
              disabled={isPending}
              data-testid="button-submit-request"
              className={`
                w-full py-5 rounded-xl font-display text-xl tracking-widest flex items-center justify-center gap-3 transition-all duration-300
                ${
                  isPending
                    ? "bg-white/5 text-white/30 cursor-not-allowed"
                    : "bg-accent text-black hover:bg-accent/90 active:scale-95"
                }
              `}
            >
              {isPending ? (
                "SUBMITTING..."
              ) : (
                <>
                  <Send className="w-6 h-6" /> SUBMIT NOMINATION
                </>
              )}
            </button>

            <p className="text-center text-xs text-muted-foreground/50">
              Your nomination will be reviewed and approved by the admin. Once approved, fans can vote for you starting <strong className="text-primary">1st June 2026</strong>.
            </p>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
