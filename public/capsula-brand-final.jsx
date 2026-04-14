import { useState } from "react";

const brand = {
  primary: "#FF6B4A",
  primaryHover: "#E85A3A",
  secondary: "#1B2D45",
  accent: "#FFD93D",
  warm: "#FFF8F5",
  muted: "#FFE8E0",
  gray: "#6B7280",
  border: "#E5E7EB",
  success: "#10B981",
  warning: "#F59E0B",
};

const Logo = ({ color = brand.primary, size = 36 }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
    <rect x="8" y="16" width="48" height="32" rx="16" fill={color} />
    <rect x="22" y="24" width="6" height="16" rx="3" fill="white" opacity="0.9" />
    <rect x="32" y="20" width="6" height="24" rx="3" fill="white" opacity="0.7" />
    <rect x="42" y="26" width="6" height="12" rx="3" fill="white" opacity="0.5" />
  </svg>
);

const FullLogo = ({ color = brand.primary, textColor = brand.secondary, size = 32 }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
    <Logo color={color} size={size} />
    <span style={{ fontFamily: "'Nunito', sans-serif", fontWeight: 800, fontSize: size * 0.5, color: textColor, letterSpacing: "0.02em" }}>
      CÁPSULA
    </span>
  </div>
);

function NavbarPreview() {
  return (
    <div style={{ background: "white", borderBottom: `1px solid ${brand.border}`, padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", borderRadius: "12px 12px 0 0" }}>
      <FullLogo size={28} />
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: brand.success }} />
        <div style={{ width: 28, height: 28, borderRadius: "50%", background: brand.primary, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ color: "white", fontSize: 11, fontWeight: 700, fontFamily: "'Nunito'" }}>O</span>
        </div>
      </div>
    </div>
  );
}

function SidebarPreview() {
  const items = [
    { icon: "📊", label: "Dashboard", active: true },
    { icon: "🛒", label: "POS", active: false },
    { icon: "📦", label: "Inventario", active: false },
    { icon: "📋", label: "Recetas", active: false },
    { icon: "🏭", label: "Producción", active: false },
  ];
  return (
    <div style={{ width: 180, background: brand.secondary, padding: "16px 8px", borderRadius: "0 0 0 12px", minHeight: 280 }}>
      {items.map((item, i) => (
        <div key={i} style={{
          display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 8, marginBottom: 2,
          background: item.active ? "rgba(255,107,74,0.15)" : "transparent",
          cursor: "pointer",
        }}>
          <span style={{ fontSize: 14 }}>{item.icon}</span>
          <span style={{ fontFamily: "'Inter'", fontSize: 12, fontWeight: item.active ? 600 : 400, color: item.active ? brand.primary : "rgba(255,255,255,0.7)" }}>
            {item.label}
          </span>
        </div>
      ))}
    </div>
  );
}

function DashboardPreview() {
  return (
    <div style={{ flex: 1, background: brand.warm, padding: 16, borderRadius: "0 0 12px 0", minHeight: 280 }}>
      <h2 style={{ fontFamily: "'Nunito'", fontWeight: 800, fontSize: 16, color: brand.secondary, margin: "0 0 12px" }}>
        Resumen del día
      </h2>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
        {[
          { label: "Ventas", value: "$2,450", change: "+12%", color: brand.success },
          { label: "Órdenes", value: "47", change: "+5", color: brand.primary },
          { label: "Food Cost", value: "31.2%", change: "-2%", color: brand.success },
          { label: "Stock Bajo", value: "3", change: "items", color: brand.warning },
        ].map((card, i) => (
          <div key={i} style={{ background: "white", borderRadius: 10, padding: 12, border: `1px solid ${brand.border}` }}>
            <p style={{ fontFamily: "'Inter'", fontSize: 10, color: brand.gray, margin: 0 }}>{card.label}</p>
            <p style={{ fontFamily: "'Nunito'", fontSize: 18, fontWeight: 800, color: brand.secondary, margin: "4px 0 2px" }}>{card.value}</p>
            <span style={{ fontFamily: "'Inter'", fontSize: 10, color: card.color, fontWeight: 600 }}>{card.change}</span>
          </div>
        ))}
      </div>
      <button style={{
        width: "100%", padding: "10px 16px", background: brand.primary, color: "white", border: "none",
        borderRadius: 10, fontFamily: "'Nunito'", fontWeight: 700, fontSize: 13, cursor: "pointer",
      }}>
        + Nueva Orden
      </button>
    </div>
  );
}

