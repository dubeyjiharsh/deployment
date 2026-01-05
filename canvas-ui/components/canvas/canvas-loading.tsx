// "use client";

// import { useEffect, useState } from "react";
// import { motion, AnimatePresence } from "framer-motion";
// import { Loader2, Sparkles } from "lucide-react";

// const LOADING_MESSAGES = [
//   "Analyzing your problem statement...",
//   "Extracting key objectives and goals...",
//   "Identifying strategic KPIs...",
//   "This can take a few minutes...",
//   "Evaluating risks and dependencies...",
//   "Crafting actionable recommendations...",
//   "Building your business canvas...",
// ];

// interface CanvasLoadingProps {
//   streamPreview?: string;
// }

// export function CanvasLoading({ streamPreview }: CanvasLoadingProps) {
//   const [messageIndex, setMessageIndex] = useState(0);

//   useEffect(() => {
//     const interval = setInterval(() => {
//       setMessageIndex((prev) => (prev + 1) % LOADING_MESSAGES.length);
//     }, 3000);

//     return () => clearInterval(interval);
//   }, []);

//   return (
//     <div className="flex h-full flex-col items-center justify-center p-8">
//       <div className="w-full max-w-2xl space-y-8 text-center">
//         {/* Animated Icon */}
//         <motion.div
//           animate={{
//             scale: [1, 1.1, 1],
//             rotate: [0, 5, -5, 0],
//           }}
//           transition={{
//             duration: 2,
//             repeat: Infinity,
//             ease: "easeInOut",
//           }}
//           className="flex justify-center"
//         >
//           <div className="relative">
//             <Sparkles className="h-16 w-16 text-primary" />
//             <motion.div
//               animate={{ rotate: 360 }}
//               transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
//               className="absolute inset-0"
//             >
//               <Loader2 className="h-16 w-16 text-primary/30" />
//             </motion.div>
//           </div>
//         </motion.div>

//         {/* Main Title */}
//         <motion.div
//           initial={{ opacity: 0, y: 20 }}
//           animate={{ opacity: 1, y: 0 }}
//           className="space-y-2"
//         >
//           <h1 className="text-4xl font-bold tracking-tight">
//             Generating Canvas...
//           </h1>

//           {/* Rotating Messages */}
//           <div className="h-6">
//             <AnimatePresence mode="wait">
//               <motion.p
//                 key={messageIndex}
//                 initial={{ opacity: 0, y: 10 }}
//                 animate={{ opacity: 1, y: 0 }}
//                 exit={{ opacity: 0, y: -10 }}
//                 transition={{ duration: 0.5 }}
//                 className="text-lg text-muted-foreground"
//               >
//                 {LOADING_MESSAGES[messageIndex]}
//               </motion.p>
//             </AnimatePresence>
//           </div>
//         </motion.div>

//         {/* Stream Preview - Fixed height container */}
//         <div className="min-h-[120px]">
//           <AnimatePresence mode="wait">
//             {streamPreview && (
//               <motion.div
//                 initial={{ opacity: 0, y: 20 }}
//                 animate={{ opacity: 1, y: 0 }}
//                 exit={{ opacity: 0, y: -20 }}
//                 transition={{ duration: 0.5, ease: "easeOut" }}
//                 className="rounded-lg border border-border bg-muted/50 p-6"
//               >
//                 <div className="flex items-start gap-3">
//                   <motion.div
//                     animate={{ opacity: [0.5, 1, 0.5] }}
//                     transition={{ duration: 1.5, repeat: Infinity }}
//                   >
//                     <Sparkles className="h-5 w-5 text-primary" />
//                   </motion.div>
//                   <div className="flex-1 space-y-2 text-left">
//                     <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
//                       Live Preview
//                     </p>
//                     <motion.p
//                       key={streamPreview}
//                       initial={{ opacity: 0.7 }}
//                       animate={{ opacity: 1 }}
//                       transition={{ duration: 0.2 }}
//                       className="text-sm leading-relaxed"
//                     >
//                       {streamPreview}
//                     </motion.p>
//                   </div>
//                 </div>
//               </motion.div>
//             )}
//           </AnimatePresence>
//         </div>

//         {/* Progress Indicator */}
//         <motion.div
//           initial={{ opacity: 0 }}
//           animate={{ opacity: 1 }}
//           transition={{ delay: 1 }}
//         >
//           <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
//             <motion.div
//               animate={{
//                 x: ["-100%", "100%"],
//               }}
//               transition={{
//                 duration: 2,
//                 repeat: Infinity,
//                 ease: "easeInOut",
//               }}
//               className="h-full w-1/3 bg-primary"
//             />
//           </div>
//         </motion.div>
//       </div>
//     </div>
//   );
// }
