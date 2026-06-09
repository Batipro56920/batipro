import BudgetTab from "../../../components/chantiers/BudgetTab";
import ChantierChapterDrawer from "../components/ChantierChapterDrawer";

export default function ChantierFinancialSection({ chantierId }: { chantierId: string }) {
  return (
    <ChantierChapterDrawer
      eyebrow="Gestion chantier"
      title="Budget et financier"
      subtitle="Synthese budgetaire du chantier. Les saisies et analyses detaillees se font dans le panneau lateral."
      actionLabel="Ouvrir le financier"
      previewClassName="batipro-chapter-preview--financial"
      drawerMaxWidthClassName="max-w-6xl"
    >
      <BudgetTab chantierId={chantierId} />
    </ChantierChapterDrawer>
  );
}
