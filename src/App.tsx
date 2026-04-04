import { BrowserRouter, Routes, Route } from "react-router-dom";
import Landing from "./pages/Landing";
import Check from "./pages/Check";
import Result from "./pages/Result";
import Navbar from "./components/Navbar";
import { useEffect } from "react";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import {
  getDueReminders,
  markVehicleReminded,
  shouldShowVehicleReminderToday,
} from "./services/reminders";
import { loadVehicles } from "./services/vehicles";

export default function App() {
  useEffect(() => {
    const vehicles = loadVehicles();
    const due = getDueReminders();

    for (const v of vehicles) {
      if (!shouldShowVehicleReminderToday(v)) continue;

      const matches = due.filter((d) => d.vehicleNo === v.vehicleNo);
      if (matches.length === 0) continue;

      const soonest = matches.sort((a, b) => a.daysBefore - b.daysBefore)[0];

      toast.warn(
        `Renewal reminder: ${v.vehicleNo} expires in ${soonest.daysBefore} day(s).`
      );

      markVehicleReminded(v.vehicleNo);
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
        </Routes>
      </BrowserRouter>
      <ToastContainer />
    </>
  );
}
