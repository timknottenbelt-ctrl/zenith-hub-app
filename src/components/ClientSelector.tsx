import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { BookOpen, User, Building2, Mail, Phone, MapPin } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

interface SavedClient {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  function: string | null; // Used for address
}

interface ClientSelectorProps {
  onSelectClient: (client: {
    client_name: string;
    client_email: string;
    client_phone: string;
    billing_company: string;
    billing_email: string;
    billing_address: string;
    billing_phone: string;
  }) => void;
}

export function ClientSelector({ onSelectClient }: ClientSelectorProps) {
  const [open, setOpen] = useState(false);
  const [clients, setClients] = useState<SavedClient[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (open) {
      fetchClients();
    }
  }, [open]);

  async function fetchClients() {
    setLoading(true);
    const { data, error } = await supabase
      .from("contacts")
      .select("id, name, company, email, phone, function")
      .eq("role", "CLIENT")
      .order("name", { ascending: true });

    if (!error && data) {
      setClients(data);
    }
    setLoading(false);
  }

  const filteredClients = clients.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.company?.toLowerCase().includes(search.toLowerCase()) ||
      c.email?.toLowerCase().includes(search.toLowerCase())
  );

  function handleSelect(client: SavedClient) {
    onSelectClient({
      client_name: client.name,
      client_email: client.email || "",
      client_phone: client.phone || "",
      billing_company: client.company || "",
      billing_email: client.email || "",
      billing_address: client.function || "", // function field stores address
      billing_phone: client.phone || "",
    });
    setOpen(false);
    setSearch("");
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          title="Selecteer opgeslagen klant"
        >
          <BookOpen className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="w-5 h-5" />
            Opgeslagen Klanten
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Input
            placeholder="Zoek op naam, bedrijf of email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <ScrollArea className="h-[300px] pr-4">
            {loading ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                Laden...
              </div>
            ) : filteredClients.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <BookOpen className="w-8 h-8 mb-2 opacity-50" />
                <p className="text-sm">Geen opgeslagen klanten gevonden</p>
                <p className="text-xs mt-1">
                  Klanten worden automatisch opgeslagen bij het aanmaken van een FDA project
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredClients.map((client) => (
                  <button
                    key={client.id}
                    onClick={() => handleSelect(client)}
                    className="w-full text-left p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <User className="w-4 h-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0 space-y-1">
                        <p className="font-medium truncate">{client.name}</p>
                        {client.company && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Building2 className="w-3 h-3" />
                            <span className="truncate">{client.company}</span>
                          </div>
                        )}
                        {client.email && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Mail className="w-3 h-3" />
                            <span className="truncate">{client.email}</span>
                          </div>
                        )}
                        {client.phone && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Phone className="w-3 h-3" />
                            <span>{client.phone}</span>
                          </div>
                        )}
                        {client.function && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <MapPin className="w-3 h-3" />
                            <span className="truncate">{client.function}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
