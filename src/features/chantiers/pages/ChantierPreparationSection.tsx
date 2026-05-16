import PreparationChecklistTab from "../../../components/chantiers/PreparationChecklistTab";

export default function ChantierPreparationSection({ chantierId }: { chantierId: string }) {
  return <PreparationChecklistTab chantierId={chantierId} />;
}

