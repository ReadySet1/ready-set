"use client";

import React, { useState, useEffect } from 'react';
import { useUser } from '@/contexts/UserContext';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Activity,
  AlertCircle,
  CheckCircle,
  Clock,
  Download,
  Eye,
  EyeOff,
  RefreshCw,
  Shield,
  User,
  Database,
  Network,
  Timer,
  BarChart3,
  Settings,
  Info,
  X,
} from 'lucide-react';

interface DiagnosticData {
  timestamp: Date;
  authState: any;
  profileState: any;
  user: any;
  error: any;
  performance: {
    authInitTime: number;
    profileFetchTime: number;
    sessionValidationTime: number;
  };
}

export default function AuthDiagnosticsPage() {
  const {
    user,
    isLoading,
    error,
    authState,
    profileState,
    refreshUserData,
    retryAuth,
    clearError,
  } = useUser();

  const [diagnosticData, setDiagnosticData] = useState<DiagnosticData[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [showSensitiveData, setShowSensitiveData] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Record diagnostic data
  const recordDiagnosticData = () => {
    const data: DiagnosticData = {
      timestamp: new Date(),
      authState,
      profileState,
      user,
      error,
      performance: {
        authInitTime: 0, // This would come from UserContext metrics
        profileFetchTime: 0,
        sessionValidationTime: 0,
      },
    };

    setDiagnosticData(prev => [data, ...prev.slice(0, 49)]); // Keep last 50 records
  };

  // Auto-refresh diagnostic data
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      recordDiagnosticData();
    }, 5000); // Record every 5 seconds

    return () => clearInterval(interval);
  }, [autoRefresh, authState, profileState, user, error]);

  // Initial recording
  useEffect(() => {
    recordDiagnosticData();
  }, []);

  // Export diagnostic data
  const exportDiagnosticData = () => {
    const data = {
      exportTimestamp: new Date().toISOString(),
      diagnosticData,
      summary: {
        totalRecords: diagnosticData.length,
        hasErrors: diagnosticData.some(d => d.error),
        averageAuthTime: diagnosticData.reduce((sum, d) => sum + d.performance.authInitTime, 0) / diagnosticData.length || 0,
      },
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `auth-diagnostics-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'error':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'warning':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4" />;
      case 'error':
        return <AlertCircle className="h-4 w-4" />;
      case 'warning':
        return <AlertCircle className="h-4 w-4" />;
      default:
        return <Info className="h-4 w-4" />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      <div className="container mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
                <Shield className="h-8 w-8 text-blue-600" />
                Authentication Diagnostics
              </h1>
              <p className="text-slate-600 mt-2">
                Real-time monitoring and debugging of the authentication system
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={exportDiagnosticData}
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Export Data
              </Button>
              <Button
                onClick={recordDiagnosticData}
                className="flex items-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh Now
              </Button>
            </div>
          </div>
        </div>

        {/* Control Panel */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Control Panel
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="flex items-center space-x-2">
                <Switch
                  id="auto-refresh"
                  checked={autoRefresh}
                  onCheckedChange={setAutoRefresh}
                />
                <Label htmlFor="auto-refresh">Auto Refresh (5s)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="sensitive-data"
                  checked={showSensitiveData}
                  onCheckedChange={setShowSensitiveData}
                />
                <Label htmlFor="sensitive-data">
                  {showSensitiveData ? (
                    <span className="flex items-center gap-1">
                      <Eye className="h-4 w-4" />
                      Show Sensitive Data
                    </span>
                  ) : (
                    <span className="flex items-center gap-1">
                      <EyeOff className="h-4 w-4" />
                      Hide Sensitive Data
                    </span>
                  )}
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="recording"
                  checked={isRecording}
                  onCheckedChange={setIsRecording}
                />
                <Label htmlFor="recording">Continuous Recording</Label>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Current State */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Current State
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label className="text-sm font-medium text-slate-700">Authentication Status</Label>
                    <Badge className={`mt-1 ${getStatusColor(authState.isAuthenticated ? 'success' : 'error')}`}>
                      {getStatusIcon(authState.isAuthenticated ? 'success' : 'error')}
                      {authState.isAuthenticated ? 'Authenticated' : 'Not Authenticated'}
                    </Badge>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">Initialization Status</Label>
                    <Badge className={`mt-1 ${getStatusColor(authState.isInitialized ? 'success' : 'warning')}`}>
                      {getStatusIcon(authState.isInitialized ? 'success' : 'warning')}
                      {authState.isInitialized ? 'Initialized' : 'Not Initialized'}
                    </Badge>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">Loading State</Label>
                    <Badge className={`mt-1 ${getStatusColor(authState.isLoading ? 'warning' : 'success')}`}>
                      {getStatusIcon(authState.isLoading ? 'warning' : 'success')}
                      {authState.isLoading ? 'Loading' : 'Ready'}
                    </Badge>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">Profile State</Label>
                    <Badge className={`mt-1 ${getStatusColor(profileState.isLoading ? 'warning' : profileState.data ? 'success' : 'error')}`}>
                      {getStatusIcon(profileState.isLoading ? 'warning' : profileState.data ? 'success' : 'error')}
                      {profileState.isLoading ? 'Loading' : profileState.data ? 'Loaded' : 'Not Loaded'}
                    </Badge>
                  </div>
                </div>

                {user && (
                  <div className="border-t pt-4">
                    <Label className="text-sm font-medium text-slate-700">User Information</Label>
                    <div className="mt-2 space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-600">User ID:</span>
                        <span className="font-mono text-xs">
                          {showSensitiveData ? user.id : `${user.id.substring(0, 8)}...`}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">Email:</span>
                        <span className="font-mono text-xs">
                          {showSensitiveData ? user.email : `${user.email.substring(0, 8)}...`}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">Last Auth Check:</span>
                        <span className="text-xs">
                          {authState.lastAuthCheck ? new Date(authState.lastAuthCheck).toLocaleTimeString() : 'Never'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Current Error */}
            {error && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-red-600">
                    <AlertCircle className="h-5 w-5" />
                    Current Error
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm font-medium">Type:</span>
                      <Badge variant="outline" className="text-xs">
                        {error.type}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm font-medium">Message:</span>
                      <span className="text-sm text-red-600">{error.message}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm font-medium">Retryable:</span>
                      <Badge variant="outline" className={error.retryable ? 'text-green-600' : 'text-red-600'}>
                        {error.retryable ? 'Yes' : 'No'}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm font-medium">Timestamp:</span>
                      <span className="text-xs">
                        {new Date(error.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex gap-2 mt-4">
                      <Button
                        size="sm"
                        onClick={retryAuth}
                        className="flex items-center gap-1"
                      >
                        <RefreshCw className="h-3 w-3" />
                        Retry Auth
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={clearError}
                        className="flex items-center gap-1"
                      >
                        <X className="h-3 w-3" />
                        Clear Error
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Performance Metrics */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Performance Metrics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="text-center p-4 border rounded-lg">
                      <div className="text-2xl font-bold text-blue-600">
                        {authState.retryCount}
                      </div>
                      <div className="text-sm text-slate-600">Auth Retries</div>
                    </div>
                    <div className="text-center p-4 border rounded-lg">
                      <div className="text-2xl font-bold text-green-600">
                        {profileState.retryCount}
                      </div>
                      <div className="text-sm text-slate-600">Profile Retries</div>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-slate-700">Last Successful Auth</Label>
                    <div className="text-sm text-slate-600">
                      {authState.lastAuthCheck ? new Date(authState.lastAuthCheck).toLocaleString() : 'Never'}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-slate-700">Profile Last Fetched</Label>
                    <div className="text-sm text-slate-600">
                      {profileState.lastFetched ? new Date(profileState.lastFetched).toLocaleString() : 'Never'}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* System Health */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  System Health
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Authentication System</span>
                    <Badge className={getStatusColor(authState.isInitialized ? 'success' : 'error')}>
                      {authState.isInitialized ? 'Healthy' : 'Unhealthy'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Profile System</span>
                    <Badge className={getStatusColor(profileState.data ? 'success' : 'warning')}>
                      {profileState.data ? 'Healthy' : 'Warning'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Error Rate</span>
                    <Badge className={getStatusColor(error ? 'error' : 'success')}>
                      {error ? 'High' : 'Low'}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Diagnostic History */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Diagnostic History ({diagnosticData.length} records)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-96 overflow-y-auto space-y-2">
              {diagnosticData.map((record, index) => (
                <motion.div
                  key={record.timestamp.getTime()}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="border rounded-lg p-3 text-sm"
                >
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {record.timestamp.toLocaleTimeString()}
                        </span>
                        <Badge className={getStatusColor(record.error ? 'error' : 'success')}>
                          {record.error ? 'Error' : 'OK'}
                        </Badge>
                      </div>
                      <div className="text-xs text-slate-600 space-y-1">
                        <div>Auth: {record.authState.isAuthenticated ? '✓' : '✗'}</div>
                        <div>Init: {record.authState.isInitialized ? '✓' : '✗'}</div>
                        <div>Loading: {record.authState.isLoading ? '✓' : '✗'}</div>
                        <div>Profile: {record.profileState.data ? '✓' : '✗'}</div>
                      </div>
                    </div>
                    {record.error && (
                      <div className="text-xs text-red-600 max-w-xs">
                        {record.error.message}
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 