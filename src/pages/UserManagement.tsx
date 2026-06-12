import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { Users, UserPlus, Shield, ShieldCheck, Loader2, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';

interface UserWithRole {
  id: string;
  email: string;
  name: string | null;
  role: 'admin' | 'user' | 'pending';
  created_at: string;
  approved_at: string | null;
}

export default function UserManagement() {
  const { isAdmin, user } = useAuth();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserRole, setNewUserRole] = useState<'user' | 'admin'>('user');
  const [creating, setCreating] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    if (isAdmin) fetchUsers();
  }, [isAdmin]);

  async function fetchUsers() {
    setLoading(true);
    const { data: rolesData, error: rolesError } = await supabase
      .from('user_roles')
      .select('*')
      .order('created_at', { ascending: false });

    if (rolesError) {
      toast({ title: 'Fout', description: 'Kon gebruikers niet laden', variant: 'destructive' });
      setLoading(false);
      return;
    }

    const userIds = rolesData.map(r => r.user_id);
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('id, name, email')
      .in('id', userIds);

    const combined: UserWithRole[] = rolesData.map(role => {
      const profile = profilesData?.find(p => p.id === role.user_id);
      return {
        id: role.user_id,
        email: profile?.email || 'Onbekend',
        name: profile?.name || null,
        role: role.role as 'admin' | 'user' | 'pending',
        created_at: role.created_at || '',
        approved_at: role.approved_at,
      };
    });

    // Geen pending gebruikers tonen
    setUsers(combined.filter(u => u.role !== 'pending'));
    setLoading(false);
  }

  async function handleDeleteUser(userId: string) {
    setActionLoading(userId);
    try {
      const { error: fnError } = await supabase.functions.invoke('admin-create-user', {
        body: { action: 'delete', userId },
      });
      if (fnError) throw new Error(fnError.message);
      toast({ title: 'Succes', description: 'Gebruiker verwijderd' });
      fetchUsers();
    } catch (error) {
      toast({ title: 'Fout', description: (error as Error).message, variant: 'destructive' });
    }
    setActionLoading(null);
  }

  async function handleChangeRole(userId: string, newRole: 'admin' | 'user') {
    setActionLoading(userId);
    const { error } = await supabase
      .from('user_roles')
      .update({ role: newRole })
      .eq('user_id', userId);
    if (error) {
      toast({ title: 'Fout', description: 'Kon rol niet wijzigen', variant: 'destructive' });
    } else {
      toast({ title: 'Succes', description: `Rol gewijzigd naar ${newRole}` });
      fetchUsers();
    }
    setActionLoading(null);
  }

  async function handleCreateUser() {
    if (!newUserEmail || !newUserName) {
      toast({ title: 'Fout', description: 'Vul naam en e-mail in', variant: 'destructive' });
      return;
    }
    setCreating(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session?.access_token) throw new Error('Sessie verlopen');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user-with-email`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionData.session.access_token}`,
          },
          body: JSON.stringify({ email: newUserEmail, name: newUserName, role: newUserRole }),
        }
      );

      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'Fout bij aanmaken');

      toast({
        title: 'Gebruiker aangemaakt',
        description: `${newUserName} heeft een uitnodigingsmail ontvangen.`,
      });
      setAddDialogOpen(false);
      setNewUserEmail('');
      setNewUserName('');
      setNewUserRole('user');
      fetchUsers();
    } catch (error) {
      toast({ title: 'Fout', description: (error as Error).message, variant: 'destructive' });
    }
    setCreating(false);
  }

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin':
        return <Badge className="bg-primary/10 text-primary border-primary/20"><ShieldCheck className="w-3 h-3 mr-1" /> Admin</Badge>;
      case 'user':
        return <Badge variant="secondary"><Shield className="w-3 h-3 mr-1" /> Gebruiker</Badge>;
      default:
        return <Badge variant="outline">{role}</Badge>;
    }
  };

  if (!isAdmin) {
    return (
      <DashboardLayout title="Gebruikersbeheer">
        <div className="flex items-center justify-center h-[60vh]">
          <Card className="max-w-md">
            <CardContent className="pt-6 text-center">
              <Shield className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h2 className="text-lg font-semibold mb-2">Geen Toegang</h2>
              <p className="text-muted-foreground">Je hebt geen admin rechten om deze pagina te bekijken.</p>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Gebruikersbeheer">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Gebruikersbeheer</h1>
            <p className="text-muted-foreground">Beheer gebruikers en hun toegangsrechten</p>
          </div>
          <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <UserPlus className="w-4 h-4" />
                Nieuwe Gebruiker
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nieuwe Gebruiker Aanmaken</DialogTitle>
                <DialogDescription>
                  De gebruiker ontvangt automatisch een uitnodigingslink per email om in te loggen en een wachtwoord in te stellen.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Naam *</Label>
                  <Input value={newUserName} onChange={(e) => setNewUserName(e.target.value)} placeholder="Jan Jansen" />
                </div>
                <div className="space-y-2">
                  <Label>E-mail *</Label>
                  <Input type="email" value={newUserEmail} onChange={(e) => setNewUserEmail(e.target.value)} placeholder="jan@lbh.nl" />
                </div>
                <div className="space-y-2">
                  <Label>Rol</Label>
                  <Select value={newUserRole} onValueChange={(v) => setNewUserRole(v as 'user' | 'admin')}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">Gebruiker</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAddDialogOpen(false)}>Annuleren</Button>
                <Button onClick={handleCreateUser} disabled={creating}>
                  {creating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <UserPlus className="w-4 h-4 mr-2" />}
                  Aanmaken & uitnodigen
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Card className="card-premium">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Alle Gebruikers ({users.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Naam</TableHead>
                    <TableHead>E-mail</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead>Toegevoegd op</TableHead>
                    <TableHead className="text-right">Acties</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.name || '-'}</TableCell>
                      <TableCell>{u.email}</TableCell>
                      <TableCell>{getRoleBadge(u.role)}</TableCell>
                      <TableCell>
                        {u.approved_at ? format(new Date(u.approved_at), 'dd MMM yyyy', { locale: nl }) : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {u.id !== user?.id ? (
                            <>
                              <Select value={u.role} onValueChange={(v) => handleChangeRole(u.id, v as 'admin' | 'user')}>
                                <SelectTrigger className="w-32 h-8"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="user">Gebruiker</SelectItem>
                                  <SelectItem value="admin">Admin</SelectItem>
                                </SelectContent>
                              </Select>
                              <Button
                                size="icon" variant="ghost"
                                className="text-destructive hover:bg-destructive/10"
                                onClick={() => handleDeleteUser(u.id)}
                                disabled={actionLoading === u.id}
                              >
                                {actionLoading === u.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                              </Button>
                            </>
                          ) : (
                            <span className="text-sm text-muted-foreground">Jij</span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
