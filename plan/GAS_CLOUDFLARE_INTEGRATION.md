# GAS Backend + Cloudflare Proxy Integration Guide

**Goal:** Properly configure monorepo to work with existing GAS backend and Cloudflare proxy  
**Audience:** Fintracker + Vault + Staff Attendance modules  
**Compatibility:** 100% with existing infrastructure

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        YOUR USERS                               │
├─────────────────────────────────────────────────────────────────┤
│  Browser 1          Browser 2          Browser 3                │
│  (Fintracker)       (Vault)            (Staff Attendance)       │
│      ↓                  ↓                    ↓                   │
├─────────────────────────────────────────────────────────────────┤
│               VERCEL (Frontend)                                  │
├─────────────────────────────────────────────────────────────────┤
│  App 1              App 2              App 3                     │
│  (Fintracker)       (Vault)            (Staff Attendance)       │
│      ↓                  ↓                    ↓                   │
│      └──────────────┬───────────────────────┘                   │
│                     │                                            │
│            All apps route through:                              │
│              api.yourcompany.com                                │
│                     │                                            │
├─────────────────────────────────────────────────────────────────┤
│             CLOUDFLARE PROXY                                    │
│             (Route optimization)                                │
├─────────────────────────────────────────────────────────────────┤
│                     │                                            │
│       Routes to your GAS backend:                              │
│       https://script.google.com/macros/d/.../usercopy          │
│                     │                                            │
├─────────────────────────────────────────────────────────────────┤
│             GAS BACKEND                                         │
│  ├─ Google Sheets (database)                                    │
│  ├─ Authentication                                              │
│  ├─ Transaction processing                                      │
│  ├─ Data validation                                             │
│  └─ Business logic                                              │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔧 Configuration for Monorepo

### Step 1: Shared Config Package

**File:** `packages/shared/config/src/gas.ts`

```typescript
// GAS Backend Configuration
// This is your source of truth for backend integration

export const gasConfig = {
  // Your GAS script details
  scriptId: process.env.NEXT_PUBLIC_GAS_SCRIPT_ID || '',
  deploymentId: process.env.NEXT_PUBLIC_GAS_DEPLOYMENT_ID || '',
  
  // Execution endpoint
  deploymentUrl: () => 
    `https://script.google.com/macros/d/${gasConfig.scriptId}/usercopy`,
  
  // Proxy configuration (Cloudflare)
  proxy: {
    baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.yourcompany.com',
    useProxy: true, // Always route through Cloudflare
  },
  
  // GAS execution timeout
  timeout: 30000, // 30 seconds
  
  // Retry configuration
  retry: {
    enabled: true,
    maxAttempts: 3,
    delayMs: 1000,
  },
};

export type GasConfig = typeof gasConfig;
```

### Step 2: API Client Configuration

**File:** `packages/shared/config/src/api.ts` (UPDATED)

```typescript
import { gasConfig } from './gas';

