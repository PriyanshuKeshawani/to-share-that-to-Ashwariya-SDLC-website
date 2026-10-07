import './globals.css';
import Providers from './providers';

export const metadata = {
  title: 'SISTec Digital Library Club',
  description: 'Digital Library Management System for Sagar Institute of Science & Technology',
  verification: {
    google: 'qEWmgeCbepIExb-_VQMdjXHIQlMst_jbk0YnM370b94',
  },
  icons: {
    icon: [
      { url: '/favicon.svg?v=3', type: 'image/svg+xml' },
      { url: '/favicon.png?v=3', type: 'image/png', sizes: '512x512' },
      { url: '/favicon.ico?v=3', sizes: 'any' }
    ],
    shortcut: '/favicon.ico?v=3',
    apple: [
      { url: '/apple-touch-icon.png?v=3', sizes: '180x180', type: 'image/png' }
    ],
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-theme="dark" style={{ colorScheme: 'dark' }} suppressHydrationWarning>
      <head>
        <meta name="google-site-verification" content="qEWmgeCbepIExb-_VQMdjXHIQlMst_jbk0YnM370b94" />
        <link rel="icon" href="/favicon.svg?v=3" type="image/svg+xml" />
        <link rel="icon" href="/favicon.png?v=3" type="image/png" sizes="512x512" />
        <link rel="icon" href="/favicon.ico?v=3" sizes="any" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png?v=3" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var m=localStorage.getItem('theme-mode')||'dark';document.documentElement.setAttribute('data-theme',m);document.documentElement.style.colorScheme=m;}catch(e){}})();`,
          }}
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body suppressHydrationWarning>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
