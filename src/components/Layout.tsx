import type { ReactNode } from 'react';

export const Layout = ({ children }: { children: ReactNode }) => {
    return (
        <div className="h-screen w-full bg-slate-50 flex flex-col relative overflow-hidden font-sans">
            {/* Background decorations */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
                <div className="absolute -top-[20%] -right-[10%] w-[60vw] h-[60vw] bg-blue-600/5 rounded-full blur-3xl" />
                <div className="absolute bottom-[10%] -left-[10%] w-[50vw] h-[50vw] bg-indigo-600/5 rounded-full blur-3xl" />
            </div>

            <main className="relative z-10 flex-1 flex flex-col min-h-0">
                {children}
            </main>
        </div>
    );
};
