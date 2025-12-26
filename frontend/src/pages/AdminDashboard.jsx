import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { 
  Shield, Plus, Trash2, Copy, LogOut, RefreshCw, 
  Key, Users, Mail, Clock, Check, Loader2, 
  TicketCheck, TicketX, AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { getStats, getCodes, generateCode, revokeCode } from '@/lib/api';

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [codes, setCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [codeToDelete, setCodeToDelete] = useState(null);
  const [expiryHours, setExpiryHours] = useState(12);
  const [newCode, setNewCode] = useState(null);
  const [copiedCode, setCopiedCode] = useState(null);
  const navigate = useNavigate();

  const adminUsername = localStorage.getItem('adminUsername');

  // Check admin auth
  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    if (!token) {
      navigate('/admin');
      return;
    }
  }, [navigate]);

  const fetchData = useCallback(async () => {
    try {
      const [statsRes, codesRes] = await Promise.all([
        getStats(),
        getCodes()
      ]);
      setStats(statsRes.data);
      setCodes(codesRes.data);
    } catch (error) {
      if (error.response?.status === 401 || error.response?.status === 403) {
        localStorage.removeItem('adminToken');
        localStorage.removeItem('adminUsername');
        navigate('/admin');
      } else {
        toast.error('Failed to fetch data');
      }
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleGenerateCode = async () => {
    setGenerating(true);
    try {
      const response = await generateCode(expiryHours);
      setNewCode(response.data);
      setCodes([response.data, ...codes]);
      setStats(prev => prev ? {
        ...prev,
        total_codes: prev.total_codes + 1,
        active_codes: prev.active_codes + 1
      } : null);
      toast.success('Access code generated!');
    } catch (error) {
      toast.error('Failed to generate code');
      setGenerateDialogOpen(false);
    } finally {
      setGenerating(false);
    }
  };

  const handleRevokeCode = async () => {
    if (!codeToDelete) return;
    
    try {
      await revokeCode(codeToDelete.id);
      setCodes(codes.filter(c => c.id !== codeToDelete.id));
      setStats(prev => prev ? {
        ...prev,
        total_codes: prev.total_codes - 1,
        active_codes: codeToDelete.used ? prev.active_codes : prev.active_codes - 1,
        used_codes: codeToDelete.used ? prev.used_codes - 1 : prev.used_codes
      } : null);
      toast.success('Code revoked');
    } catch (error) {
      toast.error('Failed to revoke code');
    } finally {
      setDeleteDialogOpen(false);
      setCodeToDelete(null);
    }
  };

  const handleCopyCode = async (code) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      toast.success('Code copied to clipboard!');
      setTimeout(() => setCopiedCode(null), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminUsername');
    navigate('/admin');
  };

  const getCodeStatus = (code) => {
    if (code.used) return { label: 'Used', variant: 'secondary', icon: TicketCheck };
    const isExpired = new Date(code.expires_at) < new Date();
    if (isExpired) return { label: 'Expired', variant: 'destructive', icon: TicketX };
    return { label: 'Active', variant: 'default', icon: Key };
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleString();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-grid" data-testid="admin-dashboard">
      {/* Header */}
      <header className="border-b border-white/5 bg-card/50 backdrop-blur-lg sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center">
                <Shield className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Admin Panel</h1>
                <p className="text-xs text-muted-foreground">Logged in as {adminUsername}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button
                data-testid="refresh-data-btn"
                variant="ghost"
                size="sm"
                onClick={fetchData}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
              <Button
                data-testid="admin-logout-btn"
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="text-muted-foreground hover:text-foreground"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4" data-testid="stats-section">
          <Card className="glass border-white/10">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Key className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold" data-testid="total-codes">{stats?.total_codes || 0}</p>
                  <p className="text-sm text-muted-foreground">Total Codes</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="glass border-white/10">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center">
                  <TicketCheck className="w-6 h-6 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold" data-testid="active-codes">{stats?.active_codes || 0}</p>
                  <p className="text-sm text-muted-foreground">Active Codes</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="glass border-white/10">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
                  <Users className="w-6 h-6 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold" data-testid="used-codes">{stats?.used_codes || 0}</p>
                  <p className="text-sm text-muted-foreground">Used Codes</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="glass border-white/10">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-orange-500/10 flex items-center justify-center">
                  <Mail className="w-6 h-6 text-orange-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold" data-testid="total-emails">{stats?.total_emails || 0}</p>
                  <p className="text-sm text-muted-foreground">Temp Emails</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Codes Table */}
        <Card className="glass border-white/10">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Key className="w-5 h-5" />
                Access Codes
              </CardTitle>
              <Button
                data-testid="open-generate-dialog-btn"
                onClick={() => {
                  setNewCode(null);
                  setExpiryHours(12);
                  setGenerateDialogOpen(true);
                }}
                className="bg-primary hover:bg-primary/90"
              >
                <Plus className="w-4 h-4 mr-2" />
                Generate Code
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              {codes.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                    <AlertCircle className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <h3 className="font-semibold mb-1">No access codes yet</h3>
                  <p className="text-sm text-muted-foreground">
                    Generate your first access code to get started
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-white/5 hover:bg-transparent">
                      <TableHead>Code</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Expires</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {codes.map((code, index) => {
                      const status = getCodeStatus(code);
                      const StatusIcon = status.icon;
                      return (
                        <TableRow 
                          key={code.id} 
                          className="border-white/5 animate-slide-in"
                          style={{ animationDelay: `${index * 0.05}s` }}
                          data-testid={`code-row-${index}`}
                        >
                          <TableCell>
                            <code className="font-mono text-primary font-medium bg-primary/10 px-2 py-1 rounded">
                              {code.code}
                            </code>
                          </TableCell>
                          <TableCell>
                            <Badge variant={status.variant} className="gap-1">
                              <StatusIcon className="w-3 h-3" />
                              {status.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {formatDate(code.created_at)}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {formatDate(code.expires_at)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                data-testid={`copy-code-btn-${index}`}
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleCopyCode(code.code)}
                              >
                                {copiedCode === code.code ? (
                                  <Check className="w-4 h-4 text-green-500" />
                                ) : (
                                  <Copy className="w-4 h-4" />
                                )}
                              </Button>
                              <Button
                                data-testid={`revoke-code-btn-${index}`}
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => {
                                  setCodeToDelete(code);
                                  setDeleteDialogOpen(true);
                                }}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </main>

      {/* Generate Code Dialog */}
      <Dialog open={generateDialogOpen} onOpenChange={setGenerateDialogOpen}>
        <DialogContent className="glass border-white/10">
          <DialogHeader>
            <DialogTitle>Generate Access Code</DialogTitle>
            <DialogDescription>
              Create a new single-use access code for users
            </DialogDescription>
          </DialogHeader>
          
          {newCode ? (
            <div className="py-6 text-center">
              <div className="inline-flex items-center gap-2 bg-primary/10 px-6 py-4 rounded-xl mb-4">
                <code className="text-2xl font-mono font-bold text-primary" data-testid="generated-code">
                  {newCode.code}
                </code>
                <Button
                  data-testid="copy-new-code-btn"
                  variant="ghost"
                  size="icon"
                  onClick={() => handleCopyCode(newCode.code)}
                >
                  {copiedCode === newCode.code ? (
                    <Check className="w-5 h-5 text-green-500" />
                  ) : (
                    <Copy className="w-5 h-5" />
                  )}
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Valid for {expiryHours} hours • Expires: {formatDate(newCode.expires_at)}
              </p>
            </div>
          ) : (
            <div className="py-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="expiry">Expiry Duration (hours)</Label>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <Input
                    data-testid="expiry-hours-input"
                    id="expiry"
                    type="number"
                    min={1}
                    max={168}
                    value={expiryHours}
                    onChange={(e) => setExpiryHours(parseInt(e.target.value) || 12)}
                    className="bg-black/30 border-white/10"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Code will expire {expiryHours} hours after generation
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            {newCode ? (
              <Button
                data-testid="close-dialog-btn"
                onClick={() => setGenerateDialogOpen(false)}
                className="w-full"
              >
                Done
              </Button>
            ) : (
              <>
                <Button
                  variant="ghost"
                  onClick={() => setGenerateDialogOpen(false)}
                  className="border-white/10"
                >
                  Cancel
                </Button>
                <Button
                  data-testid="generate-code-btn"
                  onClick={handleGenerateCode}
                  disabled={generating}
                  className="bg-primary hover:bg-primary/90"
                >
                  {generating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Key className="w-4 h-4 mr-2" />
                      Generate
                    </>
                  )}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="glass border-white/10">
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke Access Code</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to revoke code <strong className="font-mono text-foreground">{codeToDelete?.code}</strong>? 
              This will prevent anyone from using this code.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-white/10">Cancel</AlertDialogCancel>
            <AlertDialogAction
              data-testid="confirm-revoke-btn"
              onClick={handleRevokeCode}
              className="bg-destructive hover:bg-destructive/90"
            >
              Revoke Code
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
