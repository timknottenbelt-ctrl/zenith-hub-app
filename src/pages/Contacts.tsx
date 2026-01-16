import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase, Contact } from '@/lib/supabase';
import { toast } from '@/hooks/use-toast';
import { Plus, Edit, Trash2, Users, Loader2 } from 'lucide-react';

type ContactRole = 'AGENT' | 'CLIENT' | 'SERVICE_PROVIDER';

const emptyContact = {
  name: '',
  company: '',
  vessel_name: '',
  email: '',
  phone: '',
  function: '',
  role: '' as ContactRole | '',
};

export default function Contacts() {
  const { t } = useLanguage();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [form, setForm] = useState(emptyContact);

  useEffect(() => {
    fetchContacts();
  }, []);

  async function fetchContacts() {
    setLoading(true);
    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .order('name');

    if (error) {
      toast({ title: t('common.error'), description: error.message, variant: 'destructive' });
    } else {
      setContacts(data || []);
    }
    setLoading(false);
  }

  function openEditDialog(contact: Contact) {
    setEditingContact(contact);
    setForm({
      name: contact.name,
      company: contact.company || '',
      vessel_name: contact.vessel_name || '',
      email: contact.email || '',
      phone: contact.phone || '',
      function: contact.function || '',
      role: contact.role || '',
    });
    setShowDialog(true);
  }

  function openNewDialog() {
    setEditingContact(null);
    setForm(emptyContact);
    setShowDialog(true);
  }

  async function handleSave() {
    if (!form.name) {
      toast({ title: 'Error', description: 'Name is required', variant: 'destructive' });
      return;
    }

    const payload = {
      name: form.name,
      company: form.company || null,
      vessel_name: form.vessel_name || null,
      email: form.email || null,
      phone: form.phone || null,
      function: form.function || null,
      role: form.role || null,
    };

    if (editingContact) {
      const { error } = await supabase
        .from('contacts')
        .update(payload)
        .eq('id', editingContact.id);

      if (error) {
        toast({ title: t('common.error'), description: error.message, variant: 'destructive' });
        return;
      }
      toast({ title: t('common.success'), description: 'Contact updated' });
    } else {
      const { error } = await supabase.from('contacts').insert(payload);

      if (error) {
        toast({ title: t('common.error'), description: error.message, variant: 'destructive' });
        return;
      }
      toast({ title: t('common.success'), description: 'Contact created' });
    }

    setShowDialog(false);
    fetchContacts();
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from('contacts').delete().eq('id', id);
    if (error) {
      toast({ title: t('common.error'), description: error.message, variant: 'destructive' });
    } else {
      toast({ title: t('common.success'), description: 'Contact deleted' });
      fetchContacts();
    }
  }

  const getRoleBadge = (role: string | null) => {
    const variants: Record<string, string> = {
      AGENT: 'bg-info/10 text-info',
      CLIENT: 'bg-success/10 text-success',
      SERVICE_PROVIDER: 'bg-warning/10 text-warning',
    };
    return role ? variants[role] || '' : '';
  };

  return (
    <DashboardLayout title={t('contacts.title')}>
      <div className="space-y-6">
        <div className="flex justify-end">
          <Button onClick={openNewDialog} className="gap-2">
            <Plus className="w-4 h-4" />
            {t('contacts.newContact')}
          </Button>
        </div>

        <Card className="card-premium">
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center p-12">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : contacts.length === 0 ? (
              <div className="text-center p-12">
                <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">{t('common.noData')}</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('contacts.name')}</TableHead>
                    <TableHead>{t('contacts.company')}</TableHead>
                    <TableHead>{t('contacts.email')}</TableHead>
                    <TableHead>{t('contacts.phone')}</TableHead>
                    <TableHead>{t('contacts.role')}</TableHead>
                    <TableHead className="w-24">{t('common.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contacts.map((contact) => (
                    <TableRow key={contact.id}>
                      <TableCell className="font-medium">{contact.name}</TableCell>
                      <TableCell>{contact.company || '-'}</TableCell>
                      <TableCell>{contact.email || '-'}</TableCell>
                      <TableCell>{contact.phone || '-'}</TableCell>
                      <TableCell>
                        {contact.role && (
                          <Badge className={getRoleBadge(contact.role)} variant="secondary">
                            {t(`contacts.${contact.role.toLowerCase()}`)}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEditDialog(contact)}>
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(contact.id)}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Create/Edit Dialog */}
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingContact ? t('contacts.editContact') : t('contacts.newContact')}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('contacts.name')} *</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('contacts.company')}</Label>
                  <Input
                    value={form.company}
                    onChange={(e) => setForm({ ...form, company: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('contacts.email')}</Label>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('contacts.phone')}</Label>
                  <Input
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('contacts.vesselName')}</Label>
                  <Input
                    value={form.vessel_name}
                    onChange={(e) => setForm({ ...form, vessel_name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('contacts.function')}</Label>
                  <Input
                    value={form.function}
                    onChange={(e) => setForm({ ...form, function: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t('contacts.role')}</Label>
                <Select
                  value={form.role}
                  onValueChange={(v) => setForm({ ...form, role: v as ContactRole })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AGENT">{t('contacts.agent')}</SelectItem>
                    <SelectItem value="CLIENT">{t('contacts.client')}</SelectItem>
                    <SelectItem value="SERVICE_PROVIDER">{t('contacts.serviceProvider')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setShowDialog(false)}>
                  {t('contacts.cancel')}
                </Button>
                <Button onClick={handleSave}>{t('contacts.save')}</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