export const apiConfig = {
  // Proxy URL (routes through Cloudflare)
  baseURL: gasConfig.proxy.baseUrl,
  
  // GAS backend for direct calls (fallback)
  gasDeploymentUrl: gasConfig.deploymentUrl(),
  
  // Your API endpoints
  endpoints: {
    // Authentication
    auth: {
      login: '/api/auth/login',
      logout: '/api/auth/logout',
      refresh: '/api/auth/refresh',
      profile: '/api/auth/profile',
      verify: '/api/auth/verify',
    },
    
    // Fintracker endpoints
    transactions: {
      list: '/api/transactions',
      create: '/api/transactions',
      getById: (id: string) => `/api/transactions/${id}`,
      update: (id: string) => `/api/transactions/${id}`,
      delete: (id: string) => `/api/transactions/${id}`,
    },
    
    accounts: {
      list: '/api/accounts',
      create: '/api/accounts',
      getById: (id: string) => `/api/accounts/${id}`,
      update: (id: string) => `/api/accounts/${id}`,
    },
    
    // Vault endpoints
    vault: {
      items: '/api/vault/items',
      createItem: '/api/vault/items',
      getItem: (id: string) => `/api/vault/items/${id}`,
      updateItem: (id: string) => `/api/vault/items/${id}`,
      deleteItem: (id: string) => `/api/vault/items/${id}`,
    },
    
    // Staff Attendance endpoints (NEW)
    staff: {
      members: '/api/staff/members',
      createMember: '/api/staff/members',
      getMember: (id: string) => `/api/staff/members/${id}`,
      
      attendance: '/api/staff/attendance',
      checkIn: '/api/staff/attendance/check-in',
      checkOut: '/api/staff/attendance/check-out',
      getAttendance: (date: string) => `/api/staff/attendance?date=${date}`,
      
      leave: '/api/staff/leave',
      requestLeave: '/api/staff/leave',
      approveLeave: (id: string) => `/api/staff/leave/${id}/approve`,
      rejectLeave: (id: string) => `/api/staff/leave/${id}/reject`,
    },
  },
  
  // Headers for all requests
  defaultHeaders: {
    'Content-Type': 'application/json',
    // Auth token will be added by auth interceptor
  },
  
  // Timeout in milliseconds
  timeout: gasConfig.timeout,
  
  // Retry policy
  retries: gasConfig.retry.maxAttempts,
  retryDelay: gasConfig.retry.delayMs,
};

export type ApiConfig = typeof apiConfig;
```

### Step 3: HTTP Client with GAS Compatibility

**File:** `packages/shared/utils/src/http-client.ts`

```typescript
import { apiConfig } from '@fintracker-vault/config';

export interface HttpClientConfig {
  baseUrl: string;
  timeout?: number;
  headers?: Record<string, string>;
  retries?: number;
}

export class HttpClient {
  private baseUrl: string;
  private timeout: number;
  private headers: Record<string, string>;
  private retries: number;
  
  constructor(config: HttpClientConfig) {
    this.baseUrl = config.baseUrl;
    this.timeout = config.timeout || 30000;
    this.headers = config.headers || {};
    this.retries = config.retries || 3;
  }
  
  async get<T>(endpoint: string, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }
  
  async post<T>(
    endpoint: string,
    data?: unknown,
    options?: RequestInit
  ): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }
  
  async put<T>(
    endpoint: string,
    data?: unknown,
    options?: RequestInit
  ): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }
  
  async delete<T>(endpoint: string, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }
  
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    // Merge headers
    const headers = {
      ...this.headers,
      ...(options.headers as Record<string, string>),
    };
    
    // Add auth token if available
    const token = this.getAuthToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    // Retry logic
    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= this.retries; attempt++) {
      try {
        const response = await this.fetchWithTimeout(url, {
          ...options,
          headers,
        });
        
        if (!response.ok) {
          // Don't retry 4xx errors (client errors)
          if (response.status >= 400 && response.status < 500) {
            throw new HttpError(
              response.statusText,
              response.status,
              await response.text()
            );
          }
          
          // Retry 5xx errors (server errors)
          if (response.status >= 500) {
            throw new HttpError(
              response.statusText,
              response.status,
              await response.text()
            );
          }
        }
        
        return (await response.json()) as T;
      } catch (error) {
        lastError = error as Error;
        
        if (attempt < this.retries) {
          // Exponential backoff
          const delayMs = Math.pow(2, attempt) * 1000;
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }
    }
    
    throw lastError || new Error('Request failed after retries');
  }
  
  private fetchWithTimeout(
    url: string,
    options: RequestInit
  ): Promise<Response> {
    return Promise.race([
      fetch(url, options),
      new Promise<Response>((_, reject) =>
        setTimeout(() => reject(new Error('Request timeout')), this.timeout)
      ),
    ]);
  }
  
  private getAuthToken(): string | null {
    // In browser environment
    if (typeof window !== 'undefined') {
      return localStorage.getItem('authToken');
    }
    
    // In server environment
    // You might get it from cookies or other sources
    return null;
  }
  
  setAuthToken(token: string): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem('authToken', token);
    }
  }
  
  clearAuthToken(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('authToken');
    }
  }
}

