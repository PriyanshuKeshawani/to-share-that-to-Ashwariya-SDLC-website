"use client";

import Link from 'next/link';
import { Shield, ArrowLeft, BookOpen, Lock, CheckCircle2 } from 'lucide-react';

export default function PrivacyPolicy() {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#090d16',
      color: '#f8fafc',
      fontFamily: "'Outfit', -apple-system, BlinkMacSystemFont, sans-serif",
      padding: '40px 20px'
    }}>
      <div style={{
        maxWidth: '800px',
        margin: '0 auto',
        background: 'rgba(30, 41, 59, 0.7)',
        backdropFilter: 'blur(16px)',
        borderRadius: '24px',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        padding: '40px'
      }}>
        <div style={{ marginBottom: '24px' }}>
          <Link
            href="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              color: '#818cf8',
              textDecoration: 'none',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            <ArrowLeft size={16} /> Back to Library Portal
          </Link>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            background: 'rgba(99, 102, 241, 0.15)',
            border: '1px solid rgba(99, 102, 241, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#818cf8'
          }}>
            <Shield size={24} />
          </div>
          <div>
            <h1 style={{ fontSize: '26px', fontWeight: '700', margin: 0, color: '#ffffff' }}>
              Privacy Policy
            </h1>
            <p style={{ color: '#94a3b8', fontSize: '14px', margin: '4px 0 0 0' }}>
              SISTec Digital Library Club • Last updated: October 2026
            </p>
          </div>
        </div>

        <div style={{ lineHeight: '1.7', color: '#cbd5e1', fontSize: '15px' }}>
          <section style={{ marginBottom: '24px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '600', color: '#ffffff', marginBottom: '8px' }}>
              1. Overview
            </h2>
            <p>
              SISTec Digital Library Club (&quot;we&quot;, &quot;our&quot;, or &quot;the Portal&quot;) is an institutional digital library platform designed exclusively for students, faculty, and academic staff of Sagar Institute of Science and Technology (SISTec). We are committed to protecting your personal information and your right to privacy.
            </p>
          </section>

          <section style={{ marginBottom: '24px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '600', color: '#ffffff', marginBottom: '8px' }}>
              2. Information We Collect
            </h2>
            <p>
              When you authenticate using Google Sign-In, we request access solely to your basic profile information:
            </p>
            <ul style={{ paddingLeft: '20px', marginTop: '8px' }}>
              <li><strong>Name and Email Address:</strong> Used strictly to verify your student/institutional identity and create your library account.</li>
              <li><strong>Profile Picture (Avatar):</strong> Used solely to display your user profile within the portal interface.</li>
              <li><strong>Library Academic Data:</strong> Department branch, academic year, semester, roll number, and reading progress records generated during your reading sessions.</li>
            </ul>
          </section>

          <section style={{ marginBottom: '24px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '600', color: '#ffffff', marginBottom: '8px' }}>
              3. How We Use Your Information
            </h2>
            <p>
              We use your information exclusively for academic and library management purposes:
            </p>
            <ul style={{ paddingLeft: '20px', marginTop: '8px' }}>
              <li>Authenticating student access to institutional curriculum textbooks and reference materials.</li>
              <li>Preserving personal bookmarks, reading positions, and academic notes across devices.</li>
              <li>Managing physical and digital book issue requests and renewals with the central college library.</li>
              <li>We <strong>do not sell, rent, or trade</strong> your personal information or Google user data with any third-party advertisers or external entities.</li>
            </ul>
          </section>

          <section style={{ marginBottom: '24px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '600', color: '#ffffff', marginBottom: '8px' }}>
              4. Google User Data Compliance
            </h2>
            <p>
              Our use and transfer to any other app of information received from Google APIs will adhere to the{' '}
              <a
                href="https://developers.google.com/terms/api-services-user-data-policy"
                target="_blank"
                rel="noreferrer"
                style={{ color: '#818cf8', textDecoration: 'underline' }}
              >
                Google API Services User Data Policy
              </a>
              , including the Limited Use requirements. We do not use Google user data to develop, train, or improve generalized AI/ML models.
            </p>
          </section>

          <section style={{ marginBottom: '24px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '600', color: '#ffffff', marginBottom: '8px' }}>
              5. Data Security & Storage
            </h2>
            <p>
              All communication between your device and the portal is encrypted via HTTPS / TLS. User records and authentication tokens are securely managed using industry-standard encrypted PostgreSQL databases with strict Row-Level Security (RLS).
            </p>
          </section>

          <section style={{ marginBottom: '24px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '600', color: '#ffffff', marginBottom: '8px' }}>
              6. Contact Us
            </h2>
            <p>
              If you have any questions or concerns regarding this Privacy Policy or your data, you may reach out to the Central Library Administration at{' '}
              <span style={{ color: '#818cf8' }}>sistec.library@sistec.ac.in</span> or through our developer contact at{' '}
              <span style={{ color: '#818cf8' }}>priyanshukeshrwani70@gmail.com</span>.
            </p>
          </section>
        </div>

        <div style={{
          marginTop: '32px',
          paddingTop: '20px',
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          color: '#64748b',
          fontSize: '13px'
        }}>
          <span>© 2026 Sagar Institute of Science and Technology (SISTec)</span>
          <span>Digital Library System</span>
        </div>
      </div>
    </div>
  );
}
