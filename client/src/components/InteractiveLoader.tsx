import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Sparkles, Zap, Bug, Lightbulb, RefreshCw, CheckCircle2, Code2, Terminal } from 'lucide-react';

export interface InteractiveLoaderProps {
  mode?: 'fullscreen' | 'inline' | 'compact';
  title?: string;
  subtitle?: string;
  progressPercentage?: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  text?: string;
  color: string;
  alpha: number;
  targetAlpha: number;
}

interface Shockwave {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  alpha: number;
  color: string;
}

interface InteractiveBugItem {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  emoji: string;
  squashed: boolean;
  scoreText?: string;
}

const CODING_TIPS = [
  {
    category: 'LeetCode Pattern',
    tip: 'Two Pointers technique turns O(N²) pair searching into O(N) linear time for sorted arrays.',
  },
  {
    category: 'DSA Strategy',
    tip: 'Sliding Window is best when finding min/max sub-array lengths with a continuous sum or character constraint.',
  },
  {
    category: 'Algorithmic Invariant',
    tip: 'Binary Search works on ANY monotonic condition (True/False boundary), not just sorted lists.',
  },
  {
    category: 'Graph Secrets',
    tip: 'BFS always guarantees the shortest path in unweighted graphs; DFS is ideal for topological sort & backtracking.',
  },
  {
    category: 'Performance Hack',
    tip: 'Prefix Sum precomputation reduces any subarray range-sum query to instantaneous O(1) lookups.',
  },
  {
    category: 'Bit Manipulation',
    tip: 'The formula `n & (n - 1)` clears the lowest set bit in O(1) time without looping.',
  },
  {
    category: 'Dynamic Programming',
    tip: 'Break problem into state variables. If subproblems repeat, memoize or tabulate to drop exponential complexity to polynomial.',
  },
  {
    category: 'Fast & Slow Pointers',
    tip: "Floyd's Tortoise and Hare detects linked list cycles in O(N) time with O(1) auxiliary memory.",
  },
  {
    category: 'Monotonic Stack',
    tip: 'Keep elements in monotonic order to solve "Next Greater Element" and "Daily Temperatures" in single-pass O(N).',
  },
  {
    category: 'Engineering Trivia',
    tip: 'The first computer bug was an actual moth found stuck in relay #70 of the Harvard Mark II computer in 1947.',
  },
  {
    category: 'JavaScript Ninja',
    tip: 'JavaScript Sets and Maps provide O(1) average lookup and do not collide with Object prototype properties.',
  },
  {
    category: 'Tree Traversals',
    tip: 'In-order traversal of a Binary Search Tree (BST) always yields elements in strictly ascending sorted order.',
  },
];

const CODE_TOKENS = ['{ }', '</>', 'fn()', 'const', '01', 'git', '=>', 'LC', 'async', 'return'];

