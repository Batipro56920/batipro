import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";

export default function AppLayout() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="flex min-h-screen">
        <aside className="w-72 shrink-0 border-r bg-white hidden md:flex md:flex-col">
          <div className="p-4 border-b">
            <div className="font-bold">ChantierPro</div>
            <div className="text-sm text-slate-500">Suivi de chantiers</div>
          </div>
          <div className="p-3">
            <Sidebar />
          </div>
        </aside>

        <div className="flex-1 flex flex-col">
          <header className="h-16 border-b bg-white flex items-center justify-between px-4 md:px-6">
            <div className="font-semibold">Batipro</div>
            <button className="rounded-xl bg-blue-600 text-white px-4 py-2 hover:bg-blue-700">
              + Nouveau chantier
            </button>
          </header>

          <main className="flex-1 p-4 md:p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