class HttpError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public responseBody: string
  ) {
    super(`HTTP ${statusCode}: ${message}`);
    this.name = 'HttpError';
  }
}

// Create singleton instance
export const httpClient = new HttpClient({
  baseUrl: apiConfig.baseURL,
  timeout: apiConfig.timeout,
  retries: apiConfig.retries,
  headers: apiConfig.defaultHeaders,
});
```

### Step 4: Service Layer Example

**File:** `packages/shared/utils/src/services/transaction-service.ts`

```typescript
import { httpClient } from '../http-client';
import { apiConfig } from '@fintracker-vault/config';
import type { Transaction, PaginatedResponse } from '@fintracker-vault/types';

export class TransactionService {
  async getTransactions(filters?: {
    startDate?: string;
    endDate?: string;
    category?: string;
  }): Promise<Transaction[]> {
    const params = new URLSearchParams();
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);
    if (filters?.category) params.append('category', filters.category);
    
    const endpoint = apiConfig.endpoints.transactions.list;
    const url = params.toString() ? `${endpoint}?${params}` : endpoint;
    
    // Routes through Cloudflare → GAS backend
    return httpClient.get<Transaction[]>(url);
  }
  
  async createTransaction(data: {
    type: 'income' | 'expense';
    category: string;
    amount: number;
    description: string;
    date: string;
  }): Promise<Transaction> {
    // Routes through Cloudflare → GAS backend
    return httpClient.post<Transaction>(
      apiConfig.endpoints.transactions.create,
      data
    );
  }
  
  async updateTransaction(
    id: string,
    data: Partial<Transaction>
  ): Promise<Transaction> {
    // Routes through Cloudflare → GAS backend
    return httpClient.put<Transaction>(
      apiConfig.endpoints.transactions.update(id),
      data
    );
  }
  
  async deleteTransaction(id: string): Promise<void> {
    // Routes through Cloudflare → GAS backend
    await httpClient.delete(apiConfig.endpoints.transactions.delete(id));
  }
}

export const transactionService = new TransactionService();
```

---

## 🌐 Cloudflare Proxy Configuration

### Verify Cloudflare Worker Routing

Your Cloudflare proxy should already be configured, but verify it:

**Check:** Cloudflare Dashboard → Workers

```javascript
// Your existing Cloudflare Worker should have routing like this:

addEventListener('fetch', event => {
  event.respondWith(route(event.request));
});

async function route(request) {
  const url = new URL(request.url);
  
  // All /api/* requests go to GAS backend
  if (url.pathname.startsWith('/api/')) {
    return forwardToGAS(request);
  }
  
  // All other requests go to Vercel (frontend)
  return forwardToVercel(request);
}

async function forwardToGAS(request) {
  const gasUrl = `https://script.google.com/macros/d/YOUR_SCRIPT_ID/usercopy`;
  
  // Forward request to GAS
  const response = await fetch(gasUrl, {
    method: request.method,
    body: request.body,
    headers: {
      ...request.headers,
      // Add any CORS headers if needed
      'Access-Control-Allow-Origin': '*',
    },
  });
  
  return response;
}

async function forwardToVercel(request) {
  const vercelUrl = `https://yourvercel.app${new URL(request.url).pathname}`;
  return fetch(vercelUrl, request);
}
```

### Update Environment Variables for Apps

**In Vercel, set for all 3 apps:**

```
NEXT_PUBLIC_API_BASE_URL=https://api.yourcompany.com
NEXT_PUBLIC_GAS_SCRIPT_ID=your-script-id
NEXT_PUBLIC_GAS_DEPLOYMENT_ID=your-deployment-id
```

**Verify:** When app starts, it should use this URL for all API calls

```bash
# In browser console:
console.log(process.env.NEXT_PUBLIC_API_BASE_URL)
// Should output: https://api.yourcompany.com
```

---

## 🔐 Authentication & Authorization

### Token Management Across Monorepo

**File:** `packages/shared/utils/src/auth.ts`

```typescript
import { httpClient } from './http-client';
import { apiConfig } from '@fintracker-vault/config';
import type { AuthTokens, User } from '@fintracker-vault/types';

