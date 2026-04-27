import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import CapsulaLogo from '@/components/ui/CapsulaLogo';

export default function AuroraNav() {
    return (
        <nav className="cap-nav">
            <div className="relative z-[1] mx-auto flex max-w-[1280px] items-center justify-between px-10 py-5">
                <Link href="/" className="inline-flex items-center" aria-label="CÁPSULA — inicio">
                    <CapsulaLogo variant="full" size={22} />
                </Link>
                <div className="flex items-center gap-5">
                    <Link href="/login" className="cap-link text-[13px]">
                        Iniciar sesión
                    </Link>
                    <Link
                        href="/login"
                        className="cap-btn cap-btn--ghost !py-[9px] !px-4 text-[13px]"
                        style={{
                            borderColor: 'rgba(122, 167, 255, 0.35)',
                            background:
                                'linear-gradient(180deg, rgba(122, 167, 255, 0.22), rgba(122, 167, 255, 0.08))',
                            boxShadow:
                                'inset 0 1px 0 rgba(255,255,255,0.12), 0 4px 14px rgba(122, 167, 255, 0.18)',
                        }}
                    >
                        Solicitar demo <ArrowRight className="h-3.5 w-3.5 opacity-85" />
                    </Link>
                </div>
            </div>
        </nav>
    );
}
