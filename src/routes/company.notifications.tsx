import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2, Bell, CheckCircle2, AlertCircle, Info } from "lucide-react";
import { PageHeader, DashCard } from "@/components/dashboard/ui";
import { useAuth } from "@/lib/auth";
import { collection, query, where, getDocs, updateDoc, doc } from "firebase/firestore";
import { db } from "@/services/firebase";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/company/notifications")({
  component: NotificationsPage,
});

function NotificationsPage() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = async () => {
    if (!user?.uid || !db) return;
    try {
      const q = query(collection(db, "notifications"), where("userId", "==", user.uid));
      const snap = await getDocs(q);
      const notifs = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as any[];
      notifs.sort((a, b) => {
        const tA = a.createdAt?.toMillis ? a.createdAt.toMillis() : Date.now();
        const tB = b.createdAt?.toMillis ? b.createdAt.toMillis() : Date.now();
        return tB - tA;
      });
      setNotifications(notifs);
    } catch (err) {
      console.error("Failed to load notifications", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refetch when the signed-in user changes
  }, [user]);

  const markAsRead = async (id: string) => {
    try {
      await updateDoc(doc(db, "notifications", id), { read: true });
      setNotifications((n) => n.map((x) => (x.id === id ? { ...x, read: true } : x)));
    } catch (error) {
      console.error("Failed to mark read", error);
    }
  };

  return (
    <>
      <PageHeader title="Notifications" description="Stay updated on your hiring pipeline." />

      <div className="space-y-4 max-w-4xl">
        {loading ? (
          <DashCard className="p-12 flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </DashCard>
        ) : notifications.length === 0 ? (
          <DashCard className="p-12 text-center text-muted-foreground">
            <Bell className="h-8 w-8 mx-auto mb-3 opacity-20" />
            <p>You're all caught up!</p>
          </DashCard>
        ) : (
          notifications.map((n) => (
            <DashCard
              key={n.id}
              className={`p-4 flex gap-4 ${n.read ? "opacity-60" : "border-l-4 border-l-primary"}`}
            >
              <div className="mt-1">
                {n.type === "success" ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                ) : n.type === "alert" ? (
                  <AlertCircle className="h-5 w-5 text-red-500" />
                ) : (
                  <Info className="h-5 w-5 text-blue-500" />
                )}
              </div>
              <div className="flex-1">
                <h4 className="font-semibold">{n.title}</h4>
                <p className="text-sm text-muted-foreground mt-1">{n.message}</p>
                <div className="text-xs text-muted-foreground mt-2">
                  {n.createdAt?.toDate ? n.createdAt.toDate().toLocaleString() : "Just now"}
                </div>
              </div>
              {!n.read && (
                <Button variant="ghost" size="sm" onClick={() => markAsRead(n.id)}>
                  Mark read
                </Button>
              )}
            </DashCard>
          ))
        )}
      </div>
    </>
  );
}