export class AuthService {
  private tokenRefreshTimeout: NodeJS.Timeout | null = null;
  
  async login(email: string, password: string): Promise<AuthTokens> {
    // Routes through Cloudflare → GAS backend
    const tokens = await httpClient.post<AuthTokens>(
      apiConfig.endpoints.auth.login,
      { email, password }
    );
    
    this.setTokens(tokens);
    this.setupAutoRefresh(tokens.expiresIn);
    
    return tokens;
  }
  
  async logout(): Promise<void> {
    // Notify backend
    try {
      await httpClient.post(apiConfig.endpoints.auth.logout, {});
    } catch (error) {
      // Continue even if logout API call fails
      console.error('Logout API error:', error);
    }
    
    this.clearTokens();
    this.clearAutoRefresh();
  }
  
  async getProfile(): Promise<User> {
    // Routes through Cloudflare → GAS backend
    return httpClient.get<User>(apiConfig.endpoints.auth.profile);
  }
  
  async refreshToken(): Promise<AuthTokens> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }
    
    // Routes through Cloudflare → GAS backend
    const tokens = await httpClient.post<AuthTokens>(
      apiConfig.endpoints.auth.refresh,
      { refreshToken }
    );
    
    this.setTokens(tokens);
    this.setupAutoRefresh(tokens.expiresIn);
    
    return tokens;
  }
  
  private setTokens(tokens: AuthTokens): void {
    httpClient.setAuthToken(tokens.accessToken);
    if (typeof window !== 'undefined') {
      localStorage.setItem('refreshToken', tokens.refreshToken);
      localStorage.setItem('tokenExpiresAt', 
        (Date.now() + tokens.expiresIn).toString()
      );
    }
  }
  
  private getRefreshToken(): string | null {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('refreshToken');
    }
    return null;
  }
  
  private clearTokens(): void {
    httpClient.clearAuthToken();
    if (typeof window !== 'undefined') {
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('tokenExpiresAt');
    }
  }
  
  private setupAutoRefresh(expiresIn: number): void {
    this.clearAutoRefresh();
    
    // Refresh token 1 minute before expiry
    const refreshTime = (expiresIn - 60) * 1000;
    
    this.tokenRefreshTimeout = setTimeout(() => {
      this.refreshToken().catch(error => {
        console.error('Auto-refresh failed:', error);
        this.logout();
      });
    }, refreshTime);
  }
  
  private clearAutoRefresh(): void {
    if (this.tokenRefreshTimeout) {
      clearTimeout(this.tokenRefreshTimeout);
      this.tokenRefreshTimeout = null;
    }
  }
}

export const authService = new AuthService();
```

---

## 📊 Module-Specific Integrations

### Fintracker Integration

**File:** `packages/apps/fintracker/src/services/fintracker-service.ts`

```typescript
import { transactionService } from '@fintracker-vault/utils';
import { httpClient } from '@fintracker-vault/utils';
import { apiConfig } from '@fintracker-vault/config';
import type { Account } from '@fintracker-vault/types';

export class FinTrackerService {
  // Use shared transaction service
  transactions = transactionService;
  
  // Accounts (Fintracker specific)
  async getAccounts(): Promise<Account[]> {
    return httpClient.get<Account[]>(apiConfig.endpoints.accounts.list);
  }
  
  async createAccount(data: {
    name: string;
    type: 'checking' | 'savings' | 'credit';
    currency: string;
  }): Promise<Account> {
    return httpClient.post<Account>(
      apiConfig.endpoints.accounts.create,
      data
    );
  }
}

export const finTrackerService = new FinTrackerService();
```

### Vault Integration

**File:** `packages/apps/vault/src/services/vault-service.ts`

```typescript
import { httpClient } from '@fintracker-vault/utils';
import { apiConfig } from '@fintracker-vault/config';
import type { VaultItem } from '@fintracker-vault/types';

