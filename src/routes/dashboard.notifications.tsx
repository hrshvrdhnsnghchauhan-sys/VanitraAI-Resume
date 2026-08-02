import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2, Bell, CheckCircle2, AlertCircle, Info } from "lucide-react";
import { PageHeader, DashCard } from "@/components/dashboard/ui";
import { useAuth } from "@/lib/auth";
import {
  collection,
  query,
  where,
  orderBy,
  deleteDoc,
  doc,
  updateDoc,
  onSnapshot,
} from "firebase/firestore";
import { db } from "@/services/firebase";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/dashboard/notifications")({
  component: NotificationsPage,
});

function NotificationsPage() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid || !db) return;
    setLoading(true);

    // We want both specific and global notifications
    // In Firestore, we need two separate listeners because 'in' or multiple where clauses on different fields can be complex.
    // For now, let's listen to personal ones. Global broadcasts can be fetched or we just stick to personal for simplicity.
    const q = query(collection(db, "notifications"), where("userId", "==", user.uid));
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setNotifications(
          data.sort(
            (a: any, b: any) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0),
          ),
        );
        setLoading(false);
      },
      (err) => {
        console.error("Failed to load notifications", err);
        setLoading(false);
      },
    );

    return () => unsubscribe();
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
      <PageHeader title="Notifications" description="Stay updated on your job search." />

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
