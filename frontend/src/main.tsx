import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ToastProvider } from "@/components/ui/toast";
import { PrototypeDataProvider } from "@/context/prototype-data";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ToastProvider>
      <PrototypeDataProvider>
        <App />
      </PrototypeDataProvider>
    </ToastProvider>
  </React.StrictMode>
);
