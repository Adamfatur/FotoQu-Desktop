import { motion } from 'framer-motion';

interface PreloaderProps {
    message?: string;
    fullscreen?: boolean;
}

export const Preloader = ({ message = "Loading...", fullscreen = false }: PreloaderProps) => {
    const containerClasses = fullscreen
        ? "fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-900/90 backdrop-blur-md"
        : "flex flex-col items-center justify-center p-8";

    return (
        <div className={containerClasses}>
            <div className="relative w-24 h-24 mb-8">
                {/* Outer Ring */}
                <motion.div
                    className="absolute inset-0 border-4 border-blue-500/30 rounded-full"
                    animate={{
                        scale: [1, 1.1, 1],
                        opacity: [0.3, 0.6, 0.3],
                    }}
                    transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: "easeInOut",
                    }}
                />

                {/* Spinning Gradient Ring */}
                <motion.div
                    className="absolute inset-0 border-4 border-t-blue-500 border-r-purple-500 border-b-pink-500 border-l-transparent rounded-full"
                    animate={{ rotate: 360 }}
                    transition={{
                        duration: 1.5,
                        repeat: Infinity,
                        ease: "linear",
                    }}
                />

                {/* Inner Pulsing Dot */}
                <motion.div
                    className="absolute inset-0 m-auto w-4 h-4 bg-white rounded-full shadow-[0_0_15px_rgba(59,130,246,0.8)]"
                    animate={{
                        scale: [1, 1.5, 1],
                        opacity: [0.8, 1, 0.8],
                    }}
                    transition={{
                        duration: 1,
                        repeat: Infinity,
                        ease: "easeInOut",
                    }}
                />
            </div>

            {/* Text Animation */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="text-center"
            >
                <h3 className={`text-xl font-bold tracking-wider mb-2 ${fullscreen ? 'text-white' : 'text-slate-700'}`}>
                    {message}
                </h3>
                <div className="flex justify-center gap-1">
                    {[0, 1, 2].map((i) => (
                        <motion.div
                            key={i}
                            className="w-2 h-2 bg-blue-400 rounded-full"
                            animate={{
                                y: [-5, 0, -5],
                                opacity: [0.5, 1, 0.5],
                            }}
                            transition={{
                                duration: 0.6,
                                repeat: Infinity,
                                delay: i * 0.2,
                            }}
                        />
                    ))}
                </div>
            </motion.div>
        </div>
    );
};
