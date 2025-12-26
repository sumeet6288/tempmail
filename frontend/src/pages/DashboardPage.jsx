import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { 
  Mail, Copy, Trash2, RefreshCw, Plus, LogOut, Clock, 
  Inbox, Check, ChevronRight, Loader2 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
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
import { getEmails, getMessages, deleteMessage, generateEmail } from '@/lib/api';

export default function DashboardPage() {
  const [emails, setEmails] = useState([]);
  const [messages, setMessages] = useState([]);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [messageToDelete, setMessageToDelete] = useState(null);
  const [copied, setCopied] = useState(false);
  const [timeLeft, setTimeLeft] = useState('');
  const navigate = useNavigate();

  const userEmail = localStorage.getItem('userEmail');
  const expiresAt = localStorage.getItem('expiresAt');

  // Check session validity
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/');
      return;
    }
  }, [navigate]);

  // Calculate time left
  useEffect(() => {
    if (!expiresAt) return;

    const updateTimeLeft = () => {
      const now = new Date();
      const expiry = new Date(expiresAt);
      const diff = expiry - now;

      if (diff <= 0) {
        setTimeLeft('Expired');
        toast.error('Session expired. Please use a new access code.');
        handleLogout();
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      setTimeLeft(`${hours}h ${minutes}m`);
    };

    updateTimeLeft();
    const interval = setInterval(updateTimeLeft, 60000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  const fetchData = useCallback(async () => {
    try {
      const [emailsRes, messagesRes] = await Promise.all([
        getEmails(),
        getMessages()
      ]);
      setEmails(emailsRes.data);
      setMessages(messagesRes.data);
    } catch (error) {
      if (error.response?.status !== 401) {
        toast.error('Failed to fetch data');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    toast.success('Inbox refreshed');
  };

  const handleGenerateEmail = async () => {
    setGenerating(true);
    try {
      const response = await generateEmail();
      setEmails([response.data, ...emails]);
      toast.success('New email address generated!');
    } catch (error) {
      toast.error('Failed to generate email');
    } finally {
      setGenerating(false);
    }
  };

  const handleCopyEmail = async (email) => {
    try {
      await navigator.clipboard.writeText(email);
      setCopied(true);
      toast.success('Email address copied!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  };

  const handleDeleteMessage = async () => {
    if (!messageToDelete) return;
    
    try {
      await deleteMessage(messageToDelete.id);
      setMessages(messages.filter(m => m.id !== messageToDelete.id));
      if (selectedMessage?.id === messageToDelete.id) {
        setSelectedMessage(null);
      }
      toast.success('Message deleted');
    } catch (error) {
      toast.error('Failed to delete message');
    } finally {
      setDeleteDialogOpen(false);
      setMessageToDelete(null);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('expiresAt');
    navigate('/');
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-grid" data-testid="dashboard">
      {/* Header */}
      <header className="border-b border-white/5 bg-card/50 backdrop-blur-lg sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Mail className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold">TempMail</h1>
                <p className="text-xs text-muted-foreground">Temporary Email Service</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="hidden md:flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="w-4 h-4" />
                <span>Session expires in: <strong className="text-foreground">{timeLeft}</strong></span>
              </div>
              <Button
                data-testid="logout-btn"
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

      <main className="container mx-auto px-4 py-6">
        <div className="grid lg:grid-cols-12 gap-6">
          {/* Sidebar - Email Addresses */}
          <div className="lg:col-span-3">
            <Card className="glass border-white/10">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Your Emails</CardTitle>
                  <Button
                    data-testid="generate-email-btn"
                    size="sm"
                    onClick={handleGenerateEmail}
                    disabled={generating}
                    className="bg-primary hover:bg-primary/90"
                  >
                    {generating ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Plus className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[200px]">
                  {emails.length === 0 ? (
                    <div className="p-4 text-center text-muted-foreground text-sm">
                      No email addresses yet
                    </div>
                  ) : (
                    <div className="divide-y divide-white/5">
                      {emails.map((email, index) => (
                        <div
                          key={email.id}
                          className="p-3 hover:bg-white/5 transition-colors group animate-slide-in"
                          style={{ animationDelay: `${index * 0.1}s` }}
                        >
                          <div className="flex items-center justify-between">
                            <code className="text-sm font-mono text-primary truncate max-w-[180px]" data-testid={`email-address-${index}`}>
                              {email.email_address}
                            </code>
                            <Button
                              data-testid={`copy-email-btn-${index}`}
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => handleCopyEmail(email.email_address)}
                            >
                              {copied ? (
                                <Check className="w-4 h-4 text-green-500" />
                              ) : (
                                <Copy className="w-4 h-4" />
                              )}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Mobile time left */}
            <div className="lg:hidden mt-4 flex items-center justify-center gap-2 text-sm text-muted-foreground bg-card/50 rounded-lg p-3 border border-white/5">
              <Clock className="w-4 h-4" />
              <span>Expires in: <strong className="text-foreground">{timeLeft}</strong></span>
            </div>
          </div>

          {/* Main Content - Messages */}
          <div className="lg:col-span-9">
            <Card className="glass border-white/10 h-full">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Inbox className="w-5 h-5 text-muted-foreground" />
                    <CardTitle className="text-lg">Inbox</CardTitle>
                    <Badge variant="secondary" className="font-mono" data-testid="message-count">
                      {messages.length}
                    </Badge>
                  </div>
                  <Button
                    data-testid="refresh-inbox-btn"
                    variant="ghost"
                    size="sm"
                    onClick={handleRefresh}
                    disabled={refreshing}
                  >
                    <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                </div>
              </CardHeader>
              <Separator className="bg-white/5" />
              <CardContent className="p-0">
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center" data-testid="empty-inbox">
                    <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                      <Inbox className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <h3 className="font-semibold mb-1">No messages yet</h3>
                    <p className="text-sm text-muted-foreground max-w-sm">
                      Copy your email address and use it to receive emails. Messages will appear here automatically.
                    </p>
                  </div>
                ) : (
                  <div className="grid md:grid-cols-2 divide-x divide-white/5">
                    {/* Message List */}
                    <ScrollArea className="h-[500px]">
                      <div className="divide-y divide-white/5">
                        {messages.map((message, index) => (
                          <div
                            key={message.id}
                            data-testid={`message-item-${index}`}
                            className={`p-4 cursor-pointer email-card animate-slide-in ${
                              selectedMessage?.id === message.id ? 'bg-primary/10 border-l-2 border-l-primary' : ''
                            } ${!message.is_read ? 'bg-white/5' : ''}`}
                            style={{ animationDelay: `${index * 0.05}s` }}
                            onClick={() => setSelectedMessage(message)}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  {!message.is_read && (
                                    <span className="w-2 h-2 rounded-full bg-primary" />
                                  )}
                                  <span className="font-medium truncate text-sm">
                                    {message.from_email}
                                  </span>
                                </div>
                                <p className="font-semibold truncate mb-1">{message.subject}</p>
                                <p className="text-sm text-muted-foreground truncate">
                                  {message.body.substring(0, 60)}...
                                </p>
                              </div>
                              <div className="flex flex-col items-end gap-2">
                                <span className="text-xs text-muted-foreground whitespace-nowrap">
                                  {formatDate(message.received_at)}
                                </span>
                                <ChevronRight className="w-4 h-4 text-muted-foreground" />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>

                    {/* Message Detail */}
                    <div className="hidden md:block">
                      {selectedMessage ? (
                        <div className="p-6 animate-fade-in" data-testid="message-detail">
                          <div className="flex items-start justify-between mb-4">
                            <div>
                              <h3 className="text-xl font-bold mb-2">{selectedMessage.subject}</h3>
                              <p className="text-sm text-muted-foreground">
                                From: <span className="text-foreground">{selectedMessage.from_email}</span>
                              </p>
                              <p className="text-sm text-muted-foreground">
                                To: <span className="text-foreground font-mono">{selectedMessage.to_email}</span>
                              </p>
                              <p className="text-sm text-muted-foreground mt-1">
                                {new Date(selectedMessage.received_at).toLocaleString()}
                              </p>
                            </div>
                            <Button
                              data-testid="delete-message-btn"
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => {
                                setMessageToDelete(selectedMessage);
                                setDeleteDialogOpen(true);
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                          <Separator className="bg-white/5 my-4" />
                          <ScrollArea className="h-[350px]">
                            <div className="prose prose-invert max-w-none">
                              <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                                {selectedMessage.body}
                              </pre>
                            </div>
                          </ScrollArea>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-full text-center p-6">
                          <Mail className="w-12 h-12 text-muted-foreground mb-3" />
                          <p className="text-muted-foreground">Select a message to read</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="glass border-white/10">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Message</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this message? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-white/10">Cancel</AlertDialogCancel>
            <AlertDialogAction
              data-testid="confirm-delete-btn"
              onClick={handleDeleteMessage}
              className="bg-destructive hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
