import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal, Activity, Wifi, Shield, Cpu, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';

export interface InteractiveLoaderProps {
  mode?: 'fullscreen' | 'inline';
  title?: string;
  subtitle?: string;
  progressPercentage?: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  baseRadius: number;
  alpha: number;
}

interface PulseWave {
  x: number;
  y: number;
  r: number;
  maxR: number;
  alpha: number;
  color: string;
}

const TELEMETRY_LOGS = [
  { time: '0.01s', tag: 'BOOT', text: 'Initializing platform runtime kernel...' },
  { time: '0.04s', tag: 'NET',  text: 'Establishing secure TLS 1.3 socket link...' },
  { time: '0.09s', tag: 'AUTH', text: 'Verifying session JWT token signature [SHA-256]...' },
  { time: '0.14s', tag: 'DB',   text: 'Connecting to transactional persistence cluster...' },
  { time: '0.21s', tag: 'SYNC', text: 'Fetching LeetCode diagnostic stream nodes...' },
  { time: '0.28s', tag: 'MEM',  text: 'Hydrating normalized student state cache...' },
  { time: '0.35s', tag: 'UI',   text: 'Rendering GPU-accelerated viewports...' },
];

export const InteractiveLoader: React.FC<InteractiveLoaderProps> = ({
  mode = 'inline',
  title = 'INITIALIZING SYSTEM MATRIX',
  subtitle = 'Telemetry stream active • Cursor-reactive magnetic field',
  progressPercentage,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [simulatedProgress, setSimulatedProgress] = useState(24);
  const [pingCount, setPingCount] = useState(0);
  const [lastLatency, setLastLatency] = useState<number | null>(null);
  const [isPinging, setIsPinging] = useState(false);
  const [logIndex, setLogIndex] = useState(2);
  const [showTelemetryHUD, setShowTelemetryHUD] = useState(true);

  const mousePos = useRef<{ x: number; y: number; active: boolean }>({ x: -200, y: -200, active: false });
  const pulseWaves = useRef<PulseWave[]>([]);

  // Simulated telemetry progress and status progression
  useEffect(() => {
    const interval = setInterval(() => {
      setSimulatedProgress((prev) => {
        if (prev < 94) {
          const delta = Math.floor(Math.random() * 5) + 2;
          return Math.min(prev + delta, 95);
        }
        return prev;
      });

      setLogIndex((prev) => (prev < TELEMETRY_LOGS.length - 1 ? prev + 1 : prev));
    }, 700);

    return () => clearInterval(interval);
  }, []);

  // Ping node action
  const handlePingNode = useCallback(() => {
    setIsPinging(true);
    const latency = Math.floor(Math.random() * 12) + 9; // 9ms - 20ms
    setLastLatency(latency);
    setPingCount((c) => c + 1);

    // Create a laser pulse on the canvas
    if (canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      pulseWaves.current.push({
        x: rect.width / 2,
        y: rect.height / 2,
        r: 10,
        maxR: 240,
        alpha: 1,
        color: '#06b6d4',
      });
    }

    setTimeout(() => {
      setIsPinging(false);
    }, 600);
  }, []);

  // 60fps Canvas render loop for magnetic dust and laser waves
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const resizeCanvas = () => {
      if (!canvas || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Generate precision grid & micro dust particles
    const particleCount = mode === 'fullscreen' ? 40 : 25;
    const particles: Particle[] = [];
    const rect = containerRef.current?.getBoundingClientRect() || { width: 600, height: 360 };

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * rect.width,
        y: Math.random() * rect.height,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        baseRadius: Math.random() * 1.5 + 0.8,
        alpha: Math.random() * 0.4 + 0.15,
      });
    }

    // Cursor tracking
    const handleMouseMove = (e: MouseEvent) => {
      const bRect = canvas.getBoundingClientRect();
      mousePos.current = {
        x: e.clientX - bRect.left,
        y: e.clientY - bRect.top,
        active: true,
      };
    };

    const handleMouseLeave = () => {
      mousePos.current.active = false;
    };

    const handleCanvasClick = (e: MouseEvent) => {
      const bRect = canvas.getBoundingClientRect();
      pulseWaves.current.push({
        x: e.clientX - bRect.left,
        y: e.clientY - bRect.top,
        r: 6,
        maxR: 190,
        alpha: 0.9,
        color: '#6366f1',
      });
    };

    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseleave', handleMouseLeave);
    canvas.addEventListener('click', handleCanvasClick);

    // Render loop
    const render = () => {
      const width = canvas.width / (window.devicePixelRatio || 1);
      const height = canvas.height / (window.devicePixelRatio || 1);

      ctx.clearRect(0, 0, width, height);

      // Render subtle magnetic spotlight at cursor
      if (mousePos.current.active) {
        const grad = ctx.createRadialGradient(
          mousePos.current.x,
          mousePos.current.y,
          0,
          mousePos.current.x,
          mousePos.current.y,
          180
        );
        grad.addColorStop(0, 'rgba(99, 102, 241, 0.12)');
        grad.addColorStop(0.5, 'rgba(6, 182, 212, 0.05)');
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);
      }

      // Render expanding laser pulse waves
      for (let s = pulseWaves.current.length - 1; s >= 0; s--) {
        const pw = pulseWaves.current[s];
        ctx.save();
        ctx.beginPath();
        ctx.arc(pw.x, pw.y, pw.r, 0, Math.PI * 2);
        ctx.strokeStyle = pw.color;
        ctx.lineWidth = 1.5;
        ctx.globalAlpha = pw.alpha;
        ctx.shadowColor = pw.color;
        ctx.shadowBlur = 10;
        ctx.stroke();
        ctx.restore();

        pw.r += 3.2;
        pw.alpha *= 0.95;
        if (pw.alpha < 0.02 || pw.r > pw.maxR) {
          pulseWaves.current.splice(s, 1);
        }
      }

      // Update and draw micro particles
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        // Magnetic warp near mouse
        if (mousePos.current.active) {
          const dx = mousePos.current.x - p.x;
          const dy = mousePos.current.y - p.y;
          const dist = Math.hypot(dx, dy);
          if (dist < 130 && dist > 1) {
            const pull = (130 - dist) / 130;
            p.vx += (dx / dist) * pull * 0.08;
            p.vy += (dy / dist) * pull * 0.08;
          }
        }

        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.98;
        p.vy *= 0.98;

        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;

        // Render point
        ctx.save();
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.baseRadius, 0, Math.PI * 2);
        ctx.fillStyle = '#94a3b8';
        ctx.globalAlpha = p.alpha;
        ctx.fill();
        ctx.restore();
      }

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resizeCanvas);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseleave', handleMouseLeave);
      canvas.removeEventListener('click', handleCanvasClick);
    };
  }, [mode]);

  const activeProgress = progressPercentage !== undefined ? progressPercentage : simulatedProgress;
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
        backgroundColor: isFullscreen ? '#090d16' : 'transparent',
        backdropFilter: isFullscreen ? 'blur(20px)' : 'none',
        WebkitBackdropFilter: isFullscreen ? 'blur(20px)' : 'none',
        padding: isFullscreen ? '2rem' : '1.25rem 0',
      }}
    >
      <div
        className="linear-loader-card"
        style={{
          width: '100%',
          maxWidth: isFullscreen ? '580px' : '560px',
          padding: '2rem 1.75rem',
          position: 'relative',
          zIndex: 10,
        }}
      >
        {/* Interactive Magnetic Canvas Layer */}
        <canvas
          ref={canvasRef}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            cursor: 'crosshair',
            zIndex: 1,
            pointerEvents: 'auto',
          }}
          title="Click to emit laser ping pulse"
        />

        {/* Foreground Content Layer */}
        <div style={{ position: 'relative', zIndex: 10, pointerEvents: 'auto' }}>
          {/* Header Metadata Pill */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '1.25rem',
              borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
              paddingBottom: '0.75rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span
                style={{
                  width: '7px',
                  height: '7px',
                  borderRadius: '50%',
                  backgroundColor: '#10b981',
                  boxShadow: '0 0 8px #10b981',
                  display: 'inline-block',
                }}
              />
              <span
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  color: '#94a3b8',
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                }}
              >
                CLUSTER // ONLINE
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '0.7rem',
                  color: '#64748b',
                }}
              >
                PING: {lastLatency ? `${lastLatency}ms` : '12ms'}
              </span>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  background: 'rgba(99, 102, 241, 0.12)',
                  border: '1px solid rgba(99, 102, 241, 0.25)',
                  fontSize: '0.68rem',
                  fontWeight: 600,
                  color: '#818cf8',
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                <Cpu size={11} /> 60 FPS
              </span>
            </div>
          </div>

          {/* Precision 3D Gyroscope Centerpiece */}
          <div style={{ margin: '1rem 0 1.5rem 0', position: 'relative' }}>
            <div className="gyro-stage">
              <div className="gyro-ring gyro-ring-1" />
              <div className="gyro-ring gyro-ring-2" />
              <div className="gyro-ring gyro-ring-3" />
              <div className="gyro-core" />
            </div>
          </div>

          {/* Title and High-Tech Subtitle */}
          <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
            <h3
              style={{
                fontFamily: "'Outfit', sans-serif",
                fontSize: '1rem',
                fontWeight: 600,
                color: '#f8fafc',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                margin: '0 0 0.25rem 0',
              }}
            >
              {title}
            </h3>
            <p
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '0.72rem',
                color: '#64748b',
                margin: 0,
                letterSpacing: '0.02em',
              }}
            >
              {subtitle}
            </p>
          </div>

          {/* Precision Hairline Laser Progress Line */}
          <div style={{ marginBottom: '1.25rem' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '0.4rem',
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '0.72rem',
              }}
            >
              <span style={{ color: '#06b6d4', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Terminal size={12} />
                STREAM_THROUGHPUT
              </span>
              <span style={{ color: '#f8fafc', fontWeight: 600 }}>
                {activeProgress.toFixed(1)}%
              </span>
            </div>
            <div className="precision-progress-track">
              <div
                className="precision-progress-fill"
                style={{ width: `${activeProgress}%` }}
              />
            </div>
          </div>

          {/* Monospace Live Telemetry Stream */}
          <div
            style={{
              backgroundColor: 'rgba(9, 13, 22, 0.75)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              borderRadius: '10px',
              padding: '0.75rem 0.9rem',
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '0.72rem',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '0.5rem',
                color: '#64748b',
                fontSize: '0.68rem',
                borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                paddingBottom: '0.3rem',
              }}
            >
              <span>TELEMETRY_STREAM_V2</span>
              <button
                type="button"
                onClick={() => setShowTelemetryHUD(!showTelemetryHUD)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#64748b',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.2rem',
                  fontSize: '0.68rem',
                  padding: 0,
                }}
              >
                {showTelemetryHUD ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                {showTelemetryHUD ? 'COLLAPSE' : 'EXPAND'}
              </button>
            </div>

            {showTelemetryHUD && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                {TELEMETRY_LOGS.slice(Math.max(0, logIndex - 2), logIndex + 1).map((log, idx) => (
                  <div key={idx} className="telemetry-row">
                    <span style={{ color: '#475569', minWidth: '40px' }}>{log.time}</span>
                    <span
                      style={{
                        color: log.tag === 'AUTH' ? '#ec4899' : log.tag === 'SYNC' ? '#06b6d4' : '#818cf8',
                        fontWeight: 600,
                        minWidth: '42px',
                      }}
                    >
                      [{log.tag}]
                    </span>
                    <span style={{ color: idx === 2 ? '#e2e8f0' : '#94a3b8' }}>{log.text}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#06b6d4' }}>
                  <span>&gt;</span>
                  <span className="telemetry-cursor" />
                </div>
              </div>
            )}
          </div>

          {/* Interactive Precision Controls Toolbar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: '1.25rem',
              paddingTop: '0.75rem',
              borderTop: '1px solid rgba(255, 255, 255, 0.06)',
            }}
          >
            <button
              type="button"
              onClick={handlePingNode}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.35rem 0.75rem',
                borderRadius: '6px',
                background: isPinging ? 'rgba(6, 182, 212, 0.25)' : 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: isPinging ? '#67e8f9' : '#cbd5e1',
                fontSize: '0.7rem',
                fontFamily: "'JetBrains Mono', monospace",
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.4)';
                e.currentTarget.style.background = 'rgba(99, 102, 241, 0.12)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                e.currentTarget.style.background = isPinging ? 'rgba(6, 182, 212, 0.25)' : 'rgba(255, 255, 255, 0.04)';
              }}
              title="Send laser ping to test telemetry latency"
            >
              <Activity size={12} style={{ color: isPinging ? '#22d3ee' : '#818cf8' }} />
              <span>{isPinging ? 'PINGING...' : '⌘ PING NODE'}</span>
              {pingCount > 0 && <span style={{ color: '#64748b' }}>({pingCount})</span>}
            </button>

            <span
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '0.68rem',
                color: '#475569',
                letterSpacing: '0.04em',
                userSelect: 'none',
              }}
            >
              CLICK CANVAS // LASER PULSE
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
