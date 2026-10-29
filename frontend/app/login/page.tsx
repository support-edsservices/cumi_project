'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Zap, Lock, Phone, Mail, Eye, EyeOff, AlertCircle, Clock, Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { ROUTES } from '@/data/ENUM';

export default function LoginPage() {
  const { login } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isWaitingList, setIsWaitingList] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsWaitingList(false);

    const cleanIdentifier = identifier.trim();
    if (!cleanIdentifier) {
      setError('Please enter your phone number or email.');
      return;
    }
    if (!password) {
      setError('Please enter your password.');
      return;
    }

    try {
      setIsSubmitting(true);
      await login(cleanIdentifier, password);
    } catch (err: unknown) {
      if (err instanceof Error) {
        const msg = err.message;
        if (msg.toLowerCase().includes('waiting list') || msg.toLowerCase().includes('not granted')) {
          setIsWaitingList(true);
          setError(msg);
        } else {
          setError(msg);
        }
      } else {
        setError('Login failed. Please verify your credentials.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const isEmailInput = identifier.includes('@');

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
        maxWidth: 420,
        background: 'var(--bg-card)',
        borderRadius: 14,
        border: '1px solid var(--border)',
        boxShadow: 'var(--card-shadow)',
        padding: '2.25rem 2rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem',
      }}>
        {/* Header with brand logo */}
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            background: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 14px rgba(245, 158, 11, 0.45)',
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
            Welcome to EnergyMeter
          </h1>
          <p style={{
            fontSize: '0.85rem',
            color: 'var(--text-muted)',
            marginTop: '0.25rem',
          }}>
            CUMI Enterprise Energy Intelligence Portal
          </p>
        </div>

        {/* Waiting List Notice or Error Alert */}
        {error && (
          isWaitingList ? (
            <div style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.625rem',
              padding: '0.875rem',
              borderRadius: 8,
              background: '#f59e0b15',
              border: '1px solid #f59e0b40',
              color: '#d97706',
              fontSize: '0.82rem',
              lineHeight: 1.4,
            }}>
              <Clock size={18} style={{ flexShrink: 0, marginTop: 1 }} color="#f59e0b" />
              <div>
                <strong style={{ display: 'block', color: '#b45309', marginBottom: 2 }}>Approval Pending</strong>
                {error}
              </div>
            </div>
          ) : (
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
          )
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.125rem' }}>
          {/* Phone Number or Email */}
          <div>
            <label style={{
              display: 'block',
              fontSize: '0.82rem',
              fontWeight: 600,
              color: 'var(--text-secondary)',
              marginBottom: '0.375rem',
            }}>
              Phone Number or Email <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <div className="auth-field-wrapper">
              {isEmailInput ? (
                <Mail size={15} color="var(--text-muted)" style={{ marginRight: '0.625rem', flexShrink: 0 }} />
              ) : (
                <Phone size={15} color="var(--text-muted)" style={{ marginRight: '0.625rem', flexShrink: 0 }} />
              )}
              <input
                type="text"
                className="auth-text-input"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="e.g. 9876543210 or user@cumi.com"
                autoComplete="username"
                required
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.375rem' }}>
              <label style={{
                fontSize: '0.82rem',
                fontWeight: 600,
                color: 'var(--text-secondary)',
              }}>
                Password <span style={{ color: '#ef4444' }}>*</span>
              </label>
            </div>
            <div className="auth-field-wrapper">
              <Lock size={15} color="var(--text-muted)" style={{ marginRight: '0.625rem', flexShrink: 0 }} />
              <input
                type={showPassword ? 'text' : 'password'}
                className="auth-text-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                autoComplete="current-password"
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
              background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
              color: '#ffffff',
              fontWeight: 700,
              fontSize: '0.92rem',
              border: 'none',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.35)',
              opacity: isSubmitting ? 0.75 : 1,
              transition: 'opacity 0.15s ease',
            }}
          >
            {isSubmitting ? (
              <>
                <Loader2 size={17} className="animate-spin" />
                <span>Authenticating...</span>
              </>
            ) : (
              <span>Sign In to Dashboard</span>
            )}
          </button>
        </form>

        {/* Footer Link */}
        <div style={{
          textAlign: 'center',
          fontSize: '0.82rem',
          color: 'var(--text-muted)',
          borderTop: '1px solid var(--border)',
          paddingTop: '1rem',
        }}>
          Don't have an account?{' '}
          <Link
            href={ROUTES.SIGNUP}
            style={{
              color: 'var(--accent-blue)',
              fontWeight: 700,
              textDecoration: 'none',
            }}
          >
            Create Account
          </Link>
        </div>
      </div>
    </div>
  );
}
