import type { ReactNode } from 'react';
import './aurora.css';
import AuroraNav from '@/components/marketing/AuroraNav';
import AuroraFooter from '@/components/marketing/AuroraFooter';

export default function MarketingLayout({ children }: { children: ReactNode }) {
    return (
        <div className="cap-backdrop">
            <AuroraNav />
            {children}
            <AuroraFooter />
        </div>
    );
}
