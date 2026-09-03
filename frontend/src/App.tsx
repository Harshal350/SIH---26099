import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/context/auth";
import AppLayout from "@/components/layout";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import CpseRepositories from "@/pages/CpseRepositories";
import MaterialMaster from "@/pages/MaterialMaster";
import AiMatching from "@/pages/AiMatching";
import ReviewQueue from "@/pages/ReviewQueue";
import CpseMappings from "@/pages/CpseMappings";
import DataQuality from "@/pages/DataQuality";
import Procurement from "@/pages/Procurement";
import Migration from "@/pages/Migration";
import Audit from "@/pages/Audit";
import Users from "@/pages/Users";
import Settings from "@/pages/Settings";

function Protected({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            element={
              <Protected>
                <AppLayout />
              </Protected>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="/repositories" element={<CpseRepositories />} />
            <Route path="/material-master" element={<MaterialMaster />} />
            <Route path="/ai-matching" element={<AiMatching />} />
            <Route path="/review-queue" element={<ReviewQueue />} />
            <Route path="/cpse-mappings" element={<CpseMappings />} />
            <Route path="/data-quality" element={<DataQuality />} />
            <Route path="/procurement" element={<Procurement />} />
            <Route path="/migration" element={<Migration />} />
            <Route path="/audit" element={<Audit />} />
            <Route path="/users" element={<Users />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
