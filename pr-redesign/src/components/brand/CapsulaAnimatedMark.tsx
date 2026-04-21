'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

interface Props {
    size?: number;
    className?: string;
}

/**
 * Animated brand mark — three breathing rings, bicolor capsule disc,
 * sweep line across the horizon and two counter-orbiting accent dots.
 * Matches the landing + dashboard welcome animation from the template.
 */
export default function CapsulaAnimatedMark({ size = 96, className }: Props) {
    const uid = React.useId().replace(/:/g, '');
    return (
        <div className={cn('inline-flex items-center justify-center', className)} aria-hidden="true">
            <svg width={size} height={size} viewBox="0 0 120 120">
                <defs>
                    <clipPath id={`cap-am-${uid}`}>
                        <circle cx="60" cy="60" r="28" />
                    </clipPath>
                </defs>

                {/* Breathing rings — origin centered */}
                <g style={{ transformBox: 'fill-box', transformOrigin: 'center' }}>
                    <circle cx="60" cy="60" r="40" fill="none" stroke="#1B2A3A" strokeWidth="1"
                        className="animate-cap-breathe" style={{ transformOrigin: '60px 60px' }} />
                    <circle cx="60" cy="60" r="48" fill="none" stroke="#F25C3B" strokeWidth="1"
                        className="animate-cap-breathe" style={{ transformOrigin: '60px 60px', animationDelay: '.6s' }} />
                    <circle cx="60" cy="60" r="56" fill="none" stroke="#1B2A3A" strokeWidth="1"
                        className="animate-cap-breathe" style={{ transformOrigin: '60px 60px', animationDelay: '1.2s' }} />
                </g>

                <g clipPath={`url(#cap-am-${uid})`}>
                    <rect x="32" y="32" width="56" height="28" fill="#1B2A3A" />
                    <rect x="32" y="60" width="56" height="28" fill="#F25C3B" />
                    <line
                        x1="34" y1="60" x2="86" y2="60"
                        stroke="rgba(255,255,255,0.9)" strokeWidth="0.8"
                        className="animate-cap-sweep"
                        style={{ transformOrigin: '60px 60px' }}
                    />
                </g>
                <circle cx="60" cy="60" r="28" fill="none" stroke="rgba(11,23,39,0.12)" strokeWidth="1" />

                <g className="animate-cap-orbit" style={{ transformOrigin: '60px 60px' }}>
                    <circle cx="60" cy="16" r="2.6" fill="#F25C3B" />
                </g>
                <g className="animate-cap-orbit-r" style={{ transformOrigin: '60px 60px' }}>
                    <circle cx="60" cy="104" r="2" fill="#1B2A3A" />
                </g>
            </svg>
        </div>
    );
}
