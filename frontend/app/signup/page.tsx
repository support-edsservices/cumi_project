'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Zap, Lock, Phone, User, Mail, Shield, Eye, EyeOff, AlertCircle, Clock, Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { API_ENDPOINTS, BASE_URL, ROLE_LABELS, ROUTES } from '@/data/ENUM';

export default function SignUpPage() {
  const router = useRouter();
  const { signup } = useAuth();

  const [phoneNumber, setPhoneNumber] = useState('');
  const [userName, setUserName] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('user');
  const [availableRoles, setAvailableRoles] = useState<string[]>(['user', 'manager']);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [waitingListResult, setWaitingListResult] = useState<{ userName: string; role: string; phone: string } | null>(null);

  // Fetch assignable roles on mount to ensure 'admin' and 'superadmin' are only shown if not taken
  useEffect(() => {
    async function loadRoles() {
      try {
        const res = await fetch(`${BASE_URL}${API_ENDPOINTS.AVAILABLE_ROLES}`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.available_roles) && data.available_roles.length > 0) {
            setAvailableRoles(data.available_roles);
            if (data.available_roles.includes('user')) {
              setRole('user');
            } else {
              setRole(data.available_roles[0]);
            }
          }
        }
      } catch (e) {
        console.warn('Could not fetch dynamic roles, using default user/manager:', e);
      }
    }
    loadRoles();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanPhone = phoneNumber.trim();
    const cleanName = userName.trim();

    if (!cleanPhone) {
      setError('Phone number is required.');
      return;
    }
    if (cleanPhone.includes('@')) {
      setError('Please enter a valid phone number (digits only), not an email address.');
      return;
    }
    if (!cleanName) {
      setError('User name is required.');
      return;
    }
    if (!password || password.length < 6) {
      setError('Password is required and must be at least 6 characters.');
      return;
    }

    try {
      setIsSubmitting(true);
      const result = await signup(cleanPhone, password, cleanName, email.trim() || undefined, role);

      // If placed on waiting list (user / manager), show waiting screen
      if (!result.is_granted) {
        setWaitingListResult({
          userName: cleanName,
          role,
          phone: cleanPhone,
        });
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to create account. Please check your information.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Waiting List State View
  // ─────────────────────────────────────────────────────────────────────────
  if (waitingListResult) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'radial-gradient(ellipse at top, #1e293b 0%, var(--bg-primary) 70%)',
        padding: '1.5rem',
      }}>
        <div style={{
          width: '100%',
          maxWidth: 460,
          background: 'var(--bg-card)',
          borderRadius: 14,
          border: '1px solid var(--border)',
          boxShadow: 'var(--card-shadow)',
          padding: '2.5rem 2rem',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '1.25rem',
        }}>
          <div style={{
            width: 58,
            height: 58,
            borderRadius: '50%',
            background: '#f59e0b18',
            border: '2px solid #f59e0b40',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Clock size={28} color="#f59e0b" />
          </div>

          <div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              Registration Received!
            </h2>
            <div style={{
              display: 'inline-block',
              margin: '0.5rem 0',
              padding: '0.25rem 0.75rem',
              borderRadius: 20,
              background: '#f59e0b20',
              color: '#f59e0b',
              fontSize: '0.78rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}>
              Waiting List · Approval Pending
            </div>
            <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginTop: '0.5rem' }}>
              Welcome, <b>{waitingListResult.userName}</b>! Your account has been created with role{' '}
              <b style={{ color: 'var(--accent-blue)' }}>{ROLE_LABELS[waitingListResult.role] || waitingListResult.role}</b>.
            </p>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.625rem', lineHeight: 1.4 }}>
              An Administrator or Superadmin must review and grant access to your account before you can log in to the dashboard.
            </p>
          </div>

          <button
            onClick={() => router.push(ROUTES.LOGIN)}
            style={{
              width: '100%',
              padding: '0.75rem',
              borderRadius: 8,
              background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
              color: '#ffffff',
              fontWeight: 700,
              fontSize: '0.92rem',
              border: 'none',
              cursor: 'pointer',
              marginTop: '0.5rem',
              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.35)',
            }}
          >
            Go to Sign In
          </button>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Registration Form View
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'radial-gradient(ellipse at top, #1e293b 0%, var(--bg-primary) 70%)',
      padding: '1.5rem',
    }}>
      <div style={{
        width: '100%',
        maxWidth: 440,
        background: 'var(--bg-card)',
        borderRadius: 14,
        border: '1px solid var(--border)',
        boxShadow: 'var(--card-shadow)',
        padding: '2.25rem 2rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.25rem',
      }}>
        {/* Header with brand logo */}
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)',
            marginBottom: '0.875rem',
          }}>
            <Zap size={24} color="#fff" fill="#fff" />
          </div>
          <h1 style={{
            fontSize: '1.45rem',
            fontWeight: 800,
            color: 'var(--text-primary)',
            letterSpacing: '-0.02em',
          }}>
            Create Your Account
          </h1>
          <p style={{
            fontSize: '0.85rem',
            color: 'var(--text-muted)',
            marginTop: '0.25rem',
          }}>
            CUMI Energy Intelligence Portal Registration
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.625rem',
            padding: '0.75rem 0.875rem',
            borderRadius: 8,
            background: '#ef444415',
            border: '1px solid #ef444435',
            color: '#ef4444',
            fontSize: '0.82rem',
            lineHeight: 1.4,
          }}>
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {/* Signup Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
          {/* User Name (Mandatory) */}
          <div>
            <label style={{
              display: 'block',
              fontSize: '0.82rem',
              fontWeight: 600,
              color: 'var(--text-secondary)',
              marginBottom: '0.35rem',
            }}>
              Full Name <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <div className="auth-field-wrapper">
              <User size={15} color="var(--text-muted)" style={{ marginRight: '0.625rem', flexShrink: 0 }} />
              <input
                type="text"
                className="auth-text-input"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder="e.g. John Doe"
                autoComplete="name"
                required
              />
            </div>
          </div>

          {/* Phone Number (Mandatory) */}
          <div>
            <label style={{
              display: 'block',
              fontSize: '0.82rem',
              fontWeight: 600,
              color: 'var(--text-secondary)',
              marginBottom: '0.35rem',
            }}>
              Phone Number <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <div className="auth-field-wrapper">
              <Phone size={15} color="var(--text-muted)" style={{ marginRight: '0.625rem', flexShrink: 0 }} />
              <input
                type="tel"
                className="auth-text-input"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="e.g. 9876543210"
                autoComplete="tel"
                required
              />
            </div>
          </div>

          {/* Role Selection (Mandatory, dynamically filtered) */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
              <label style={{
                fontSize: '0.82rem',
                fontWeight: 600,
                color: 'var(--text-secondary)',
              }}>
                Role <span style={{ color: '#ef4444' }}>*</span>
              </label>
              {(role === 'admin' || role === 'superadmin') ? (
                <span style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: 700 }}>
                  Instant Access
                </span>
              ) : (
                <span style={{ fontSize: '0.72rem', color: '#f59e0b', fontWeight: 600 }}>
                  Requires Approval
                </span>
              )}
            </div>
            <div className="auth-field-wrapper">
              <Shield size={15} color="var(--text-muted)" style={{ marginRight: '0.625rem', flexShrink: 0 }} />
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.6rem 0',
                  background: 'transparent',
                  backgroundColor: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: 'var(--text-primary)',
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                {availableRoles.map((r) => (
                  <option key={r} value={r} style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>
                    {ROLE_LABELS[r] || r.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Email (Optional) */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
              <label style={{
                fontSize: '0.82rem',
                fontWeight: 600,
                color: 'var(--text-secondary)',
              }}>
                Email Address
              </label>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Optional</span>
            </div>
            <div className="auth-field-wrapper">
              <Mail size={15} color="var(--text-muted)" style={{ marginRight: '0.625rem', flexShrink: 0 }} />
              <input
                type="email"
                className="auth-text-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. operator@cumi.com"
                autoComplete="email"
              />
            </div>
          </div>

          {/* Password (Mandatory) */}
          <div>
            <label style={{
              display: 'block',
              fontSize: '0.82rem',
              fontWeight: 600,
              color: 'var(--text-secondary)',
              marginBottom: '0.35rem',
            }}>
              Password <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <div className="auth-field-wrapper">
              <Lock size={15} color="var(--text-muted)" style={{ marginRight: '0.625rem', flexShrink: 0 }} />
              <input
                type={showPassword ? 'text' : 'password'}
                className="auth-text-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 6 characters"
                autoComplete="new-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                }}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              marginTop: '0.5rem',
              width: '100%',
              padding: '0.75rem',
              borderRadius: 8,
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: '#ffffff',
              fontWeight: 700,
              fontSize: '0.92rem',
              border: 'none',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.35)',
              opacity: isSubmitting ? 0.75 : 1,
              transition: 'opacity 0.15s ease',
            }}
          >
            {isSubmitting ? (
              <>
                <Loader2 size={17} className="animate-spin" />
                <span>Registering Account...</span>
              </>
            ) : (
              <span>Create Account</span>
            )}
          </button>
        </form>

        {/* Footer Link */}
        <div style={{
          textAlign: 'center',
          fontSize: '0.82rem',
          color: 'var(--text-muted)',
          borderTop: '1px solid var(--border)',
          paddingTop: '0.875rem',
        }}>
          Already have an account?{' '}
          <Link
            href={ROUTES.LOGIN}
            style={{
              color: 'var(--accent-blue)',
              fontWeight: 700,
              textDecoration: 'none',
            }}
          >
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