export const InteractiveLoader: React.FC<InteractiveLoaderProps> = ({
  mode = 'inline',
  title = 'Loading Workspace...',
  subtitle = 'Interactive Matrix • Move cursor to ripple or click to squash bugs!',
  progressPercentage,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Tips state
  const [tipIndex, setTipIndex] = useState(0);
  const [tipFade, setTipFade] = useState(true);

  // Score & mini-game state
  const [bugsSquashed, setBugsSquashed] = useState(0);
  const [xp, setXp] = useState(0);
  const [scoreAlert, setScoreAlert] = useState<string | null>(null);

  // Progress bar simulation
  const [simulatedProgress, setSimulatedProgress] = useState(15);
  const [turboActive, setTurboActive] = useState(false);

  // Interactive bugs
  const [bugs, setBugs] = useState<InteractiveBugItem[]>([
    { id: 1, x: 20, y: 35, vx: 0.8, vy: 0.5, emoji: '👾', squashed: false },
    { id: 2, x: 70, y: 65, vx: -0.6, vy: 0.7, emoji: '🐞', squashed: false },
    { id: 3, x: 50, y: 25, vx: 0.5, vy: -0.6, emoji: '🐛', squashed: false },
  ]);

  // Telemetry status logs
  const [currentStep, setCurrentStep] = useState(0);
  const telemetrySteps = [
    'Initializing tracker engine...',
    'Connecting platform telemetry nodes...',
    'Verifying authorization matrix...',
    'Hydrating real-time student cache...',
    'Readying workspace presentation...',
  ];

  // Auto-rotate tips
  useEffect(() => {
    const tipTimer = setInterval(() => {
      setTipFade(false);
      setTimeout(() => {
        setTipIndex((prev) => (prev + 1) % CODING_TIPS.length);
        setTipFade(true);
      }, 200);
    }, 7000);

    return () => clearInterval(tipTimer);
  }, []);

  // Telemetry progress simulation
  useEffect(() => {
    const progressTimer = setInterval(() => {
      setSimulatedProgress((prev) => {
        if (prev < 90) {
          const next = prev + (turboActive ? 6 : Math.floor(Math.random() * 4) + 1);
          return Math.min(next, 94);
        }
        return prev;
      });
      setCurrentStep((prev) => (prev < telemetrySteps.length - 1 ? prev + 1 : prev));
    }, 1200);

    return () => clearInterval(progressTimer);
  }, [turboActive]);

  // Cycle to next tip manually
  const handleNextTip = () => {
    setTipFade(false);
    setTimeout(() => {
      setTipIndex((prev) => (prev + 1) % CODING_TIPS.length);
      setTipFade(true);
    }, 150);
  };

  // Turbo boost click handler
  const handleTurboBoost = () => {
    setTurboActive(true);
    setSimulatedProgress((prev) => Math.min(prev + 12, 96));
    setXp((prev) => prev + 50);
    setScoreAlert('⚡ OVERCLOCK ACTIVATED! +50 XP');
    setTimeout(() => setScoreAlert(null), 2500);
    setTimeout(() => setTurboActive(false), 2000);

    // Spawn canvas shockwaves
    if (canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      shockwavesRef.current.push({
        x: centerX,
        y: centerY,
        radius: 10,
        maxRadius: 280,
        alpha: 1,
        color: '#ec4899',
      });
    }
  };

  // Squash bug handler
  const handleSquashBug = (bugId: number) => {
    setBugs((prev) =>
      prev.map((b) => {
        if (b.id === bugId && !b.squashed) {
          return { ...b, squashed: true, scoreText: '+100 XP!' };
        }
        return b;
      })
    );
    setBugsSquashed((prev) => prev + 1);
    setXp((prev) => prev + 100);
    setScoreAlert('🎯 BUG SQUASHED! +100 XP');
    setTimeout(() => setScoreAlert(null), 2000);

    // After 2.5s, revive or reposition the bug
    setTimeout(() => {
      setBugs((prev) =>
        prev.map((b) => {
          if (b.id === bugId) {
            return {
              ...b,
              squashed: false,
              x: Math.floor(Math.random() * 80) + 10,
              y: Math.floor(Math.random() * 70) + 15,
              scoreText: undefined,
            };
          }
          return b;
        })
      );
    }, 2500);
  };

  // Spawn additional bugs
  const handleSpawnBugs = () => {
    const emojis = ['👾', '🐞', '🐛', '🕷️', '🦗'];
    const newBug: InteractiveBugItem = {
      id: Date.now(),
      x: Math.floor(Math.random() * 80) + 10,
      y: Math.floor(Math.random() * 70) + 15,
      vx: (Math.random() - 0.5) * 1.5,
      vy: (Math.random() - 0.5) * 1.5,
      emoji: emojis[Math.floor(Math.random() * emojis.length)],
      squashed: false,
    };
    setBugs((prev) => [...prev.slice(-6), newBug]);
  };

  // Canvas particle state ref
  const shockwavesRef = useRef<Shockwave[]>([]);
  const mouseRef = useRef<{ x: number; y: number; active: boolean }>({ x: -100, y: -100, active: false });

  // HTML5 Interactive Canvas Animation Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    const colors = ['#6366f1', '#06b6d4', '#ec4899', '#3b82f6', '#10b981'];

    // Setup canvas dimension
    const handleResize = () => {
      if (!canvas || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    // Initialize particles
    const particleCount = mode === 'fullscreen' ? 45 : 30;
    const particles: Particle[] = [];

    const rect = containerRef.current ? containerRef.current.getBoundingClientRect() : { width: 600, height: 350 };
    for (let i = 0; i < particleCount; i++) {
      const hasText = i % 3 === 0;
      particles.push({
        x: Math.random() * (rect.width || 600),
        y: Math.random() * (rect.height || 350),
        vx: (Math.random() - 0.5) * 0.75,
        vy: (Math.random() - 0.5) * 0.75,
        radius: hasText ? 14 : Math.random() * 2.5 + 1.5,
        text: hasText ? CODE_TOKENS[i % CODE_TOKENS.length] : undefined,
        color: colors[i % colors.length],
        alpha: Math.random() * 0.5 + 0.3,
        targetAlpha: Math.random() * 0.5 + 0.3,
      });
    }

    // Canvas click creates interactive shockwave
    const handleCanvasClick = (e: MouseEvent) => {
      const bRect = canvas.getBoundingClientRect();
      const x = e.clientX - bRect.left;
      const y = e.clientY - bRect.top;
      shockwavesRef.current.push({
        x,
        y,
        radius: 5,
        maxRadius: 180,
        alpha: 0.9,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    };

    const handleMouseMove = (e: MouseEvent) => {
      const bRect = canvas.getBoundingClientRect();
      mouseRef.current = {
        x: e.clientX - bRect.left,
        y: e.clientY - bRect.top,
        active: true,
      };
    };

    const handleMouseLeave = () => {
      mouseRef.current.active = false;
    };

    canvas.addEventListener('click', handleCanvasClick);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseleave', handleMouseLeave);

    // Main 60fps render loop
    const render = () => {
      const width = canvas.width / (window.devicePixelRatio || 1);
      const height = canvas.height / (window.devicePixelRatio || 1);

      ctx.clearRect(0, 0, width, height);

      // Render shockwaves
      shockwavesRef.current.forEach((sw, sIndex) => {
        ctx.save();
        ctx.beginPath();
        ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
        ctx.strokeStyle = sw.color;
        ctx.lineWidth = 2.5;
        ctx.globalAlpha = sw.alpha;
        ctx.shadowColor = sw.color;
        ctx.shadowBlur = 12;
        ctx.stroke();
        ctx.restore();

        sw.radius += 4;
        sw.alpha *= 0.94;
        if (sw.alpha < 0.02 || sw.radius > sw.maxRadius) {
          shockwavesRef.current.splice(sIndex, 1);
        }
      });

      // Update and draw particles
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        // Apply mouse interaction (magnetic attraction & push)
        if (mouseRef.current.active) {
          const dx = mouseRef.current.x - p.x;
          const dy = mouseRef.current.y - p.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120 && dist > 1) {
            const force = (120 - dist) / 120;
            p.vx += (dx / dist) * force * 0.15;
            p.vy += (dy / dist) * force * 0.15;
          }
        }

        p.x += p.vx;
        p.y += p.vy;

        // Friction
        p.vx *= 0.985;
        p.vy *= 0.985;

        // Keep a minimum drift speed
        if (Math.abs(p.vx) < 0.15) p.vx += (Math.random() - 0.5) * 0.1;
        if (Math.abs(p.vy) < 0.15) p.vy += (Math.random() - 0.5) * 0.1;

        // Bounds bounce
        if (p.x < 10) { p.x = 10; p.vx *= -1; }
        if (p.x > width - 10) { p.x = width - 10; p.vx *= -1; }
        if (p.y < 10) { p.y = 10; p.vy *= -1; }
        if (p.y > height - 10) { p.y = height - 10; p.vy *= -1; }

        // Draw constellation lines
        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dist = Math.hypot(p.x - p2.x, p.y - p2.y);
          if (dist < 95) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = p.color;
            ctx.globalAlpha = (1 - dist / 95) * 0.25;
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }

        // Render particle
        ctx.save();
        if (p.text) {
          ctx.font = '600 11px Outfit, monospace';
          ctx.fillStyle = p.color;
          ctx.globalAlpha = p.alpha * 0.85;
          ctx.shadowColor = p.color;
          ctx.shadowBlur = 8;
          ctx.fillText(p.text, p.x - 12, p.y + 4);
        } else {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          ctx.globalAlpha = p.alpha;
          ctx.shadowColor = p.color;
          ctx.shadowBlur = 10;
          ctx.fill();
        }
        ctx.restore();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      canvas.removeEventListener('click', handleCanvasClick);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [mode]);

  const activeProgress = progressPercentage !== undefined ? progressPercentage : simulatedProgress;
  const currentTip = CODING_TIPS[tipIndex];

  const isFullscreen = mode === 'fullscreen';

  return (
    <div
      ref={containerRef}
      style={{
        position: isFullscreen ? 'fixed' : 'relative',
        inset: isFullscreen ? 0 : 'auto',
        zIndex: isFullscreen ? 9999 : 5,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        minHeight: isFullscreen ? '100vh' : '360px',
        backgroundColor: isFullscreen ? 'rgba(11, 19, 41, 0.94)' : 'transparent',
        backdropFilter: isFullscreen ? 'blur(16px)' : 'none',
        WebkitBackdropFilter: isFullscreen ? 'blur(16px)' : 'none',
        padding: isFullscreen ? '2rem' : '1rem 0',
      }}
    >
      <div
        className="interactive-loader-card"
        style={{
          width: '100%',
          maxWidth: isFullscreen ? '620px' : '580px',
          padding: '1.75rem',
          position: 'relative',
          zIndex: 10,
        }}
      >
        {/* Interactive Canvas Background Layer */}
        <canvas
          ref={canvasRef}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'auto',
            cursor: 'crosshair',
            zIndex: 1,
          }}
          title="Click to trigger energy shockwaves!"
        />

        {/* Floating Interactive Bugs (Mini-Game) */}
        {bugs.map((bug) => (
          <div
            key={bug.id}
            className="interactive-bug"
            onClick={() => handleSquashBug(bug.id)}
            style={{
              left: `${bug.x}%`,
              top: `${bug.y}%`,
              fontSize: '1.5rem',
              opacity: bug.squashed ? 0.35 : 0.95,
              transform: bug.squashed ? 'scale(0.7) rotate(45deg)' : 'scale(1)',
            }}
            title={bug.squashed ? 'Squashed!' : 'Click to squash this bug for +100 XP!'}
          >
            {bug.squashed ? '💥' : bug.emoji}
            {bug.scoreText && (
              <span
                style={{
                  position: 'absolute',
                  top: '-20px',
                  left: '-10px',
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  color: '#4ade80',
                  textShadow: '0 0 8px rgba(74, 222, 128, 0.8)',
                  whiteSpace: 'nowrap',
                  animation: 'popSparkle 1.2s forwards',
                }}
              >
                {bug.scoreText}
              </span>
            )}
          </div>
        ))}

        {/* Foreground Content Card (Interactive UI) */}
        <div style={{ position: 'relative', zIndex: 12, pointerEvents: 'auto' }}>
          {/* Header with Title and Live Badge */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.3), rgba(6, 182, 212, 0.3))',
                  border: '1px solid rgba(99, 102, 241, 0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 0 15px rgba(99, 102, 241, 0.4)',
                }}
              >
                <Code2 size={20} style={{ color: '#818cf8', animation: 'cyberFloat 3s infinite ease-in-out' }} />
              </div>
              <div>
                <h3
                  style={{
                    fontSize: '1.1rem',
                    fontWeight: 700,
                    fontFamily: 'var(--font-display)',
                    color: '#f8fafc',
                    letterSpacing: '-0.01em',
                    lineHeight: 1.2,
                  }}
                >
                  {title}
                </h3>
                <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '2px' }}>
                  {subtitle}
                </p>
              </div>
            </div>

            {/* Score / Bug Counter Badge */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.3rem 0.65rem',
                borderRadius: '9999px',
                background: 'rgba(236, 72, 153, 0.15)',
                border: '1px solid rgba(236, 72, 153, 0.35)',
                color: '#f472b6',
                fontSize: '0.72rem',
                fontWeight: 700,
                boxShadow: '0 0 10px rgba(236, 72, 153, 0.25)',
              }}
            >
              <Bug size={13} />
              <span>Squashed: {bugsSquashed}</span>
              <span style={{ color: '#cbd5e1', opacity: 0.5 }}>|</span>
              <Zap size={13} style={{ color: '#facc15' }} />
              <span>{xp} XP</span>
            </div>
          </div>

          {/* Glowing Shimmer Loading Progress Bar */}
          <div style={{ margin: '1rem 0 0.5rem 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Terminal size={13} />
                {telemetrySteps[currentStep] || 'Optimizing workspace views...'}
              </span>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#818cf8', fontFamily: 'monospace' }}>
                {Math.round(activeProgress)}%
              </span>
            </div>
            <div
              style={{
                width: '100%',
                height: '8px',
                backgroundColor: 'rgba(30, 41, 59, 0.8)',
                borderRadius: '9999px',
                overflow: 'hidden',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                position: 'relative',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${activeProgress}%`,
                  borderRadius: '9999px',
                  background: 'linear-gradient(90deg, #6366f1 0%, #06b6d4 50%, #ec4899 100%)',
                  boxShadow: '0 0 16px rgba(99, 102, 241, 0.7)',
                  transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                  position: 'relative',
                }}
              />
            </div>
          </div>

          {/* Score Alert Pop Notification */}
          {scoreAlert && (
            <div
              style={{
                textAlign: 'center',
                fontSize: '0.75rem',
                fontWeight: 700,
                color: '#34d399',
                padding: '0.2rem',
                letterSpacing: '0.04em',
                animation: 'tipFadeIn 0.25s ease-out',
              }}
            >
              {scoreAlert}
            </div>
          )}

          {/* Interactive Developer Tip Card */}
          <div
            style={{
              marginTop: '1rem',
              padding: '0.85rem 1rem',
              borderRadius: '12px',
              backgroundColor: 'rgba(30, 41, 59, 0.6)',
              border: '1px solid rgba(255, 255, 255, 0.07)',
              position: 'relative',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Lightbulb size={14} style={{ color: '#fbbf24' }} />
                <span
                  style={{
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    color: '#fbbf24',
                  }}
                >
                  {currentTip.category}
                </span>
              </div>
              <button
                type="button"
                onClick={handleNextTip}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  fontSize: '0.7rem',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  transition: 'color 0.2s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#f8fafc')}
                onMouseLeave={(e) => (e.currentTarget.style.color = '#94a3b8')}
                title="Shuffle to another algorithmic trick"
              >
                <RefreshCw size={11} />
                <span>Next Tip</span>
              </button>
            </div>
            <p
              className={tipFade ? 'tip-container-animated' : ''}
              style={{
                fontSize: '0.82rem',
                lineHeight: 1.45,
                color: '#e2e8f0',
                fontWeight: 400,
              }}
            >
              {currentTip.tip}
            </p>
          </div>

          {/* Interactive Mini-Actions Toolbar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: '1rem',
              paddingTop: '0.75rem',
              borderTop: '1px solid rgba(255, 255, 255, 0.07)',
            }}
          >
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={handleTurboBoost}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.4rem 0.75rem',
                  borderRadius: '8px',
                  backgroundColor: turboActive ? 'rgba(236, 72, 153, 0.35)' : 'rgba(99, 102, 241, 0.2)',
                  border: '1px solid rgba(99, 102, 241, 0.4)',
                  color: '#c7d2fe',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: turboActive ? '0 0 15px rgba(236, 72, 153, 0.5)' : 'none',
                }}
              >
                <Zap size={13} style={{ color: '#facc15' }} />
                <span>{turboActive ? 'Overclocking!' : '⚡ Turbo Boost'}</span>
              </button>

              <button
                type="button"
                onClick={handleSpawnBugs}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.4rem 0.75rem',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(6, 182, 212, 0.15)',
                  border: '1px solid rgba(6, 182, 212, 0.35)',
                  color: '#67e8f9',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                title="Spawn more interactive bugs on screen"
              >
                <Bug size={13} />
                <span>+ Spawn Bugs</span>
              </button>
            </div>

            <span
              style={{
                fontSize: '0.7rem',
                color: '#64748b',
                fontStyle: 'italic',
                userSelect: 'none',
              }}
            >
              💡 Click canvas to ripple
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
