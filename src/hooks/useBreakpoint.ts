'use client';
import { useState, useEffect } from 'react';

export function useBreakpoint(minWidth = 768) {
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= minWidth);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, [minWidth]);
  return isDesktop;
}
