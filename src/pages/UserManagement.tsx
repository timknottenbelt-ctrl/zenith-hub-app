import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
import { 
  Users, 
  UserPlus, 
  Shield, 
  ShieldCheck, 
  Clock, 
  Loader2,
  Check,
  X,
  Trash2,
  Mail,
} from 'lucide-react';
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
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserRole, setNewUserRole] = useState<'user' | 'admin'>('user');
  const [creating, setCreating] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
    }
  }, [isAdmin]);

  async function fetchUsers() {
    setLoading(true);
    
    // Fetch all user roles with profile info
    const { data: rolesData, error: rolesError } = await supabase
      .from('user_roles')
      .select('*')
      .order('created_at', { ascending: false });

    if (rolesError) {
      console.error('Error fetching roles:', rolesError);
      toast({ title: 'Fout', description: 'Kon gebruikers niet laden', variant: 'destructive' });
      setLoading(false);
      return;
    }

    // Fetch profiles for all users
    const userIds = rolesData.map(r => r.user_id);
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('id, name, email')
      .in('id', userIds);

    // Combine data
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

    setUsers(combined);
    setLoading(false);
  }

  async function handleApproveUser(userId: string) {
    setActionLoading(userId);
    
    const { error } = await supabase
      .from('user_roles')
      .update({ 
        role: 'user', 
        approved_at: new Date().toISOString(),
        approved_by: user?.id 
      })
      .eq('user_id', userId);

    if (error) {
      toast({ title: 'Fout', description: 'Kon gebruiker niet goedkeuren', variant: 'destructive' });
    } else {
      toast({ title: 'Succes', description: 'Gebruiker is goedgekeurd' });
      fetchUsers();
    }
    
    setActionLoading(null);
  }

  async function handleRejectUser(userId: string) {
    setActionLoading(userId);
    
    // Delete the user role (this will deny access)
    const { error } = await supabase
      .from('user_roles')
      .delete()
      .eq('user_id', userId);

    if (error) {
      toast({ title: 'Fout', description: 'Kon gebruiker niet afwijzen', variant: 'destructive' });
    } else {
      toast({ title: 'Succes', description: 'Gebruiker is afgewezen' });
      fetchUsers();
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
    if (!newUserEmail || !newUserPassword) {
      toast({ title: 'Fout', description: 'Vul alle velden in', variant: 'destructive' });
      return;
    }

    if (newUserPassword.length < 6) {
      toast({ title: 'Fout', description: 'Wachtwoord moet minimaal 6 tekens zijn', variant: 'destructive' });
      return;
    }

    setCreating(true);

    try {
      // Use edge function to create user with service role
      const { data: sessionData } = await supabase.auth.getSession();
      
      if (!sessionData.session?.access_token) {
        throw new Error('Je sessie is verlopen. Log opnieuw in en probeer het nogmaals.');
      }

      const { data: result, error: fnError } = await supabase.functions.invoke(
        'admin-create-user',
        {
          body: {
            email: newUserEmail,
            password: newUserPassword,
            name: newUserName || undefined,
            role: newUserRole,
          },
        }
      );

      if (fnError) {
        // supabase-js wraps non-2xx responses; try to surface the function's error payload
        const maybeAny = fnError as any;
        let message = fnError.message || 'Fout bij aanmaken gebruiker';
        if (maybeAny?.context) {
          try {
            const payload = await maybeAny.context.json();
            message = payload?.error || message;
          } catch {
            // ignore
          }
        }
        throw new Error(message);
      }

      toast({ 
        title: 'Succes', 
        description: `Gebruiker ${newUserEmail} is aangemaakt. Bij eerste login moet het wachtwoord worden gewijzigd.` 
      });
      
      setAddDialogOpen(false);
      setNewUserEmail('');
      setNewUserPassword('');
      setNewUserName('');
      setNewUserRole('user');
      fetchUsers();
    } catch (error: any) {
      console.error('Create user error:', error);
      toast({ 
        title: 'Fout', 
        description: error.message || 'Kon gebruiker niet aanmaken', 
        variant: 'destructive' 
      });
    }

    setCreating(false);
  }

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin':
        return <Badge className="bg-primary/10 text-primary border-primary/20"><ShieldCheck className="w-3 h-3 mr-1" /> Admin</Badge>;
      case 'user':
        return <Badge variant="secondary"><Shield className="w-3 h-3 mr-1" /> Gebruiker</Badge>;
      case 'pending':
        return <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50"><Clock className="w-3 h-3 mr-1" /> Wachtend</Badge>;
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
              <p className="text-muted-foreground">
                Je hebt geen admin rechten om deze pagina te bekijken.
              </p>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  const pendingUsers = users.filter(u => u.role === 'pending');
  const approvedUsers = users.filter(u => u.role !== 'pending');

  return (
    <DashboardLayout title="Gebruikersbeheer">
      <div className="space-y-6">
        {/* Header with Add Button */}
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
                  Maak een nieuw account aan. De gebruiker ontvangt een bevestigingsmail.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Naam</Label>
                  <Input
                    value={newUserName}
                    onChange={(e) => setNewUserName(e.target.value)}
                    placeholder="Jan Jansen"
                  />
                </div>
                <div className="space-y-2">
                  <Label>E-mail *</Label>
                  <Input
                    type="email"
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                    placeholder="jan@lbh.nl"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Wachtwoord *</Label>
                  <Input
                    type="password"
                    value={newUserPassword}
                    onChange={(e) => setNewUserPassword(e.target.value)}
                    placeholder="Minimaal 6 tekens"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Rol</Label>
                  <Select value={newUserRole} onValueChange={(v) => setNewUserRole(v as 'user' | 'admin')}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">Gebruiker</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
                  Annuleren
                </Button>
                <Button onClick={handleCreateUser} disabled={creating}>
                  {creating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <UserPlus className="w-4 h-4 mr-2" />}
                  Aanmaken
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Pending Approvals */}
        {pendingUsers.length > 0 && (
          <Card className="border-amber-200 bg-amber-50/50">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2 text-amber-700">
                <Clock className="w-5 h-5" />
                Wachtend op Goedkeuring ({pendingUsers.length})
              </CardTitle>
              <CardDescription>
                Deze gebruikers hebben zich geregistreerd en wachten op goedkeuring
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {pendingUsers.map((pendingUser) => (
                  <div 
                    key={pendingUser.id} 
                    className="flex items-center justify-between p-4 bg-white rounded-lg border"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                        <Mail className="w-5 h-5 text-amber-600" />
                      </div>
                      <div>
                        <p className="font-medium">{pendingUser.name || pendingUser.email}</p>
                        <p className="text-sm text-muted-foreground">{pendingUser.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
                        onClick={() => handleRejectUser(pendingUser.id)}
                        disabled={actionLoading === pendingUser.id}
                      >
                        {actionLoading === pendingUser.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <><X className="w-4 h-4 mr-1" /> Afwijzen</>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleApproveUser(pendingUser.id)}
                        disabled={actionLoading === pendingUser.id}
                      >
                        {actionLoading === pendingUser.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <><Check className="w-4 h-4 mr-1" /> Goedkeuren</>
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* All Users Table */}
        <Card className="card-premium">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Alle Gebruikers ({approvedUsers.length})
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
                    <TableHead>Goedgekeurd op</TableHead>
                    <TableHead className="text-right">Acties</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {approvedUsers.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">
                        {u.name || '-'}
                      </TableCell>
                      <TableCell>{u.email}</TableCell>
                      <TableCell>{getRoleBadge(u.role)}</TableCell>
                      <TableCell>
                        {u.approved_at 
                          ? format(new Date(u.approved_at), 'dd MMM yyyy', { locale: nl })
                          : '-'
                        }
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {u.id !== user?.id && (
                            <>
                              <Select 
                                value={u.role} 
                                onValueChange={(v) => handleChangeRole(u.id, v as 'admin' | 'user')}
                              >
                                <SelectTrigger className="w-32 h-8">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="user">Gebruiker</SelectItem>
                                  <SelectItem value="admin">Admin</SelectItem>
                                </SelectContent>
                              </Select>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="text-destructive hover:bg-destructive/10"
                                onClick={() => handleRejectUser(u.id)}
                                disabled={actionLoading === u.id}
                              >
                                {actionLoading === u.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Trash2 className="w-4 h-4" />
                                )}
                              </Button>
                            </>
                          )}
                          {u.id === user?.id && (
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
