import { Link } from "react-router-dom";

export default function NavBar() {
  return (
    <nav style={{ display: "flex", gap: 12, padding: 24 }}>
      <Link to="/">Accueil</Link>
      <Link to="/dashboard">Dashboard</Link>
      <Link to="/chantiers">Chantiers</Link>
    </nav>
  );
}