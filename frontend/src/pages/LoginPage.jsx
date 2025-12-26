import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Mail, ArrowRight, Shield, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { verifyCode } from '@/lib/api';

export default function LoginPage() {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!code.trim()) {
      toast.error('Please enter your access code');
      return;
    }

    setLoading(true);
    try {
      const response = await verifyCode(code);
      const { token, expires_at, email_address } = response.data;
      
      localStorage.setItem('token', token);
      localStorage.setItem('userEmail', email_address);
      localStorage.setItem('expiresAt', expires_at);
      
      toast.success('Access granted! Redirecting to dashboard...');
      setTimeout(() => navigate('/dashboard'), 500);
    } catch (error) {
      const message = error.response?.data?.detail || 'Invalid or expired code';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-grid relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl pointer-events-none" />
      
      <div className="w-full max-w-md animate-slide-up">
        <Card className="glass border-white/10 shadow-2xl" data-testid="login-card">
          <CardHeader className="text-center space-y-4 pb-2">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center glow-primary">
              <Mail className="w-8 h-8 text-primary" />
            </div>
            <div>
              <CardTitle className="text-3xl font-bold tracking-tight">
                TempMail
              </CardTitle>
              <CardDescription className="text-muted-foreground mt-2">
                Enter your access code to get started
              </CardDescription>
            </div>
          </CardHeader>
          
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Input
                  data-testid="access-code-input"
                  type="text"
                  placeholder="Enter access code"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  className="h-14 text-center text-xl font-mono code-input bg-black/30 border-white/10 focus:border-primary/50 placeholder:text-muted-foreground/40"
                  maxLength={12}
                  autoComplete="off"
                  autoFocus
                />
                <p className="text-xs text-muted-foreground text-center">
                  Each code is valid for 2 IP addresses
                </p>
              </div>

              <Button
                data-testid="verify-code-btn"
                type="submit"
                className="w-full h-12 text-lg font-semibold bg-primary hover:bg-primary/90 glow-primary animate-pulse-glow"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  <>
                    Access Inbox
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </>
                )}
              </Button>
            </form>

            <div className="mt-8 pt-6 border-t border-white/5">
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Shield className="w-4 h-4" />
                <span>Secure, temporary, disposable emails</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <p className="text-center mt-6 text-sm text-muted-foreground">
          Admin?{' '}
          <button
            data-testid="admin-login-link"
            onClick={() => navigate('/admin')}
            className="text-primary hover:underline font-medium"
          >
            Login here
          </button>
        </p>
      </div>
    </div>
  );
}
