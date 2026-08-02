import { useEffect, useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Search, Loader2, Trash2, Building2, CheckCircle2, XCircle } from "lucide-react";
import { PageHeader, DashCard } from "@/components/dashboard/ui";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { collection, getDocs, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { db } from "@/services/firebase";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/admin/companies")({
  component: AdminCompaniesPage,
});

function AdminCompaniesPage() {
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [queryInput, setQueryInput] = useState("");

  const fetchCompanies = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, "companies"));
      setCompanies(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error("Failed to load companies", err);
      toast.error("Failed to load companies");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCompanies();
  }, []);

  const filtered = useMemo(
    () =>
      companies.filter(
        (c) =>
          (c.name || "").toLowerCase().includes(queryInput.toLowerCase()) ||
          (c.website || "").toLowerCase().includes(queryInput.toLowerCase()),
      ),
    [queryInput, companies],
  );

  const setStatus = async (id: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, "companies", id), { status: newStatus });
      setCompanies(companies.map((c) => (c.id === id ? { ...c, status: newStatus } : c)));
      toast.success(`Company marked as ${newStatus}`);
    } catch (e) {
      toast.error("Failed to update status");
    }
  };

  const deleteCompany = async (id: string) => {
    if (!confirm("Are you sure you want to permanently delete this company document?")) return;
    try {
      await deleteDoc(doc(db, "companies", id));
      setCompanies(companies.filter((c) => c.id !== id));
      toast.success("Company deleted");
    } catch (e) {
      toast.error("Failed to delete company");
    }
  };

  return (
    <>
      <PageHeader title="Company Management" description="Review and approve employer profiles." />

      <DashCard>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row items-center justify-between">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={queryInput}
              onChange={(e) => setQueryInput(e.target.value)}
              placeholder="Search by company name…"
              className="pl-9"
            />
          </div>
          <Badge variant="secondary" className="px-3 py-1 text-sm font-medium">
            {filtered.length} total companies
          </Badge>
        </div>

        {loading ? (
          <div className="flex h-32 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead>Industry</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <div className="font-medium">{c.name || "Unknown Company"}</div>
                    <div className="text-sm text-muted-foreground">
                      {c.website ? (
                        <a
                          href={c.website.startsWith("http") ? c.website : `https://${c.website}`}
                          target="_blank"
                          rel="noreferrer"
                          className="hover:underline"
                        >
                          {c.website}
                        </a>
                      ) : (
                        "No website provided"
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{c.industry || "General"}</Badge>
                  </TableCell>
                  <TableCell>
                    {c.status === "approved" ? (
                      <Badge className="bg-success text-success-foreground hover:bg-success/80">
                        Approved
                      </Badge>
                    ) : c.status === "rejected" ? (
                      <Badge variant="destructive">Rejected</Badge>
                    ) : (
                      <Badge variant="secondary">Pending Review</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setStatus(c.id, "approved")}>
                          <CheckCircle2 className="h-4 w-4 mr-2 text-success" />
                          Approve
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setStatus(c.id, "rejected")}>
                          <XCircle className="h-4 w-4 mr-2 text-warning" />
                          Reject
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => deleteCompany(c.id)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete Record
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                    No companies match your search.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </DashCard>
    </>
  );
}