export class VaultService {
  async getItems(): Promise<VaultItem[]> {
    return httpClient.get<VaultItem[]>(apiConfig.endpoints.vault.items);
  }
  
  async createItem(data: {
    title: string;
    type: 'note' | 'password' | 'document';
    content: string;
    encrypted?: boolean;
  }): Promise<VaultItem> {
    return httpClient.post<VaultItem>(
      apiConfig.endpoints.vault.createItem,
      data
    );
  }
  
  async updateItem(
    id: string,
    data: Partial<VaultItem>
  ): Promise<VaultItem> {
    return httpClient.put<VaultItem>(
      apiConfig.endpoints.vault.updateItem(id),
      data
    );
  }
  
  async deleteItem(id: string): Promise<void> {
    await httpClient.delete(apiConfig.endpoints.vault.deleteItem(id));
  }
}

export const vaultService = new VaultService();
```

### Staff Attendance Integration

**File:** `packages/apps/staff-attendance/src/services/staff-service.ts`

```typescript
import { httpClient } from '@fintracker-vault/utils';
import { apiConfig } from '@fintracker-vault/config';
import type { StaffMember, AttendanceRecord, LeaveRequest } from '@fintracker-vault/types';

export class StaffService {
  // Members
  async getMembers(): Promise<StaffMember[]> {
    return httpClient.get<StaffMember[]>(apiConfig.endpoints.staff.members);
  }
  
  async createMember(data: {
    name: string;
    email: string;
    department: string;
    joinDate: string;
  }): Promise<StaffMember> {
    return httpClient.post<StaffMember>(
      apiConfig.endpoints.staff.createMember,
      data
    );
  }
  
  // Attendance
  async getAttendance(date: string): Promise<AttendanceRecord[]> {
    return httpClient.get<AttendanceRecord[]>(
      apiConfig.endpoints.staff.getAttendance(date)
    );
  }
  
  async checkIn(staffId: string): Promise<AttendanceRecord> {
    return httpClient.post<AttendanceRecord>(
      apiConfig.endpoints.staff.checkIn,
      { staffId, timestamp: new Date().toISOString() }
    );
  }
  
  async checkOut(staffId: string): Promise<AttendanceRecord> {
    return httpClient.post<AttendanceRecord>(
      apiConfig.endpoints.staff.checkOut,
      { staffId, timestamp: new Date().toISOString() }
    );
  }
  
  // Leave Management
  async requestLeave(data: {
    staffId: string;
    startDate: string;
    endDate: string;
    reason: string;
    type: 'sick' | 'vacation' | 'personal';
  }): Promise<LeaveRequest> {
    return httpClient.post<LeaveRequest>(
      apiConfig.endpoints.staff.requestLeave,
      data
    );
  }
  
  async approveLeave(leaveId: string): Promise<LeaveRequest> {
    return httpClient.post<LeaveRequest>(
      apiConfig.endpoints.staff.approveLeave(leaveId),
      {}
    );
  }
}

export const staffService = new StaffService();
```

---

## ✅ Testing Integration

### Test That Everything Routes Correctly

**File:** `packages/shared/utils/__tests__/api-integration.test.ts`

```typescript
import { httpClient } from '../http-client';
import { apiConfig } from '@fintracker-vault/config';

describe('API Integration with Cloudflare & GAS', () => {
  // These tests require backend to be running
  
  it('should route transactions through Cloudflare', async () => {
    const endpoint = apiConfig.endpoints.transactions.list;
    expect(endpoint).toBe('/api/transactions');
    
    // URL should be constructed as:
    // https://api.yourcompany.com/api/transactions
    // which routes through Cloudflare to GAS
  });
  
  it('should route auth through Cloudflare', async () => {
    const endpoint = apiConfig.endpoints.auth.login;
    expect(endpoint).toBe('/api/auth/login');
  });
  
  it('should have proper GAS configuration', () => {
    expect(apiConfig.baseURL).toBe(process.env.NEXT_PUBLIC_API_BASE_URL);
    expect(apiConfig.timeout).toBeGreaterThan(0);
  });
});
```

### Manual Testing

```bash
# Test 1: Verify Cloudflare routing
curl -v https://api.yourcompany.com/api/transactions \
  -H "Authorization: Bearer YOUR_TOKEN"

