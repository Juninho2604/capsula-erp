/* PROPOSAL A — "Editorial Aurora"
   Direction: warm-cinematic. Adds atmospheric depth via radial light gradients,
   grain texture, and a single soft chroma. Icons become duotone with subtle inner
   glow. Cards get layered glass with hairline borders + inner highlight.
*/

const ProposalA = () => {
  const C = {
    bg: "#0A111E",
    bgDeep: "#070C16",
    ink: "#F4F1EA",
    inkDim: "rgba(244, 241, 234, 0.62)",
    inkSoft: "rgba(244, 241, 234, 0.42)",
    accent: "#E8714A",         // warm capsule orange
    accentSoft: "rgba(232, 113, 74, 0.18)",
    blue: "#7AA7FF",
    hair: "rgba(244, 241, 234, 0.08)",
    hairBright: "rgba(244, 241, 234, 0.14)",
  };

  // Reusable atmospheric backdrop: radial spotlight + grain
  const backdrop = (
    <>
      {/* Radial aurora — top */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: `radial-gradient(ellipse 70% 50% at 50% 0%, ${C.accentSoft} 0%, transparent 60%)`,
      }} />
      {/* Radial aurora — corner cool */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: `radial-gradient(ellipse 50% 40% at 90% 20%, rgba(122, 167, 255, 0.10) 0%, transparent 60%)`,
      }} />
      {/* Vignette */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: `radial-gradient(ellipse 100% 80% at 50% 50%, transparent 50%, ${C.bgDeep} 100%)`,
      }} />
      {/* Grain */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.35, mixBlendMode: "overlay",
        backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.4 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>")`,
      }} />
    </>
  );

  // Floating decorative blob
  const Blob = ({ x, y, size, color, blur = 80 }) => (
    <div style={{
      position: "absolute", left: x, top: y,
      width: size, height: size, borderRadius: "50%",
      background: color, filter: `blur(${blur}px)`, opacity: 0.55, pointerEvents: "none",
    }} />
  );

  const Logo = () => (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{
        width: 22, height: 22, borderRadius: "50%",
        background: `radial-gradient(circle at 35% 35%, #FFD7C2, ${C.accent} 55%, #8C2E18)`,
        boxShadow: `0 0 0 1px rgba(255,255,255,0.06), 0 6px 14px rgba(232, 113, 74, 0.35)`,
      }} />
      <span style={{
        fontFamily: "'Inter', sans-serif", fontWeight: 700, letterSpacing: "0.18em",
        fontSize: 12, color: C.ink,
      }}>CÁPSULA</span>
    </div>
  );

  const NavBar = () => (
    <div style={{
      position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "22px 56px", borderBottom: `1px solid ${C.hair}`,
      background: "rgba(10, 17, 30, 0.55)", backdropFilter: "blur(14px)",
    }}>
      <Logo />
      <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
        <span style={{ fontFamily: "Inter", fontSize: 13, color: C.inkDim }}>Iniciar sesión</span>
        <button style={{
          fontFamily: "Inter", fontSize: 13, color: C.ink, fontWeight: 500,
          padding: "9px 16px", borderRadius: 999, border: `1px solid rgba(122, 167, 255, 0.35)`,
          background: `linear-gradient(180deg, rgba(122, 167, 255, 0.22), rgba(122, 167, 255, 0.08))`,
          boxShadow: `inset 0 1px 0 rgba(255,255,255,0.12), 0 4px 14px rgba(122, 167, 255, 0.18)`,
          cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8,
        }}>
          Solicitar demo
          <span style={{ opacity: 0.85 }}>→</span>
        </button>
      </div>
    </div>
  );

  // ---- HERO ----
  const Hero = () => (
    <section style={{ position: "relative", padding: "80px 56px 110px", overflow: "hidden" }}>
      {backdrop}
      <Blob x={-120} y={120} size={360} color={C.accent} blur={120} />
      <Blob x={"70%"} y={-60} size={280} color="#3B5BDB" blur={120} />

      <div style={{ position: "relative", textAlign: "center", maxWidth: 880, margin: "0 auto" }}>
        {/* Capsule mark with halo */}
        <div style={{ position: "relative", width: 88, height: 88, margin: "0 auto 28px" }}>
          <div style={{
            position: "absolute", inset: -22, borderRadius: "50%",
            background: `radial-gradient(circle, ${C.accentSoft}, transparent 70%)`,
          }} />
          <div style={{
            position: "absolute", inset: 0, borderRadius: "50%",
            background: `radial-gradient(circle at 35% 30%, #FFE4D2, ${C.accent} 50%, #5A1C0E)`,
            boxShadow: `0 18px 50px rgba(232, 113, 74, 0.45), inset 0 -6px 14px rgba(0,0,0,0.35), inset 0 2px 4px rgba(255,255,255,0.5)`,
          }} />
          {/* highlight dot */}
          <div style={{
            position: "absolute", left: 22, top: 18, width: 14, height: 8, borderRadius: "50%",
            background: "rgba(255,255,255,0.55)", filter: "blur(2px)",
          }} />
        </div>

        {/* Eyebrow pill — duotone */}
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          padding: "7px 14px", borderRadius: 999,
          background: `linear-gradient(180deg, rgba(232,113,74,0.14), rgba(232,113,74,0.04))`,
          border: `1px solid rgba(232, 113, 74, 0.28)`,
          boxShadow: `inset 0 1px 0 rgba(255,255,255,0.08)`,
          marginBottom: 30,
        }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: C.accent, boxShadow: `0 0 8px ${C.accent}` }} />
          <span style={{ fontFamily: "Inter", fontSize: 11, letterSpacing: "0.16em", fontWeight: 600, color: "#F2C7B3" }}>
            SOFTWARE DE GESTIÓN GASTRONÓMICA
          </span>
        </div>

        <h1 style={{
          fontFamily: "'Inter', sans-serif",
          fontSize: 92, lineHeight: 1.0, fontWeight: 700, letterSpacing: "-0.035em",
          color: C.ink, margin: "0 0 22px",
          textShadow: `0 1px 0 rgba(255,255,255,0.04)`,
        }}>
          <span style={{ display: "block" }}>Tu negocio,</span>
          <span style={{
            display: "block", fontStyle: "italic", fontWeight: 600,
            background: `linear-gradient(180deg, #FFFFFF 30%, ${C.accent} 130%)`,
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}>
            una cápsula.
          </span>
        </h1>

        <p style={{
          fontFamily: "Inter", fontSize: 17, color: C.blue, opacity: 0.85,
          margin: "0 auto 36px", maxWidth: 520,
        }}>
          Una sola plataforma, del salón a la dirección.
        </p>

        <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
          <button style={{
            fontFamily: "Inter", fontWeight: 500, fontSize: 14,
            padding: "13px 22px", borderRadius: 999, color: C.ink, border: "none",
            background: `linear-gradient(180deg, #6E94EE, #3B5BDB)`,
            boxShadow: `inset 0 1px 0 rgba(255,255,255,0.25), 0 10px 30px rgba(59, 91, 219, 0.45), 0 1px 0 rgba(0,0,0,0.4)`,
            cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 9,
            transition: "transform 200ms ease, box-shadow 200ms ease",
          }}>
            Entrar al sistema <span>→</span>
          </button>
          <button style={{
            fontFamily: "Inter", fontWeight: 500, fontSize: 14,
            padding: "13px 22px", borderRadius: 999, color: C.ink,
            border: `1px solid ${C.hairBright}`,
            background: `linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.01))`,
            boxShadow: `inset 0 1px 0 rgba(255,255,255,0.08)`,
            backdropFilter: "blur(8px)", cursor: "pointer",
          }}>
            Ver dashboard
          </button>
        </div>
      </div>
    </section>
  );

  // ---- MODULES ----
  // Duotone icons — two stacked SVG layers (filled silhouette + outline accent)
  const Icon = ({ glyph }) => {
    const paths = {
      cube: (
        <>
          <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z" fill={C.accent} fillOpacity="0.18"/>
          <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3zM4 7.5L12 12l8-4.5M12 12v9" stroke={C.accent} strokeWidth="1.5" fill="none" strokeLinejoin="round"/>
        </>
      ),
      book: (
        <>
          <path d="M4 4h7v16H4z M13 4h7v16h-7z" fill={C.accent} fillOpacity="0.16"/>
          <path d="M4 4h7v16H4zM13 4h7v16h-7zM7 8h1M7 11h1M16 8h1M16 11h1" stroke={C.accent} strokeWidth="1.5" fill="none" strokeLinecap="round"/>
        </>
      ),
      coin: (
        <>
          <circle cx="12" cy="12" r="9" fill={C.accent} fillOpacity="0.16"/>
          <circle cx="12" cy="12" r="9" stroke={C.accent} strokeWidth="1.5" fill="none"/>
          <path d="M14.5 9.5c-.5-.8-1.4-1.3-2.5-1.3-1.7 0-3 .9-3 2 0 2.5 5.5 1.5 5.5 4 0 1.1-1.3 2-3 2-1.1 0-2-.5-2.5-1.3M12 6.5v1M12 16.5v1" stroke={C.accent} strokeWidth="1.5" fill="none" strokeLinecap="round"/>
        </>
      ),
      chart: (
        <>
          <path d="M4 20V8M10 20V4M16 20v-9M22 20H2" fill="none" stroke={C.accent} strokeWidth="1.5" strokeLinecap="round"/>
          <rect x="3" y="8" width="2" height="12" fill={C.accent} fillOpacity="0.22"/>
          <rect x="9" y="4" width="2" height="16" fill={C.accent} fillOpacity="0.22"/>
          <rect x="15" y="11" width="2" height="9" fill={C.accent} fillOpacity="0.22"/>
        </>
      ),
    };
    return (
      <div style={{
        position: "relative", width: 44, height: 44, borderRadius: 12,
        background: `linear-gradient(180deg, rgba(232,113,74,0.16), rgba(232,113,74,0.04))`,
        border: `1px solid rgba(232,113,74,0.22)`,
        display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.06)`,
      }}>
        <svg viewBox="0 0 24 24" width="22" height="22">{paths[glyph]}</svg>
      </div>
    );
  };

  const Card = ({ icon, title, body }) => (
    <div style={{
      position: "relative",
      padding: "28px 24px 28px",
      borderRadius: 18,
      background: `linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.015))`,
      border: `1px solid ${C.hair}`,
      boxShadow: `inset 0 1px 0 rgba(255,255,255,0.06), 0 24px 50px -30px rgba(0,0,0,0.7)`,
      backdropFilter: "blur(12px)",
      overflow: "hidden",
    }}>
      {/* top hairline highlight */}
      <div style={{
        position: "absolute", top: 0, left: 24, right: 24, height: 1,
        background: `linear-gradient(90deg, transparent, rgba(232,113,74,0.5), transparent)`,
      }} />
      <Icon glyph={icon} />
      <div style={{
        fontFamily: "Inter", color: C.ink, fontWeight: 600, fontSize: 16,
        marginTop: 22, marginBottom: 10, letterSpacing: "-0.01em",
      }}>{title}</div>
      <p style={{ fontFamily: "Inter", fontSize: 13, lineHeight: 1.6, color: C.inkDim, margin: 0 }}>{body}</p>
    </div>
  );

  const Modules = () => (
    <section style={{ position: "relative", padding: "100px 56px", overflow: "hidden" }}>
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: `radial-gradient(ellipse 60% 50% at 50% 0%, rgba(232,113,74,0.08), transparent 60%)`,
      }} />
      {/* subtle dot pattern */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.4,
        backgroundImage: `radial-gradient(rgba(244,241,234,0.06) 1px, transparent 1px)`,
        backgroundSize: "28px 28px",
        maskImage: "radial-gradient(ellipse 70% 60% at 50% 50%, black 30%, transparent 80%)",
        WebkitMaskImage: "radial-gradient(ellipse 70% 60% at 50% 50%, black 30%, transparent 80%)",
      }} />

      <div style={{ position: "relative", textAlign: "center", maxWidth: 720, margin: "0 auto 56px" }}>
        <div style={{
          display: "inline-flex", padding: "6px 14px", borderRadius: 999,
          background: `linear-gradient(180deg, rgba(232,113,74,0.14), rgba(232,113,74,0.04))`,
          border: `1px solid rgba(232,113,74,0.28)`,
          marginBottom: 26,
        }}>
          <span style={{ fontFamily: "Inter", fontSize: 11, letterSpacing: "0.16em", color: "#F2C7B3", fontWeight: 600 }}>
            PRODUCTO
          </span>
        </div>
        <h2 style={{
          fontFamily: "Inter", fontSize: 56, lineHeight: 1.05, fontWeight: 700,
          color: C.ink, margin: "0 0 16px", letterSpacing: "-0.03em",
        }}>
          Cuatro módulos.<br/>
          <span style={{ fontStyle: "italic", fontWeight: 600, color: "rgba(244,241,234,0.85)" }}>
            Una sola operación.
          </span>
        </h2>
        <p style={{ fontFamily: "Inter", color: C.inkDim, fontSize: 15, margin: 0 }}>
          Implementación por fases. Adopta solo lo que necesitas, cuando lo necesitas.
        </p>
      </div>

      <div style={{
        position: "relative",
        display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 18,
        maxWidth: 1100, margin: "0 auto",
      }}>
        <Card icon="cube"  title="Inventario" body="Gestión y control de stock en tiempo real, multi-ubicación y alertas de reabastecimiento." />
        <Card icon="book"  title="Recetas"    body="Estandarización y preparación con sub-recetas recursivas y control de mermas." />
        <Card icon="coin"  title="Costos"     body="Análisis de márgenes y gastos. COGS automation y costo real por plato el mismo día." />
        <Card icon="chart" title="Analítica"  body="Reportes y datos clave: ventas, ticket promedio y utilidad operativa por jornada." />
      </div>
    </section>
  );

  // ---- CTA ----
  const CTA = () => (
    <section style={{ position: "relative", padding: "20px 56px 100px" }}>
      <div style={{
        position: "relative", maxWidth: 1100, margin: "0 auto",
        padding: "70px 40px", borderRadius: 28,
        background: `
          radial-gradient(ellipse 60% 80% at 0% 0%, rgba(232,113,74,0.22), transparent 60%),
          radial-gradient(ellipse 60% 80% at 100% 100%, rgba(122,167,255,0.20), transparent 60%),
          linear-gradient(180deg, #0E1828, #0A111E)
        `,
        border: `1px solid ${C.hairBright}`,
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.10), 0 40px 80px -40px rgba(0,0,0,0.8)`,
        textAlign: "center", overflow: "hidden",
      }}>
        {/* corner glow blobs */}
        <Blob x={-80} y={-80} size={260} color={C.accent} blur={120} />
        <Blob x={"75%"} y={"60%"} size={240} color="#3B5BDB" blur={120} />

        <h2 style={{
          position: "relative",
          fontFamily: "Inter", fontWeight: 700, fontSize: 52, color: C.ink, margin: "0 0 14px",
          lineHeight: 1.05, letterSpacing: "-0.03em",
        }}>
          Pongamos tu operación<br/>en una sola vista.
        </h2>
        <p style={{ position: "relative", fontFamily: "Inter", color: C.blue, opacity: 0.85, fontSize: 15, margin: "0 0 30px" }}>
          30 minutos con un especialista, sobre los datos reales de tu restaurante.
        </p>
        <div style={{ position: "relative", display: "flex", gap: 12, justifyContent: "center" }}>
          <button style={{
            fontFamily: "Inter", fontWeight: 500, fontSize: 14,
            padding: "13px 22px", borderRadius: 999, color: C.ink, border: "none",
            background: `linear-gradient(180deg, #6E94EE, #3B5BDB)`,
            boxShadow: `inset 0 1px 0 rgba(255,255,255,0.25), 0 10px 30px rgba(59, 91, 219, 0.45)`,
            cursor: "pointer",
          }}>
            Solicitar demo →
          </button>
          <button style={{
            fontFamily: "Inter", fontWeight: 500, fontSize: 14,
            padding: "13px 22px", borderRadius: 999, color: C.ink,
            border: `1px solid ${C.hairBright}`,
            background: "rgba(255,255,255,0.04)", cursor: "pointer",
          }}>
            Hablar con ventas
          </button>
        </div>
      </div>
    </section>
  );

  const Footer = () => (
    <footer style={{
      position: "relative", padding: "56px 56px 48px", borderTop: `1px solid ${C.hair}`,
      display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr 1fr", gap: 40,
    }}>
      <div>
        <Logo />
        <p style={{ fontFamily: "Inter", color: C.inkDim, fontSize: 13, lineHeight: 1.6, marginTop: 16, maxWidth: 280 }}>
          Plataforma de gestión para restaurantes <span style={{ color: C.blue }}>independientes y grupos gastronómicos.</span>
        </p>
      </div>
      {[
        ["PRODUCTO", ["Inventario","Recetas","Costos","Analítica"]],
        ["EMPRESA",  ["Sobre nosotros","Contacto"]],
        ["RECURSOS", ["Centro de ayuda","Estado del sistema"]],
      ].map(([head, items]) => (
        <div key={head}>
          <div style={{ fontFamily: "Inter", fontSize: 11, letterSpacing: "0.16em", color: C.inkSoft, fontWeight: 600, marginBottom: 18 }}>{head}</div>
          {items.map(t => (
            <div key={t} style={{ fontFamily: "Inter", fontSize: 13, color: C.blue, opacity: 0.9, marginBottom: 10 }}>{t}</div>
          ))}
        </div>
      ))}
    </footer>
  );

  return (
    <div style={{
      width: 1280, background: C.bg, color: C.ink, position: "relative", overflow: "hidden",
      fontFamily: "'Inter', system-ui, sans-serif",
    }}>
      <NavBar />
      <Hero />
      <div style={{ height: 1, background: `linear-gradient(90deg, transparent, ${C.hairBright}, transparent)`, margin: "0 56px" }} />
      <Modules />
      <CTA />
      <Footer />
    </div>
  );
};

window.ProposalA = ProposalA;
