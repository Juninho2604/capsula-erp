import Link from 'next/link';
import { WHATSAPP_DEMO_LINK, WHATSAPP_SALES_LINK } from '@/config/marketing-contact';

// Landing "Editorial" (rebranding 2.0). Diseño gastro-editorial: blush + rojo,
// tipografía Archivo Black gigante, ilustraciones hand-drawn. Autocontenida
// (nav + footer propios) — NO usa el chrome de (marketing).
export default function LandingPage() {
    const modules = [
        { name: 'Inventario', code: 'M.01', desc: 'Gestión y control de stock en tiempo real, multi-ubicación y alertas de reabastecimiento.' },
        { name: 'Recetas', code: 'M.02', desc: 'Estandarización y preparación con sub-recetas recursivas y control de mermas.' },
        { name: 'Costos', code: 'M.03', desc: 'Análisis de márgenes y gastos. COGS automático y costo real por plato el mismo día.' },
        { name: 'Analítica', code: 'M.04', desc: 'Reportes y datos clave: ventas, ticket promedio y utilidad operativa por jornada.' },
    ];

    return (
        <>
            {/* ================= NAV ================= */}
            <nav className="ke-nav" data-anim="rise" data-delay="0">
                <div className="ke-nav-pill">
                    <span className="ke-nav-logo">KPSULA</span>
                    <div className="ke-nav-links">
                        <a href="#modulos">Módulos</a>
                        <Link href="/descargar">Descargar app</Link>
                        <Link href="/login">Iniciar sesión</Link>
                    </div>
                </div>
            </nav>

            {/* ================= HERO ================= */}
            <header className="ke-hero">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    className="ke-hero-illo"
                    data-anim="halo"
                    src="/landing/mesa-hero.png"
                    alt=""
                    aria-hidden="true"
                />

                <h1 className="ke-hero-title" data-anim="rise" data-delay="1">
                    Tu negocio,<span className="l2">una kpsula.</span>
                </h1>

                <p className="ke-hero-sub" data-anim="rise" data-delay="2">
                    Una sola plataforma, del salón a la dirección · Software de gestión gastronómica
                </p>

                <a
                    className="ke-circle"
                    data-anim="rise"
                    data-delay="3"
                    href={WHATSAPP_DEMO_LINK}
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    Solicitar<br />demo
                </a>
            </header>

            {/* ================= MÓDULOS ================= */}
            <main className="ke-wrap" id="modulos">
                <section className="ke-card-red" data-reveal>
                    <h2>El producto</h2>
                    <h3>Cuatro módulos.<br />Una sola operación.</h3>
                    <p>Implementación por fases · Adopta solo lo que necesitas, cuando lo necesitas</p>
                </section>

                <section className="ke-card-menu" data-reveal>
                    <h2>Los módulos</h2>
                    <p className="ke-lead">La carta cambia, tu control no</p>

                    <div className="ke-menu-grid">
                        {modules.map((m) => (
                            <div className="ke-menu-item" data-reveal key={m.code}>
                                <div className="ke-row">
                                    <h4>{m.name}</h4>
                                    <span className="ke-code">{m.code}</span>
                                </div>
                                <p>{m.desc}</p>
                            </div>
                        ))}
                    </div>
                </section>
            </main>

            {/* ================= BANDA DE ILUSTRACIONES ================= */}
            <section className="ke-band" aria-hidden="true">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="ke-band-left" src="/landing/sarten-band-left.png" alt="" />
                <div className="ke-band-word">Del salón<br />a la dirección</div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="ke-band-right" src="/landing/sandwich-band-right.png" alt="" />
            </section>

            {/* ================= CTA + FOOTER (un solo bloque rojo) ================= */}
            <div className="ke-red-block" id="demo">
                <div className="ke-wrap">
                    <section className="ke-cta-grid">
                        <div data-reveal>
                            <h2>¿Una demo?<br />¿Una duda?</h2>
                            <p className="ke-copy">
                                <strong>Pongamos tu operación en una sola vista.</strong><br />
                                30 minutos con un especialista, sobre los datos reales de tu restaurante.
                            </p>
                        </div>
                        <div className="ke-cta-actions" data-reveal>
                            <a
                                className="ke-ghost"
                                href={WHATSAPP_SALES_LINK}
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                Hablar con ventas
                            </a>
                            <a
                                className="ke-circle ke-circle--cream"
                                href={WHATSAPP_DEMO_LINK}
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                Solicitar<br />demo
                            </a>
                        </div>
                    </section>

                    <footer className="ke-foot">
                        <div>
                            KPSULA ©2026<br />Todos los derechos reservados
                        </div>
                        <div>
                            <Link href="/producto/inventario">Inventario</Link>
                            <Link href="/producto/recetas">Recetas</Link>
                            <Link href="/producto/costos">Costos</Link>
                            <Link href="/producto/analitica">Analítica</Link>
                        </div>
                        <div>
                            <Link href="/empresa">Sobre nosotros</Link>
                            <Link href="/contacto">Contacto</Link>
                            <Link href="/descargar">Descargar app</Link>
                            <Link href="/login">Iniciar sesión</Link>
                        </div>
                    </footer>

                    <div className="ke-wordmark" aria-hidden="true">KPSULA</div>
                </div>
            </div>
        </>
    );
}
