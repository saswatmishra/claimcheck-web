import { BrowserRouter, Routes, Route } from "react-router-dom";
import Landing from "./pages/Landing";
import Check from "./pages/Check";
import Result from "./pages/Result";
import VehicleShare from "./pages/VehicleShare";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import Navbar from "./components/Navbar";
import { useEffect } from "react";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import {
  getDueReminders,
  markVehicleReminded,
  shouldShowVehicleReminderToday,
  loadSavedVehicles,
} from "./hooks/use-saved-vehicles";

export default function App() {
  useEffect(() => {
    const vehicles = loadSavedVehicles();
    const due = getDueReminders(vehicles);

    for (const v of vehicles) {
      if (!shouldShowVehicleReminderToday(v)) continue;

      const matches = due.filter((d) => d.id === v.id);
      if (matches.length === 0) continue;

      const soonest = matches.sort((a, b) => a.daysBefore - b.daysBefore)[0];

      toast.warn(
        `Renewal reminder: ${v.regNumber} expires in ${soonest.daysBefore} day(s).`
      );

      markVehicleReminded(v.id);
    }
  }, []);

  return (
    <>
      <BrowserRouter>
        <Navbar />
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/check" element={<Check />} />
          <Route path="/result" element={<Result />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/v/:id" element={<VehicleShare />} />
        </Routes>
      </BrowserRouter>
      <ToastContainer />
    </>
  );
}