function LoginPreview() {
  return (
    <div style={{
      background: `linear-gradient(145deg, ${brand.primary}, ${brand.primaryHover})`,
      borderRadius: 12, padding: 24, display: "flex", flexDirection: "column", alignItems: "center", gap: 16,
    }}>
      <Logo color="white" size={48} />
      <span style={{ fontFamily: "'Nunito'", fontWeight: 800, fontSize: 20, color: "white" }}>CÁPSULA</span>
      <p style={{ fontFamily: "'Inter'", fontSize: 12, color: "rgba(255,255,255,0.8)", margin: 0 }}>Ingresa a tu cuenta</p>
      <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 8 }}>
        <input placeholder="Email" style={{
          width: "100%", padding: "10px 14px", borderRadius: 8, border: "none", fontSize: 13,
          fontFamily: "'Inter'", background: "rgba(255,255,255,0.15)", color: "white", outline: "none",
          boxSizing: "border-box",
        }} />
        <input placeholder="Contraseña" type="password" style={{
          width: "100%", padding: "10px 14px", borderRadius: 8, border: "none", fontSize: 13,
          fontFamily: "'Inter'", background: "rgba(255,255,255,0.15)", color: "white", outline: "none",
          boxSizing: "border-box",
        }} />
        <button style={{
          width: "100%", padding: "10px", background: "white", color: brand.primary, border: "none",
          borderRadius: 8, fontFamily: "'Nunito'", fontWeight: 700, fontSize: 13, cursor: "pointer", marginTop: 4,
        }}>
          Entrar
        </button>
      </div>
    </div>
  );
}

