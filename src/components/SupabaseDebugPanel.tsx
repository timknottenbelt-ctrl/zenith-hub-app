import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  ENV_STATUS, 
  BUILD_ID, 
  getSupabaseClient, 
  getSupabaseInitError,
  testSupabaseConnection 
} from '@/lib/supabase';
import { CheckCircle, XCircle, Loader2, RefreshCw } from 'lucide-react';

interface ConnectionResult {
  ok: boolean;
  error?: string;
  code?: string;
}

export function SupabaseDebugPanel() {
  const [connectionResult, setConnectionResult] = useState<ConnectionResult | null>(null);
  const [testing, setTesting] = useState(false);

  const client = getSupabaseClient();
  const initError = getSupabaseInitError();

  const runConnectionTest = async () => {
    setTesting(true);
    setConnectionResult(null);
    const result = await testSupabaseConnection();
    setConnectionResult(result);
    setTesting(false);
  };

  // Auto-test on mount if client exists
  useEffect(() => {
    if (client) {
      runConnectionTest();
    }
  }, []);

  const StatusIcon = ({ ok }: { ok: boolean }) => 
    ok ? <CheckCircle className="h-4 w-4 text-green-500" /> : <XCircle className="h-4 w-4 text-red-500" />;

  return (
    <Card className="border-dashed border-yellow-500/50 bg-yellow-500/5">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          🔧 Supabase Debug Panel
          <Badge variant="outline" className="text-xs font-mono">
            BUILD: {BUILD_ID}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Environment Status */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold uppercase text-muted-foreground">
            Environment Variables
          </h4>
          <div className="grid gap-1 text-sm font-mono">
            <div>MODE: {ENV_STATUS.mode}</div>
            <div>DEV: {String(ENV_STATUS.isDev)} | PROD: {String(ENV_STATUS.isProd)}</div>
            <div>
              Host: {typeof window !== 'undefined' ? window.location.hostname : '(server)'}
            </div>
            <div className="flex items-center gap-2 pt-1">
              <StatusIcon ok={ENV_STATUS.hasUrl} />
              <span>
                VITE_SUPABASE_URL present: {String(ENV_STATUS.hasUrl)} (len {ENV_STATUS.urlLength})
              </span>
            </div>
            <div className="flex items-center gap-2">
              <StatusIcon ok={ENV_STATUS.hasKey} />
              <span>
                VITE_SUPABASE_ANON_KEY present: {String(ENV_STATUS.hasKey)} (len {ENV_STATUS.keyLength})
              </span>
            </div>
            <div className="flex items-center gap-2">
              <StatusIcon ok={ENV_STATUS.urlStartsWithHttps} />
              <span>URL starts with https://: {String(ENV_STATUS.urlStartsWithHttps)}</span>
            </div>
          </div>
        </div>

        {/* Client Status */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold uppercase text-muted-foreground">Client Status</h4>
          <div className="flex items-center gap-2 text-sm">
            <StatusIcon ok={!!client} />
            <span>Client initialized: {String(!!client)}</span>
          </div>
          {initError && (
            <div className="rounded bg-red-500/10 p-2 text-xs text-red-600 dark:text-red-400">
              Init Error: {initError}
            </div>
          )}
        </div>

        {/* Connection Test */}
        {client && (
          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase text-muted-foreground">Connection Test</h4>
            <div className="flex items-center gap-2">
              <Button 
                size="sm" 
                variant="outline" 
                onClick={runConnectionTest}
                disabled={testing}
              >
                {testing ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-1" />
                )}
                Test Connection
              </Button>
            </div>
            {connectionResult && (
              <div className={`rounded p-2 text-xs ${
                connectionResult.ok 
                  ? 'bg-green-500/10 text-green-600 dark:text-green-400' 
                  : 'bg-red-500/10 text-red-600 dark:text-red-400'
              }`}>
                {connectionResult.ok ? (
                  '✓ Connection successful!'
                ) : (
                  <>
                    <div>✗ Connection failed</div>
                    {connectionResult.code && <div>Code: {connectionResult.code}</div>}
                    <div>Error: {connectionResult.error}</div>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* Next Steps */}
        {!ENV_STATUS.hasUrl || !ENV_STATUS.hasKey ? (
          <div className="rounded bg-amber-500/10 p-3 text-xs space-y-1">
            <div className="font-semibold">⚠️ Secrets not injected</div>
            <div>1. Check Project → Secrets for VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY</div>
            <div>2. If they exist, re-save them (same value) to trigger re-injection</div>
            <div>3. Wait for rebuild (~30s) and refresh</div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
