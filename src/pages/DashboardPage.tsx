import { useEffect, useState } from "react";
import { countChantiers } from "../services/chantiers.service";

export default function DashboardPage() {
  const [enCoursCount, setEnCoursCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      try {
        const count = await countChantiers({ scope: "en_cours" });
        if (!alive) return;
        setEnCoursCount(count);
      } catch {
        if (!alive) return;
        setEnCoursCount(0);
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Tableau de bord</h1>
        <p className="text-slate-500">Vue dâ€™ensemble de vos chantiers</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="rounded-2xl bg-white border border-slate-200 p-4">
          <div className="text-sm text-slate-500">Chantiers en cours</div>
          <div className="text-3xl font-bold">{loading ? "â€¦" : enCoursCount}</div>
        </div>
        <div className="rounded-2xl bg-white border border-slate-200 p-4">
          <div className="text-sm text-slate-500">RÃ©serves ouvertes</div>
          <div className="text-3xl font-bold">3</div>
        </div>
        <div className="rounded-2xl bg-white border border-slate-200 p-4">
          <div className="text-sm text-slate-500">MatÃ©riel manquant</div>
          <div className="text-3xl font-bold">3</div>
        </div>
        <div className="rounded-2xl bg-white border border-slate-200 p-4">
          <div className="text-sm text-slate-500">Temps global</div>
          <div className="text-3xl font-bold">114h</div>
        </div>
      </div>
    </div>
  );
}
