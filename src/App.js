import { Routes, Route } from "react-router-dom";
import Intro from "./pages/Intro";
import Studio from "./pages/Studio";
import Vault from "./pages/Vault";
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Intro />} />
      <Route path="/vault" element={<Vault />} />
      <Route path="/studio" element={<Studio />} />
    </Routes>
  );
}