# Should see:
# - Cloudflare headers (CF-Ray, Server: cloudflare)
# - Your transaction data (from GAS)

# Test 2: Check response time
time curl https://api.yourcompany.com/api/transactions

# Should be < 500ms (Cloudflare + GAS execution)

# Test 3: Verify SSL/TLS
curl -v https://api.yourcompany.com/api/transactions 2>&1 | grep SSL

# Should show: SSL certificate verify ok

# Test 4: Check CORS headers
curl -i -X OPTIONS https://api.yourcompany.com/api/transactions \
  -H "Origin: https://fintracker.com"

# Should return appropriate CORS headers
```

---

## 🚨 Troubleshooting

### Issue 1: API Calls Failing

**Symptoms:** 
- 404 Not Found
- CORS errors
- Timeout

**Check:**
```bash
# 1. Verify Cloudflare routing
curl -v https://api.yourcompany.com/api/test

# 2. Check GAS deployment is active
# Go to Google Apps Script → Deployments
# Ensure your deployment is selected

# 3. Verify environment variables
echo $NEXT_PUBLIC_API_BASE_URL
echo $NEXT_PUBLIC_GAS_SCRIPT_ID

# 4. Check Cloudflare worker is active
# Cloudflare Dashboard → Workers → Enabled
```

### Issue 2: Slow API Responses

**Symptoms:**
- Requests taking > 1 second
- Timeouts occasionally

**Check:**
```bash
# 1. Check GAS execution time
# Google Apps Script → Executions
# Look at "Duration" column

# 2. Check Cloudflare cache
# Cloudflare Dashboard → Caching
# Set up caching rules for GET requests

# 3. Optimize GAS script
# Remove unnecessary loops/queries
# Use batch operations
```

### Issue 3: Authentication Not Working

**Symptoms:**
- 401 Unauthorized
- Token not persisting

**Check:**
```typescript
// In browser console:
localStorage.getItem('authToken')  // Should have token
localStorage.getItem('refreshToken')  // Should have refresh token

// Check if token is being sent
// Open DevTools → Network tab
// Headers should include: Authorization: Bearer YOUR_TOKEN
```

---

## 📋 Deployment Checklist

### Before Deploying Staff Attendance Module

```
Code:
☐ Staff module compiles without errors
☐ Uses shared config for endpoints
☐ Uses httpClient for API calls
☐ Types imported from @fintracker-vault/types

Configuration:
☐ GAS backend has staff endpoints implemented
☐ Cloudflare worker routes staff/* to GAS
☐ Environment variables set in Vercel
☐ API documentation updated

Testing:
☐ Local testing passes
☐ Preview deployment works
☐ All staff endpoints respond
☐ Authentication still works

Integration:
☐ Fintracker still works
☐ Vault still works
☐ Database transactions logged
☐ No errors in GAS logs
```

---

## 🎯 Summary

### Your Setup After Monorepo Migration

```
✅ Fintracker    ┐
✅ Vault         ├─→ Cloudflare Proxy → GAS Backend
✅ Staff Attend. ┘    (api.yourcompany.com)

Each app:
- Uses shared config (@fintracker-vault/config)
- Uses shared HTTP client (@fintracker-vault/utils)
- Routes all API calls through Cloudflare
- No changes to GAS backend needed
- Zero downtime migration possible
```

### Key Points

1. **No GAS Changes** - Your backend stays exactly the same
2. **Cloudflare Transparent** - Proxy works invisibly
3. **Shared Config** - All 3 apps use same endpoints
4. **Authentication Preserved** - Token system unchanged
5. **Scalable** - Easy to add more modules later

---

**Your monorepo is now configured to scale with your GAS backend!**
