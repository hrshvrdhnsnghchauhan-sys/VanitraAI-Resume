import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Send, Bell, Loader2, Megaphone, Trash2 } from "lucide-react";
import { PageHeader, DashCard } from "@/components/dashboard/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  where,
  orderBy,
  deleteDoc,
  doc,
  onSnapshot,
} from "firebase/firestore";
import { db } from "@/services/firebase";

export const Route = createFileRoute("/admin/notifications")({
  component: AdminNotificationsPage,
});

function AdminNotificationsPage() {
  const [broadcastTitle, setBroadcastTitle] = useState("");
  const [broadcastMessage, setBroadcastMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [systemAlerts, setSystemAlerts] = useState<any[]>([]);
  const [loadingAlerts, setLoadingAlerts] = useState(true);

  useEffect(() => {
    setLoadingAlerts(true);
    const q = query(
      collection(db, "notifications"),
      where("userId", "==", "admin"),
      orderBy("createdAt", "desc"),
    );
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        setSystemAlerts(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoadingAlerts(false);
      },
      (err) => {
        console.error(err);
        setLoadingAlerts(false);
      },
    );

    return () => unsubscribe();
  }, []);

  const handleBroadcast = async () => {
    if (!broadcastTitle || !broadcastMessage) {
      toast.error("Please fill in both title and message");
      return;
    }
    setIsSending(true);
    try {
      // Create a global notification record
      await addDoc(collection(db, "notifications"), {
        userId: "global",
        title: broadcastTitle,
        message: broadcastMessage,
        type: "system",
        read: false,
        createdAt: serverTimestamp(),
      });
      toast.success("Broadcast sent to all users!");
      setBroadcastTitle("");
      setBroadcastMessage("");
    } catch (e) {
      toast.error("Failed to send broadcast");
    } finally {
      setIsSending(false);
    }
  };

  const deleteAlert = async (id: string) => {
    try {
      await deleteDoc(doc(db, "notifications", id));
      setSystemAlerts(systemAlerts.filter((a) => a.id !== id));
      toast.success("Alert deleted");
    } catch (e) {
      toast.error("Failed to delete alert");
    }
  };

  return (
    <>
      <PageHeader
        title="Notifications & Alerts"
        description="Send global broadcasts and manage system alerts."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <DashCard title="Broadcast Message">
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Send a global notification to all candidates and companies on the platform.
            </p>
            <div className="space-y-2">
              <label className="text-sm font-medium">Title</label>
              <Input
                placeholder="e.g. Scheduled Maintenance"
                value={broadcastTitle}
                onChange={(e) => setBroadcastTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Message</label>
              <Textarea
                placeholder="Type your message here..."
                className="h-32"
                value={broadcastMessage}
                onChange={(e) => setBroadcastMessage(e.target.value)}
              />
            </div>
            <Button onClick={handleBroadcast} disabled={isSending} className="w-full">
              {isSending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Megaphone className="w-4 h-4 mr-2" />
              )}
              Send Broadcast
            </Button>
          </div>
        </DashCard>

        <DashCard title="System Alerts">
          {loadingAlerts ? (
            <div className="flex h-32 items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : systemAlerts.length > 0 ? (
            <ul className="space-y-3">
              {systemAlerts.map((alert) => (
                <li
                  key={alert.id}
                  className="flex gap-4 p-3 rounded-xl border border-border items-start"
                >
                  <div className="mt-1 bg-destructive/10 text-destructive p-2 rounded-full">
                    <Bell className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-sm">{alert.title}</div>
                    <div className="text-sm text-muted-foreground">{alert.message}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {alert.createdAt?.toDate
                        ? alert.createdAt.toDate().toLocaleString()
                        : "Just now"}
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => deleteAlert(alert.id)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex h-40 flex-col items-center justify-center text-muted-foreground text-sm gap-2">
              <CheckCircle2 className="w-8 h-8 text-success opacity-50" />
              All clear! No system alerts.
            </div>
          )}
        </DashCard>
      </div>
    </>
  );
}

// Provide CheckCircle2 missing from lucide-react imports above
import { CheckCircle2 } from "lucide-react";
