import { Buffer } from 'buffer';
(window as any).Buffer = Buffer;

// Ensure global process is defined with browser flag and version to satisfy readable-stream polyfill
import process from 'process';
(window as any).process = process;
// browserify libs expect these flags
(process as any).browser = true;
if (!(process as any).version) {
  Object.defineProperty(process, 'version', {
    value: 'v0.0.0',
    writable: false,
    enumerable: false,
    configurable: true,
  });
}

import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";

createRoot(document.getElementById("root")!).render(<App />);
