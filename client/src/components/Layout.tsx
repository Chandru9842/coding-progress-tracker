import React, { useState, useEffect } from 'react';
import { Sidebar } from './Sidebar.js';
import { Topbar } from './Topbar.js';

interface LayoutProps {
  title: string;
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ title, children }) => {
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  return (
    <div className="app-container">
      <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
      <div className="main-content">
        <Topbar title={title} onToggleMobileMenu={() => setMobileOpen((prev) => !prev)} />
        <main className="page-wrapper">
          {children}
        </main>
      </div>
    </div>
  );
};
