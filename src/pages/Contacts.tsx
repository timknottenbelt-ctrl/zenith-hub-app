import { useState, useCallback, memo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLanguage } from '@/contexts/LanguageContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { toast } from '@/hooks/use-toast';
import { Plus, Edit, Trash2, Users, Loader2 } from 'lucide-react';

type Contact = Tables<'contacts'>;

const emptyContact = {
  name: '',
  company: '',
  vessel_name: '',
  email: '',
  phone: '',
  function: '',
  role: '',
};

const fetchContacts = async (): Promise<Contact[]> => {
  const { data, error } = await supabase.from('contacts').select('*').order('name');
  if (error) throw error;
  return data || [];
};

const ContactRow = memo(function ContactRow({ 
  contact, 
  onEdit, 
  onDelete, 
  getRoleBadge 
}: { 
  contact: Contact; 
  onEdit: (contact: Contact) => void; 
  onDelete: (id: string) => void;
  getRoleBadge: (role: string | null) => string;
}) {
  return (
    <TableRow>
      <TableCell className="font-medium">{contact.name}</TableCell>
      <TableCell>{contact.company || '-'}</TableCell>
      <TableCell>{contact.email || '-'}</TableCell>
      <TableCell>{contact.phone || '-'}</TableCell>
      <TableCell>
        {contact.role && (
          <Badge className={getRoleBadge(contact.role)} variant="secondary">
            {contact.role}
          </Badge>
        )}
      </TableCell>
      <TableCell>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" onClick={() => onEdit(contact)}>
            <Edit className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => onDelete(contact.id)}>
            <Trash2 className="w-4 h-4 text-destructive" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
});

export default function Contacts() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [showDialog, setShowDialog] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [form, setForm] = useState(emptyContact);

  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ['contacts'],
    queryFn: fetchContacts,
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: typeof emptyContact & { id?: string }) => {
      const data = {
        name: payload.name,
        company: payload.company || null,
        vessel_name: payload.vessel_name || null,
        email: payload.email || null,
        phone: payload.phone || null,
        function: payload.function || null,
        role: payload.role,
      };

      if (payload.id) {
        const { error } = await supabase.from('contacts').update(data).eq('id', payload.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('contacts').insert(data);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      toast({ title: t('common.success'), description: editingContact ? 'Contact updated' : 'Contact created' });
      setShowDialog(false);
    },
    onError: (error: Error) => {
      toast({ title: t('common.error'), description: error.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('contacts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      toast({ title: t('common.success'), description: 'Contact deleted' });
    },
    onError: (error: Error) => {
      toast({ title: t('common.error'), description: error.message, variant: 'destructive' });
    },
  });

  const openEditDialog = useCallback((contact: Contact) => {
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
  }, []);

  const openNewDialog = useCallback(() => {
    setEditingContact(null);
    setForm(emptyContact);
    setShowDialog(true);
  }, []);

  const handleSave = useCallback(() => {
    if (!form.name || !form.role) {
      toast({ title: 'Error', description: 'Name and role are required', variant: 'destructive' });
      return;
    }
    saveMutation.mutate({ ...form, id: editingContact?.id });
  }, [form, editingContact, saveMutation]);

  const handleDelete = useCallback((id: string) => {
    deleteMutation.mutate(id);
  }, [deleteMutation]);

  const getRoleBadge = useCallback((role: string | null) => {
    const variants: Record<string, string> = {
      AGENT: 'bg-info/10 text-info',
      CLIENT: 'bg-success/10 text-success',
      SERVICE_PROVIDER: 'bg-warning/10 text-warning',
    };
    return role ? variants[role] || '' : '';
  }, []);

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
            {isLoading ? (
              <div className="flex items-center justify-center p-12">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : contacts.length === 0 ? (
              <div className="text-center p-12">
                <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">{t('common.noData')}</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Note: Contacts require authentication to access (RLS protected)
                </p>
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
                    <ContactRow
                      key={contact.id}
                      contact={contact}
                      onEdit={openEditDialog}
                      onDelete={handleDelete}
                      getRoleBadge={getRoleBadge}
                    />
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
                <Label>{t('contacts.role')} *</Label>
                <Select
                  value={form.role}
                  onValueChange={(v) => setForm({ ...form, role: v })}
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
                <Button onClick={handleSave} disabled={saveMutation.isPending}>
                  {saveMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {t('contacts.save')}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