function PostPreview() {
  return (
    <div style={{ borderRadius: 12, overflow: "hidden", border: `1px solid ${brand.border}`, background: "white", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
      <div style={{
        height: 200, background: `linear-gradient(145deg, ${brand.primary}, ${brand.primaryHover})`,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 20, gap: 8, position: "relative",
      }}>
        <div style={{ position: "absolute", top: 12, left: 12, display: "flex", alignItems: "center", gap: 4 }}>
          <Logo color="white" size={16} />
          <span style={{ fontFamily: "'Nunito'", fontWeight: 700, fontSize: 9, color: "white", opacity: 0.9 }}>CÁPSULA</span>
        </div>
        <div style={{ background: "white", borderRadius: 10, padding: "8px 14px", boxShadow: "0 4px 16px rgba(0,0,0,0.15)" }}>
          <span style={{ fontSize: 20 }}>💰</span>
        </div>
        <span style={{ fontFamily: "'Nunito'", fontWeight: 800, fontSize: 16, color: "white", textAlign: "center", lineHeight: 1.2 }}>
          ¿Sabes cuánto{"\n"}pierdes al mes?
        </span>
        <span style={{ fontFamily: "'Inter'", fontSize: 10, color: "white", opacity: 0.85 }}>
          3 métricas que debes medir
        </span>
      </div>
      <div style={{ padding: "10px 14px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
          <div style={{ width: 22, height: 22, borderRadius: "50%", background: brand.primary, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Logo color="white" size={12} />
          </div>
          <span style={{ fontFamily: "'Nunito'", fontWeight: 700, fontSize: 11, color: brand.secondary }}>capsulapp</span>
        </div>
        <p style={{ fontFamily: "'Inter'", fontSize: 10, color: brand.gray, margin: 0, lineHeight: 1.4 }}>
          Tu food cost debería estar entre 28-35%. Si no lo mides, estás perdiendo dinero.
        </p>
      </div>
    </div>
  );
}

export default function CapsulaBrandFinal() {
  const [view, setView] = useState("erp");
  const views = [
    { id: "erp", label: "ERP UI" },
    { id: "login", label: "Login" },
    { id: "post", label: "Post" },
    { id: "assets", label: "Assets" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#F9FAFB", fontFamily: "'Inter', sans-serif", padding: "20px 16px" }}>
      <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />

      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <FullLogo size={32} />
          <p style={{ fontFamily: "'Inter'", fontSize: 12, color: brand.gray, margin: "6px 0 0" }}>
            Brand System — Preview Final
          </p>
        </div>

        <div style={{ display: "flex", gap: 4, marginBottom: 16, background: "#f3f4f6", borderRadius: 10, padding: 3 }}>
          {views.map(v => (
            <button key={v.id} onClick={() => setView(v.id)} style={{
              flex: 1, padding: "8px 6px", border: "none", borderRadius: 8,
              fontFamily: "'Nunito'", fontWeight: 700, fontSize: 12, cursor: "pointer",
              background: view === v.id ? "white" : "transparent",
              color: view === v.id ? brand.primary : "#9ca3af",
              boxShadow: view === v.id ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
              transition: "all 0.2s",
            }}>
              {v.label}
            </button>
          ))}
        </div>

        {view === "erp" && (
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: brand.secondary, marginBottom: 8, fontFamily: "'Nunito'" }}>
              Así se ve CÁPSULA en la app real
            </p>
            <div style={{ borderRadius: 12, overflow: "hidden", border: `1px solid ${brand.border}`, boxShadow: "0 4px 24px rgba(0,0,0,0.06)" }}>
              <NavbarPreview />
              <div style={{ display: "flex" }}>
                <SidebarPreview />
                <DashboardPreview />
              </div>
            </div>
          </div>
        )}

        {view === "login" && (
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: brand.secondary, marginBottom: 8, fontFamily: "'Nunito'" }}>
              Pantalla de login
            </p>
            <LoginPreview />
          </div>
        )}

        {view === "post" && (
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: brand.secondary, marginBottom: 8, fontFamily: "'Nunito'" }}>
              Ejemplo de post para redes
            </p>
            <PostPreview />
          </div>
        )}

        {view === "assets" && (
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: brand.secondary, marginBottom: 8, fontFamily: "'Nunito'" }}>
              Todos los assets generados
            </p>
            
            <div style={{ background: "white", borderRadius: 12, padding: 16, border: `1px solid ${brand.border}`, marginBottom: 12 }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: brand.gray, margin: "0 0 12px" }}>LOGO VARIANTES</p>
              <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ textAlign: "center" }}>
                  <FullLogo size={36} />
                  <p style={{ fontSize: 9, color: brand.gray, margin: "6px 0 0" }}>Full color</p>
                </div>
                <div style={{ textAlign: "center" }}>
                  <Logo size={36} />
                  <p style={{ fontSize: 9, color: brand.gray, margin: "6px 0 0" }}>Isotipo</p>
                </div>
                <div style={{ textAlign: "center", background: brand.secondary, borderRadius: 8, padding: 8 }}>
                  <FullLogo color="white" textColor="white" size={28} />
                  <p style={{ fontSize: 9, color: "rgba(255,255,255,0.6)", margin: "6px 0 0" }}>Sobre oscuro</p>
                </div>
              </div>
            </div>

            <div style={{ background: "white", borderRadius: 12, padding: 16, border: `1px solid ${brand.border}`, marginBottom: 12 }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: brand.gray, margin: "0 0 10px" }}>PALETA CORAL ENERGY</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6 }}>
                {[
                  { c: brand.primary, l: "Coral" },
                  { c: brand.secondary, l: "Navy" },
                  { c: brand.accent, l: "Gold" },
                  { c: brand.warm, l: "Warm" },
                  { c: brand.muted, l: "Muted" },
                ].map((item, i) => (
                  <div key={i} style={{ textAlign: "center" }}>
                    <div style={{ width: "100%", aspectRatio: "1", borderRadius: 8, background: item.c, border: `1px solid ${brand.border}` }} />
                    <p style={{ fontSize: 8, color: brand.gray, margin: "4px 0 0", fontWeight: 600 }}>{item.l}</p>
                    <p style={{ fontSize: 7, color: "#9ca3af", margin: 0 }}>{item.c}</p>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ background: "white", borderRadius: 12, padding: 16, border: `1px solid ${brand.border}` }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: brand.gray, margin: "0 0 10px" }}>ARCHIVOS PARA EL REPO</p>
              {[
                "src/config/branding.ts",
                "src/config/capsula-theme.css",
                "src/config/social-brand.ts",
                "src/components/brand/CapsulaLogo.tsx",
                "src/hooks/useBranding.ts",
                "tailwind.config.ts",
                "public/brand/logo-full-color.svg",
                "public/brand/logo-full-white.svg",
                "public/brand/logo-icon-color.svg",
                "docs/BRAND_IDENTITY_OPUS_CONTEXT.md",
              ].map((f, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 0", borderBottom: i < 9 ? `1px solid ${brand.border}` : "none" }}>
                  <span style={{ fontSize: 10 }}>{f.endsWith('.svg') ? '🖼️' : f.endsWith('.css') ? '🎨' : f.endsWith('.md') ? '📄' : '📦'}</span>
                  <span style={{ fontFamily: "monospace", fontSize: 10, color: brand.secondary }}>{f}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
